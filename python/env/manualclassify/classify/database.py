import psycopg2 as sql
import time
import json
import uuid
from classify import utils, config
from classify.models import TagLabel, ClassLabel, Timeseries, Classification, Tag
import time
import logging

logger = logging.getLogger(__name__)

# NOTE: Throughout this application, PIDs and bins are stored and transferred WITHOUT the timeseries url prepended

# Filtering using django objects is fast, but then iterating through them is slow
# so instead we'll use lower level SQL to sort the results ahead of time (seems to be about 70x faster!)

# Param 1: an array of strings, representing bins
# Param 2: a dictionary, indexed by PID, with values that are dictionaries containing keys 'width' and 'height'
#     for all PIDs in the given bins
# Output: a dictionary, indexed by PID, with values that are dictionaries containing all data for all classifications
#    relevant to the given bins, ready to be passed to JS or to another function that will add the auto classifier data
def getAllDataForBins(bins, targets):

    # since timeseries_id should already be held in memory, no point in joining that table again in below query
    timeseries_id = getTimeseriesId(utils.timeseries)
    
    params = [timeseries_id]
    
    # result column order:
    # 0   1    2    3        4     5                  6      7              8                  9              10     11        12
    # id, bin, roi, user_id, time, classification_id, level, verifications, verification_time, timeseries_id, power, username, pid
    query = ('SELECT c.*, p.power, u.username, c.bin || \'_\' || LPAD(c.roi::text, 5, \'0\') as pid '
        'FROM classify_classification c, auth_user_groups g, auth_group p, auth_user u '
        'WHERE c.user_id = g.user_id '
        'AND c.user_id = u.id '
        'AND p.id = g.group_id '
        'AND c.timeseries_id::uuid = %s '
        'AND c.bin in (')
    for bin in bins:
        query += '%s, '
        params.append(bin)
    query = query[:-2] + ') '
    query += 'ORDER BY pid, p.power DESC, c.verification_time DESC NULLS LAST, c.time DESC;'
    
    conn = sql.connect(database=config.db, user=config.username, password=config.password, host=config.server)
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    
    data = {}
    
    for row in rows:
        dict = {
            'id' : row[0],
            'user_id' : row[3],
            'time' : row[4].isoformat(),
            'classification_id' : row[5],
            'level' : row[6],
            'verifications' : row[7],
            'verification_time' : row[8].isoformat() if row[8] else None,
            'timeseries_id' : row[9],
            'user_power' : row[10],
            'username' : row[11]
        }
        # since rows are already sorted by power and time, the first time we see a pid, we know the classification is accepted
        if not row[12] in data:
            data[row[12]] = {
                'pid' : row[12], # sometimes in Javascript these dictionaries are disassociated from their keys, but we still need to know their PID
                'accepted_classification' : dict,
                'width' : targets[row[12]]['width'],
                'height' : targets[row[12]]['height'],
                'other_classifications' : [],
                'tags' : [],
            }
        else:
            data[row[12]]['other_classifications'].append(dict)

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
    
    # now we query for tags, but the 'accepted' logic for them is less straightforward, so we'll leave that to JS
    # here, we simply add tags to the 'tags' array for their respective pids
    
    # result column order:
    # 0   1    2    3        4     5       6      7              8                  9              10        11     12        13
    # id, bin, roi, user_id, time, tag_id, level, verifications, verification_time, timeseries_id, negation, power, username, pid
    query = ('SELECT t.*, p.power, u.username, t.bin || \'_\' || LPAD(t.roi::text, 5, \'0\') as pid '
        'FROM classify_tag t, auth_user_groups g, auth_group p, auth_user u '
        'WHERE t.user_id = g.user_id '
        'AND t.user_id = u.id '
        'AND p.id = g.group_id '
        'AND t.timeseries_id::uuid = %s '
        'AND t.bin in (')
    for bin in bins:
        query += '%s, '
    query = query[:-2] + ');'
        
    cur.execute(query, params)
    rows = cur.fetchall()
    
    for row in rows:
        data[row[13]]['tags'].append({
            'id' : row[0],
            'user_id' : row[3],
            'time' : row[4].isoformat(),
            'tag_id' : row[5],
            'level' : row[6],
            'verifications' : row[7],
            'verification_time' : row[8].isoformat() if row[8] else None,
            'timeseries_id' : row[9],
            'negation' : row[10],
            'user_power' : row[11],
            'username' : row[12],
        })
        
    return data

# Unfortunately, Django doesn't seem to have a good way to do many UPSERTs at once (I tried just looping objects, and it's PAINFULLY slow)
#     so we have to drop back down to SQL for this too
# Since this function is practically identical for classifications/tags (with only minor SQL differences), it handles both use cases
# This may make the function overly complex and hard to maintain, so I may change it in the future, but it works for now

