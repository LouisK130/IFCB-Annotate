import psycopg2 as sql
import time
from classify import utils
from classify import config

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

def getPidsOfClassificationForBins(bins, targets, classification):
	conn = getDBConnection()
	cur = conn.cursor()
	formatted_list = ["('" + bin + "')" for bin in bins]
	formatted_string = ','.join(formatted_list)
	query = 'SELECT * FROM classifications WHERE bin = ANY (VALUES ' + formatted_string + ') AND level = 1;'
	cur.execute(query)
	rows = cur.fetchall()
	# we use a dictionary for easy indexing now, while we build the "level 1" data
	# then turn it into a list later, so we can order by height
	user_powers = {}
	data = {}
	for row in rows:
		id = int(row[0])
		bin = row[1]
		roi = utils.formatROI(row[2])
		user_id = int(row[3])
		time_val = row[4]
		classification_id = int(row[5])
		level = int(row[6])
		verifications = row[7] # Might be None
		verification_time = row[8] # Might be None
		pid = bin + '_' + roi
		if not pid in data:
			data[pid] = {'user_power' : -1,
				'time' : 0, 
				'width' : targets[pid]['width'], 
				'height' : targets[pid]['height'],
				'other_classifications' : []
			}
		if not user_id in user_powers:
			user_powers[user_id] = getUserPower(user_id)
		power = user_powers[user_id]
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
			'verification_time' : verification_time
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
	# if viewing 'other', include all pids not yet in database
	# also remove all entries with an accepted classification that we are not interested in
	for pid,dims in targets.items():
		if not pid in data:
			if classification == utils.other_classification_id:
				data[pid] = {'pid' : pid, 'width' : dims['width'], 'height' : dims['height']}
		else:
			if data[pid]['classification_id'] != classification:
				del data[pid];

	# turn dictionary into sorted list
	sorted_pids = list(data.values())
	sorted_pids.sort(key=lambda x:x['width'], reverse=True)
	conn.close()
	return sorted_pids

def getUserPower(user_id):
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute('SELECT power FROM roles WHERE id = (SELECT role FROM users WHERE id = ' + str(user_id) + ');')
	row = cur.fetchone()
	if row != None:
		power = int(row[0])
	else:
		power = 0
	conn.close()
	return power

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
		query = 'INSERT INTO classifications (bin, roi, classification_id) VALUES (\'' + bin + '\', ' + roi + ', ' + id + ') ON CONFLICT (bin, roi, user_id, classification_id) DO UPDATE SET (verifications, verification_time) = (classifications.verifications + 1, now())'
		queries.append(query)
	query_string = ';'.join(queries)
	conn = getDBConnection()
	cur = conn.cursor()
	cur.execute(query_string)
	conn.commit()
	conn.close()
	if cur.statusmessage == 'INSERT 0 1':
		return 'success'
	else:
		return 'failure'
