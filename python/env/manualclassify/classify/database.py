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

def getAllClassificationsForBins(bins, targets):
	conn = getDBConnection()
	cur = conn.cursor()
	formatted_list = ["('" + bin + "')" for bin in bins]
	formatted_string = ','.join(formatted_list)
	timeseries_id = getTimeseriesId(utils.timeseries)
	query = "SELECT * FROM classifications WHERE bin = ANY (VALUES " + formatted_string + ") AND timeseries_id = '" + timeseries_id + "';"
	cur.execute(query)
	rows = cur.fetchall()
	# we use a dictionary for easy indexing now, while we build the "level 1" data
	# then turn it into a list later, so we can order by height
	data = {}
	for row in rows:
		id = int(row[0])
		bin = row[1]
		roi = utils.formatROI(row[2])
		user_id = int(row[3])
		time_val = row[4]
		classification_id = int(row[5])
		level = int(row[6])
		verifications = row[7]
		verification_time = row[8] # Might be None
		timeseries = row[9]
		pid = utils.timeseries + bin + '_' + roi
		if not pid in data:
			data[pid] = {'user_power' : -1,
				'time' : 0, 
				'width' : targets[pid]['width'], 
				'height' : targets[pid]['height'],
				'other_classifications' : []
			}
		power = getUserPower(user_id)
		time1 = time_val.isoformat()
		if verification_time and verification_time > time_val:
			time1 = verification_time.isoformat()
		time2 = data[pid]['time']
		if 'verification_time' in data[pid] and data[pid]['verification_time'] and data[pid]['verification_time'] > data[pid]['time']:
			time2 = data[pid]['verification_time']
		dict = {
			'id' : id,
			'pid' : pid, # so that dict key is unecessary later on
			'user_power' : power,
			'user_id' : user_id,
			'time' : time_val,
			'classification_id' : classification_id,
			'verifications' : verifications,
			'verification_time' : verification_time,
			'timeseries' : timeseries,
		}
		if dict['verification_time']:
			dict['verification_time'] = dict['verification_time'].isoformat()
		if dict['time']:
			dict['time'] = dict['time'].isoformat()
		# (user is more important) or (equally important and this data is newer)
		if (power > data[pid]['user_power']) or (power == data[pid]['user_power'] and time1 > time2):
			data[pid] = {**data[pid], **dict}
		else:
			data[pid]['other_classifications'].append(dict)
	for pid,dims in targets.items():
		if not pid in data:
			data[pid] = {'pid' : pid, 'width' : dims['width'], 'height' : dims['height']}
		#else:
		#		if data[pid]['classification_id'] != classification:
		#		del data[pid];

	# turn dictionary into sorted list
	# this is done on JS side now
	#sorted_pids = list(data.values())
	#sorted_pids.sort(key=lambda x:x['width'], reverse=True)
	conn.close()
	# return sorted_pids
	return data

user_powers = {}
def getUserPower(user_id):
	if not user_id in user_powers:
		conn = getDBConnection()
		cur = conn.cursor()
		cur.execute('SELECT power FROM roles WHERE id = (SELECT role FROM users WHERE id = ' + str(user_id) + ');')
		row = cur.fetchone()
		if row != None:
			power = int(row[0])
		else:
			power = 0
		user_powers[user_id] = power
		conn.close()
	return user_powers[user_id]
	
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

def insertUpdatesForPids(updates):
	queries = []
	for pid,id in updates.items():
		i = pid.rfind('_')
		bin = pid[:i]
		roi = pid[i+1:]
		query = ('INSERT INTO classifications (bin, roi, classification_id) VALUES (\'' + bin + '\', ' + roi + ', ' + id + ')'
			'ON CONFLICT (bin, roi, user_id, classification_id) DO UPDATE SET (verifications, verification_time) = '
			'(classifications.verifications + 1, now()) RETURNING *;')
		queries.append(query)
	query_string = ';'.join(queries)
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute(query_string)
	conn.commit()
	rows = cur.fetchall()
	return_updates = {}
	for row in rows:
		pid = row[1] + '_' + utils.formatROI(row[2])
		dict = {
			'id' : row[0],
			'pid' : pid,
			'user_id' : row[3],
			'time' : row[4].isoformat(),
			'classification_id' : row[5],
			'level' : row[6],
			'verifications' : row[7],
			'verification_time' : row[8],
			'user_power' : getUserPower(row[3]),
			'timeseries' : row[9],
		}
		if dict['verification_time']:
			dict['verification_time'] = dict['verification_time'].isoformat()
		return_updates[pid] = dict
	conn.close()
	if cur.statusmessage == 'INSERT 0 1':
		return json.dumps(return_updates)
	else:
		return 'failure'
