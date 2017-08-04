import psycopg2 as sql
import time
import json
import uuid
from classify import utils, config

db = config.db
username = config.username
password = config.password
server = config.server

# For simplicity, we'll open a new connection for every operation
# In the future it may or may not be more efficient to maintain an open connection
# for some amount of time to handle multiple operations
def getDBConnection():
	return sql.connect(database=db, user=username, password=password, host=server)
	# This needs to be closed at the end of each function that uses it

def getAllDataForBins(bins, targets):
	conn = getDBConnection()
	cur = conn.cursor()
	formatted_list = ["('" + bin + "')" for bin in bins]
	formatted_string = ','.join(formatted_list)
	timeseries_id = getTimeseriesId(utils.timeseries)
	query = "SELECT * FROM classifications WHERE bin = ANY (VALUES " + formatted_string + ") AND timeseries_id = '" + timeseries_id + "';"
	cur.execute(query)
	rows = cur.fetchall()
	data = {}
	for row in rows:
		user_id = row[3]
		time_val = row[4]
		verification_time = row[8] # Might be None
		pid = row[1] + '_' + utils.formatROI(row[2])
		if not pid in data:
			data[pid] = {
				'user_power' : -1,
				'time' : 0, 
				'width' : targets[pid]['width'], 
				'height' : targets[pid]['height'],
				'other_classifications' : [],
				'tags' : [],
			}
		power = utils.getUserPower(user_id)
		time1 = time_val.isoformat()
		if verification_time and verification_time > time_val:
			time1 = verification_time.isoformat()
		time2 = data[pid]['time']
		if 'verification_time' in data[pid] and data[pid]['verification_time'] and data[pid]['verification_time'] > data[pid]['time']:
			time2 = data[pid]['verification_time']
		dict = {
			'id' : row[0],
			'pid' : pid, # so that dict key is unecessary later on
			'user_power' : power,
			'user_id' : user_id,
			'username' : utils.getUserName(user_id),
			'time' : time_val.isoformat(),
			'level' : row[6],
			'classification_id' : row[5],
			'verifications' : row[7],
			'verification_time' : verification_time,
			'timeseries_id' : row[9],
		}
		if dict['verification_time']:
			dict['verification_time'] = dict['verification_time'].isoformat()
		# (user is more important) or (equally important and this data is newer)
		if (power > data[pid]['user_power']) or (power == data[pid]['user_power'] and time1 > time2):
			if data[pid]['time'] != 0: # 0 is a dumby value placed above, means this key doesn't actually exist yet
				# if it previously existed, we need to move it to 'other_classifications'
				# first clone
				to_move = data[pid].copy()
				# then remove keys only necesary in top-level classification data
				to_move.pop('width', None)
				to_move.pop('height', None)
				to_move.pop('other_classifications', None)
				to_move.pop('tags', None)
				data[pid]['other_classifications'].append(to_move)
			# finally merge new data with old
			data[pid] = {**data[pid], **dict}
		else:
			data[pid]['other_classifications'].append(dict)
	for pid,dims in targets.items():
		if not pid in data:
			data[pid] = {
				'pid' : pid, 
				'width' : dims['width'],
				'height' : dims['height'],
				'other_classifications' : [],
				'tags' : [],
			}
	query = "SELECT * FROM tags WHERE bin = ANY (VALUES " + formatted_string + ") AND timeseries_id = '" + timeseries_id + "';"
	cur.execute(query)
	rows = cur.fetchall()
	for row in rows:
		pid = row[1] + '_' + utils.formatROI(row[2])
		dict = {
			'id' : row[0],
			'pid' : pid,
			'user_id' : row[3],
			'user_power' : utils.getUserPower(row[3]),
			'username' : utils.getUserName(row[3]),
			'time' : row[4].isoformat(),
			'tag_id' : row[5],
			'level' : row[6],
			'verifications' : row[7],
			'verification_time' : row[8],
			'timeseries_id' : row[9],
			'negation' : row[10],
		}
		if dict['verification_time']:
			dict['verification_time'] = dict['verification_time'].isoformat()
		data[pid]['tags'].append(dict)
	conn.close()
	return data
	
timeseries_ids = {}
def getTimeseriesId(url):
	if not url in timeseries_ids:
		conn = getDBConnection()
		cur = conn.cursor()
		cur.execute("SELECT id FROM timeseries WHERE url = '" + url + "';")
		row = cur.fetchone()
		if row != None:
			timeseries_ids[url] = row[0]
		else:
			createTimeseries(url)
		conn.close()
	return timeseries_ids[url]

def createTimeseries(url):
	print('creating new timeseries: ' + url)
	conn = getDBConnection()
	cur = conn.cursor()
	id = str(uuid.uuid4())
	cur.execute("INSERT INTO timeseries (id, url) VALUES ('" + id + "', '" + url + "');")
	conn.commit()
	conn.close()
	print('id: ' + id)
	timeseries_ids[url] = id

def getClassificationList():
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute('SELECT * FROM classification_labels')
	rows = cur.fetchall()
	data = []
	for row in rows:
		c = {}
		c['id'] = row[0]
		c['name'] = row[1]
		c['international_id'] = row[2]
		data.append(c)
	conn.close()
	return data

def getTagList():
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute('SELECT * FROM tag_labels')
	rows = cur.fetchall()
	data = []
	for row in rows:
		c = {}
		c['id'] = row[0]
		c['name'] = row[1]
		data.append(c)
	conn.close()
	return data

def insertUpdatesForPids(updates, user_id, is_classifications, negations):
	if not updates:
		return {}
	expected_inserts = 0;
	return_updates = {}
	table = 'classifications'
	col = 'classification_id'
	if is_classifications:
		return_updates['classifications'] = {}
	else:
		return_updates['tags'] = {}
		table = 'tags'
		col = 'tag_id'
	query = 'INSERT INTO ' + table + ' (bin, roi, ' + col + ', user_id, timeseries_id'
	if negations:
		query = query + ', negation'
	query = query + ') VALUES '
	for pid,id in updates.items():
		i = pid.rfind('_')
		bin = pid[:i]
		roi = pid[i+1:]
		if negations:
			for trueID in id:
				query = query + '(\'' + bin + '\', ' + roi + ', ' + trueID + ', ' + str(user_id) + ', \'' + getTimeseriesId(utils.timeseries) + '\', true), '
				expected_inserts += 1
		else:
			query = query + '(\'' + bin + '\', ' + roi + ', ' + id + ', ' + str(user_id) + ', \'' + getTimeseriesId(utils.timeseries) + '\'), '
			expected_inserts += 1
	query = query[:-2]
	query = query + ' ON CONFLICT (bin, roi, user_id, ' + col + ''
	if not is_classifications:
		query = query + ', negation'
	query = query + ') DO UPDATE SET (verifications, verification_time) = (' + table + '.verifications + 1, now()) RETURNING *;'
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute(query)
	conn.commit()
	rows = cur.fetchall()
	for row in rows:
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
	if cur.statusmessage != 'INSERT 0 ' + str(expected_inserts):
		return_updates['failure'] = True
	return return_updates