# Param 1: a dinctionary, indexed by PID, with integer values representing the new classification/tag id to assign that PID to
# Param 2: an integer, representing the user id of the user submitting these updates
# Param 3: a boolean, representing whether these updates are classifications (True) or tags (False)
# Param 4: a boolean, representing whether these updates are negations (True) or not (False) -- only relevant if Param 3 is False
#    if this value is True, then Param 1's dictionary values are actually arrays of integers, instead of single integers
# Output: a dictionary, with format:
#    'classifications' : {
#        PID : {...}
#    }
#    'tags' : {
#        PID : [
#            {...},
#            {...},
#        ]
#    }
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
    
    # now we're looking at user inputs, so we need to pass paramters to psycopg2 instead of inserting directly into the query
    params = [];
    
    for pid,id in updates.items():
    
        # parse out the bin and roi from pid
        i = pid.rfind('_')
        bin = pid[:i]
        roi = pid[i+1:]
        
        if negations:
            # if these are negations, each `id` is actually an array of ids
            for trueID in id:
                query = query + '(%s, %s, %s, now(), %s, 1, 0, null, %s, true), '
                params.extend([bin, roi, user_id, trueID, getTimeseriesId(utils.timeseries)])
        else:
            query = query + '(%s, %s, %s, now(), %s, 1, 0, null, %s'
            params.extend([bin, roi, user_id, id, getTimeseriesId(utils.timeseries)])
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
    cur.execute(query, params)
    conn.commit()
    rows = cur.fetchall()
    
    # loop returned (affected) rows and build dictionaries to be passed to JS
    for row in rows:
    
        # I'm not sure if there's a better way to access columns
        # This is risky because if the schema changes, the indices are all thrown off
        pid = row[1] + '_' + utils.formatROI(row[2])
        dict = {
            'id' : row[0],
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

# takes a set of bins and filters out those which have no annotations matching the given class/tag combo

# Param 1: an array of strings, representing bin names
# Param 2: an integer representing a class id
# Param 3: an integer repsenting a tag id, OR a string 'ALL' or 'NONE'
# Output: the same array of strings from Param 1, minus any bins which don't have at least one target classified as Param 2/3
def filterBins(bins, classID, tagID):
    if classID == '' or tagID == '':
        return bins
    
    params = []
        
    query = ('WITH '
                'CA AS ( '
                    'SELECT DISTINCT ON (c.bin, c.roi) c.*, p.power '
                    'FROM classify_classification c, auth_user_groups g, auth_group p '
                    'WHERE c.user_id = g.user_id '
                    'AND p.id = g.group_id '
                    'AND c.bin in (')
                    
    for bin in bins:
        query += '%s, '
        params.append(bin)
        
    query = query[:-2]
    
    query = query + (') '
                    'ORDER BY c.bin, c.roi, p.power DESC, c.verification_time DESC NULLS LAST, c.time DESC '
                '), '
                'CF AS ( '
                    'SELECT * FROM CA WHERE classification_id = %s '
                ')')
    
    params.append(classID)
                
    if not tagID == 'ALL':
        query = query + (''
                ', '
                'TA AS ( '
                    'SELECT DISTINCT ON (t.bin, t.roi, t.tag_id) t.*, p.power '
                    'FROM classify_tag t, auth_user_groups g, auth_group p '
                    'WHERE t.user_id = g.user_id '
                    'AND p.id = g.group_id '
                    'AND t.bin IN (')
                    
        for bin in bins:
            query += '%s, '
            params.append(bin)
    
        query = query[:-2]
        
        query = query + (') '
                    'ORDER BY t.bin, t.roi, t.tag_id, p.power DESC, t.verification_time DESC NULLS LAST, t.time DESC '
                ')')
                
        if not tagID == 'NONE':
            query = query + (''
                    ', '
                    'TF AS ( '
                        'SELECT * FROM TA WHERE tag_id = %s AND negation = false '
                    ')')
            params.append(tagID)
                
    query = query + (''
            ' SELECT DISTINCT ON (bin) bin FROM CF')
            
    if not tagID == 'ALL':
    
        tag_query = 'TA' if tagID == 'NONE' else 'TF'
        
        if tagID == 'NONE':
            query = query + (' '
                    'WHERE NOT EXISTS ')
        else:
            query = query + (' '
                    'WHERE EXISTS ')
        query = query + (''
                        '(SELECT 1 FROM ' + tag_query + ' '
                            'WHERE ' + tag_query + '.roi = CF.roi '
                            'AND ' + tag_query + '.bin = CF.bin'
                        ')')

    query = query + ';'
    
    conn = sql.connect(database=config.db, user=config.username, password=config.password, host=config.server)
    cur = conn.cursor()
    cur.execute(query, params)
    conn.commit()
    rows = cur.fetchall()
    
    bins = []
    
    for row in rows:
        bins.append(row[0])

    return bins
    
# we cache timeseries info here, so we don't make the same call to the database thousands of times
# format:
#    URL : UUID
timeseries_ids = {}

def getTimeseriesId(url):
    if url in timeseries_ids:
        return timeseries_ids[url]
    else:
        ts = Timeseries.objects.get(url=url).pk
        timeseries_ids[url] = str(ts)
        return ts

def loadAllTimeseries():
    global timeseries_ids
    timeseries_ids = {}
    try:
        for ts in Timeseries.objects.all():
            timeseries_ids[ts.url] = str(ts.pk)
    except:
        logger.error('Failed to load timeseries IDs, does the table exist?')

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
