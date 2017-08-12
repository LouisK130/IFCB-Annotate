import psycopg2 as sql
import time
import json
import uuid
from classify import utils, config
from classify.models import TagLabel, ClassLabel, Timeseries, Classification, Tag
from django.utils import timezone
from django.db import transaction
from django.db.models import F

# load all timeseries into memory right off the bat, in one query
timeseries_ids = {}
for ts in Timeseries.objects.all():
	timeseries_ids[ts.url] = ts.pk
	
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
			'time' : t.time,
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

# Param 1: a dictionary, indexed by PID, with integer values representing a new classification_id to assign the PID to
# Param 2: an integer, representing the id of the user who is submitting these updates
# Output: a dictionary, with format:
#		'classifications' : {
#			PID : {...}
#		}
#	where ... represents data for a newly created or updated entry
def insertClassificationUpdates(updates, user_id):

	changed_objects = []
	return_updates = {
		'classifications' : {}
	}
	
	# create a new database transaction explicity, so we don't autocommit for every single update
	with transaction.atomic():
		for pid,id in updates.items():
			# parse out the bin and roi from PID
			i = pid.rfind('_')
			bin = pid[:i]
			roi = int(pid[i+1:])
			
			# see if this entry already exists
			try:
				# if so, update verifications and verification_time
				c = Classification.objects.get(bin=bin, roi=roi, user_id=user_id, classification_id=id)
				c.verifications = c.verifications + 1
				c.verification_time = timezone.now()
				c.save()
				changed_objects.append(c)
			except Classification.DoesNotExist:
				# if not, create a new one
				c = Classification(bin=bin, roi=roi, user_id=user_id, classification_id=id, timeseries_id=getTimeseriesId(utils.timeseries))
				c.save()
				changed_objects.append(c)
	transaction.commit()
	
	# loop over changed objects and build a result dictionary
	for o in changed_objects:
		pid = o.bin + '_' + utils.formatROI(o.roi)
		# data for entry
		dict = {
			'id' : o.pk,
			'pid' : pid,
			'user_id' : o.user_id,
			'time' : o.time.isoformat(),
			'level' : o.level,
			'classification_id' : o.classification_id,
			'verifications' : o.verifications,
			'user_power' : utils.getUserPower(o.user_id),
			'username' : utils.getUserName(o.user_id),
			'timeseries_id' : o.timeseries_id,
		}
		dict['verification_time'] = o.verification_time.isoformat() if o.verification_time else None
		return_updates['classifications'][pid] = dict;
	
	return return_updates

# Param 1: a dictionary, indexed by PID, with integer values representing a new classification_id to assign the PID to
# Param 2: an integer, representing the id of the user who is submitting these updates
# Param 3: a boolean, representing whether or not these updates are tag negations
# Output: a dictionary, with format:
#		'tags' : {
#			PID : {...}
#		}
#	where ... represents data for a newly created or updated entry
def insertTagUpdates(updates, user_id, negations):

	return_updates = {
		'tags' : {}
	}
	changed_objects = []
	
	# create a new database transaction explicity, so we don't autocommit for every single update
	with transaction.atomic():
		for pid,id in updates.items():
			# parse out the bin and roi from PID
			i = pid.rfind('_')
			bin = pid[:i]
			roi = int(pid[i+1:])
			
			# see if this entry already exists
			try:
				# if so, update verifications and verification_time
				c = Tag.objects.get(bin=bin, roi=roi, user_id=user_id, tag_id=id, negation=negations)
				c.verifications = c.verifications + 1
				c.verification_time = timezone.now()
				c.save()
				changed_objects.append(c)
			except Tag.DoesNotExist:
				# if not, create a new one
				c = Tag(bin=bin, roi=roi, user_id=user_id, classification_id=id, timeseries_id=getTimeseriesId(utils.timeseries), negation=negations)
				c.save()
				changed_objects.append(c)
	
	# loop over changed objects and build a result dictionary
	for o in changed_objects:
		pid = o.bin + '_' + utils.formatROI(o.roi)
		# data for entry
		dict = {
			'id' : o.pk,
			'pid' : pid,
			'user_id' : o.user_id,
			'time' : o.time.isoformat(),
			'level' : o.level,
			'tag_id' : o.tag_id,
			'verifications' : o.verifications,
			'user_power' : utils.getUserPower(o.user_id),
			'username' : utils.getUserName(o.user_id),
			'timeseries_id' : o.timeseries_id,
			'negation' : o.negation,
		}
		dict['verification_time'] = o.verification_time.isoformat() if o.verification_time else None
		return_updates['tags'][pid] = dict;
	
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