import psycopg2 as sql
import time
import json
import uuid
from classify import utils, config
from classify.models import TagLabel, ClassLabel, Timeseries, Classification, Tag

# load all timeseries into memory right off the bat, in one query
timeseries_ids = {}
try:
	for ts in Timeseries.objects.all():
		timeseries_ids[ts.url] = ts.pk
except:
	print('Failed to load timeseries IDs, does the table exist?')
	
# NOTE: Throughout this application, PIDs and bins are stored and transferred WITHOUT the timeseries url prepended

# Param 1: an array of strings, representing bins
# Param 2: a dictionary, indexed by PID, with values that are dictionaries containing keys 'width' and 'height'
# 	for all PIDs in the given bins
# Output: a dictionary, indexed by PID, with values that are dictionaries containing all data for all classifications
#	relevant to the given bins, ready to be passed to JS or to another function that will add the auto classifier data
def getAllDataForBins(bins, targets):
	timeseries_id = getTimeseriesId(utils.timeseries)
	data = {}
	for c in Classification.objects.filter(bin__in=bins, timeseries_id=timeseries_id):
		pid = c.bin + '_' + utils.formatROI(c.roi)
		
		# if we haven't already seen this PID, input some defaults and dumby data
		if not pid in data:
			data[pid] = {
				'user_power' : -1,
				'time' : 0, 
				'width' : targets[pid]['width'], 
				'height' : targets[pid]['height'],
				'other_classifications' : [],
				'tags' : [],
			}
		
		# define some values for comparing whether or not this entry is "accepted"
		old_power = data[pid]['user_power']
		new_power = utils.getUserPower(c.user_id)
		new_time = c.time.isoformat()
		if c.verification_time and c.verification_time.isoformat() > new_time:
			new_time = c.verification_time.isoformat()
		old_time = data[pid]['time']
		if 'verification_time' in data[pid] and data[pid]['verification_time'] and data[pid]['verification_time'] > data[pid]['time']:
			old_time = data[pid]['verification_time']
		
		# build the dictionary that contains this entry's data, in the format JS will expect
		dict = {
			'id' : c.pk,
			'pid' : pid,
			'user_power' : new_power,
			'user_id' : c.user_id,
			'username' : utils.getUserName(c.user_id),
			'time' : c.time.isoformat(),
			'level' : c.level,
			'classification_id' : c.classification_id,
			'verifications' : c.verifications,
			'timeseries_id' : c.timeseries_id,
		}
		
		dict['verification_time'] = c.verification_time.isoformat() if c.verification_time else None
		
		# if user is more important, or equally important but this entry is more recent than the old accepted one
		if new_power > old_power or (new_power == old_power and new_time > old_time):
			# if the existing entry is a real classification (not dumby data from above)
			if data[pid]['time'] != 0:
				# we need to move this classification to the 'other_classifications' array before overwriting it
				# first clone the old entry
				to_move = data[pid].copy()
				# then remove keys only needed in the top-level classification data
				to_move.pop('width', None)
				to_move.pop('height', None)
				to_move.pop('other_classifications', None)
				to_move.pop('tags', None)
				# finally move to the non-accepted array
				data[pid]['other_classifications'].append(to_move)
			# now merge and overwrite with new data
			data[pid] = {**data[pid], **dict}
		# if user isn't more important, or this annotation is older than the currently accepted one
		else:
			# we simply stick this data into 'other_classifications'
			data[pid]['other_classifications'].append(dict)
	
	# now loop all targets given by Param 2
	for pid,dims in targets.items():
		# if we didn't already find any annotations for this pid
		if not pid in data:
			# insert some default values and height/width
			data[pid] = {
				'pid' : pid, 
				'width' : dims['width'],
				'height' : dims['height'],
				'other_classifications' : [],
				'tags' : [],
			}
	
	# now we need to find tag data
	for t in Tag.objects.filter(bin__in=bins, timeseries_id=timeseries_id):
		pid = t.bin + '_' + utils.formatROI(t.roi)
		
		# build the dictionary
		dict = {
			'id' : t.pk,
			'pid' : pid,
			'user_id' : t.user_id,
			'user_power' : utils.getUserPower(t.user_id),
			'username' : utils.getUserName(t.user_id),
			'time' : t.time.isoformat(),
			'tag_id' : t.tag_id,
			'level' : t.level,
			'verifications' : t.verifications,
			'timeseries_id' : t.timeseries_id,
			'negation' : t.negation,
		}
		
		dict['verification_time'] = t.verification_time.isoformat() if t.verification_time else None
		
		# and stick it in the tags array for this PID
		data[pid]['tags'].append(dict)
	
	return data

# Unfortunately, Django doesn't seem to have a good way to do many UPSERTs at once (I tried just looping objects, and it's PAINFULLY slow)
# 	so we have to drop back down to SQL for this
# Since this function is practically identical for classifications/tags (with only minor SQL differences), it handles both use cases
# This may make the function overly complex and hard to maintain, so I may change it in the future, but it works for now

# Param 1: a dinctionary, indexed by PID, with integer values representing the new classification/tag id to assign that PID to
# Param 2: an integer, representing the user id of the user submitting these updates
# Param 3: a boolean, representing whether these updates are classifications (True) or tags (False)
# Param 4: a boolean, representing whether these updates are negations (True) or not (False) -- only relevant if Param 3 is False
#	if this value is True, then Param 1's dictionary values are actually arrays of integers, instead of single integers
# Output: a dictionary, with format:
#	'classifications' : {
#		PID : {...}
#	}
#	'tags' : {
#		PID : [
#			{...},
#			{...},
#		]
#	}
# where ... represents all data for an entry that was updated or inserted
def insertUpdates(updates, user_id, is_classifications, negations):

	# if we don't have any updates, just stop
	if not updates or len(updates) == 0:
		return {}

	return_updates = {}

	# set some values, depending on whether these are classification or tag updates
	table = 'classify_classification'
	col = 'classification_id'
	if is_classifications:
		return_updates['classifications'] = {}
	else:
		return_updates['tags'] = {}
		table = 'classify_tag'
		col = 'tag_id'
	
	# begin to build the query string
	# unfortunately it seems Django Model defaults aren't actually set as defaults in the database
	# so because we are doing a manual insert, we need to provide a value for every single column
	query = 'INSERT INTO ' + table + ' (bin, roi, user_id, time, ' + col + ', level, verifications, verification_time, timeseries_id'
	
	# the tag table also has a `negation` column that needs to be handled
	if not is_classifications:
		query = query + ', negation'
		
	# loop updates and build the VALUES portion of the query string
	query = query + ') VALUES '
	for pid,id in updates.items():
	
		# parse out the bin and roi from pid
		i = pid.rfind('_')
		bin = pid[:i]
		roi = pid[i+1:]
		
		if negations:
			# if these are negations, each `id` is actually an array of ids
			for trueID in id:
				query = query + '(\'' + bin + '\', ' + roi + ', ' + str(user_id) + ', now(), ' + trueID + ', 1, 0, null, \'' + str(getTimeseriesId(utils.timeseries)) + '\', true), '
		else:
			query = query + '(\'' + bin + '\', ' + roi + ', ' + str(user_id) + ', now(), ' + id + ', 1, 0, null, \'' + str(getTimeseriesId(utils.timeseries)) + '\''
			# if these are tags, we have to specificy 'false' for negation column
			if is_classifications:
				query = query + '), '
			else:
				query = query + ', false), '

	# trim off the trailing space and comma
	query = query[:-2]
	
	# handle conflicts that require an update instead of an insert
	query = query + ' ON CONFLICT (bin, roi, user_id, ' + col + ''
	if not is_classifications:
		query = query + ', negation'
	query = query + ') DO UPDATE SET (verifications, verification_time) = (' + table + '.verifications + 1, now()) RETURNING *;'
	
	conn = sql.connect(database=config.db, user=config.username, password=config.password, host=config.server)
	cur = conn.cursor()
	cur.execute(query)
	conn.commit()
	rows = cur.fetchall()
	
	# loop returned (affected) rows and build dictionaries to be passed to JS
	for row in rows:
	
		# I'm not sure if there's a better way to access columns
		# This is risky because if the schema changes, the indices are all thrown off
		pid = row[1] + '_' + utils.formatROI(row[2])
		dict = {
			'id' : row[0],
			'pid' : pid,
			'user_id' : row[3],
			'time' : row[4].isoformat(),
			'level' : row[6],
			'verifications' : row[7],
			'verification_time' : row[8],
			'user_power' : utils.getUserPower(row[3]),
			'username' : utils.getUserName(row[3]),
			'timeseries_id' : row[9],
		}
		
		if dict['verification_time']:
			dict['verification_time'] = dict['verification_time'].isoformat()
			
		if is_classifications:
			dict['classification_id'] = row[5]
			return_updates['classifications'][pid] = dict
		else:
			dict['tag_id'] = row[5]
			dict['negation'] = row[10]
			if not pid in return_updates['tags']:
				return_updates['tags'][pid] = []
			return_updates['tags'][pid].append(dict)
			
	conn.close()
	return return_updates
	
def getTimeseriesId(url):
	if not url in timeseries_ids:
		createTimeseries(url)
	return timeseries_ids[url]

def createTimeseries(url):
	print('creating new timeseries: ' + url)
	id = str(uuid.uuid1())
	ts = Timeseries(id=id, url=url)
	ts.save()
	timeseries_ids[url] = id
	print('id: ' + id)

def getClassificationList():
	data = []
	for cl in ClassLabel.objects.all():
		c = {}
		c['id'] = cl.pk
		c['name'] = cl.name
		c['international_id'] = cl.international_id
		data.append(c)
	return data

def getTagList():
	data = []
	for tl in TagLabel.objects.all():
		c = {}
		c['id'] = tl.pk
		c['name'] = tl.name
		data.append(c)
	return data;