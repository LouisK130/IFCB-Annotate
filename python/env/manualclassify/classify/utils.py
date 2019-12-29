import requests
import csv
import codecs
from contextlib import closing
import os
from django.contrib.auth.models import User
import json
import time
import logging
import threading
from .settings import CACHE_DIR

logger = logging.getLogger(__name__)

ZIP_CACHE_PATH = os.path.join(CACHE_DIR,'zips')
TARGETS_CACHE_PATH = os.path.join(CACHE_DIR,'targets')
AUTO_RESULTS_CACHE_PATH = os.path.join(CACHE_DIR,'class_scores')

if not os.path.exists(ZIP_CACHE_PATH):
    os.makedirs(ZIP_CACHE_PATH, exist_ok=True)
if not os.path.exists(TARGETS_CACHE_PATH):
    os.makedirs(TARGETS_CACHE_PATH, exist_ok=True)
if not os.path.exists(AUTO_RESULTS_CACHE_PATH):
    os.makedirs(AUTO_RESULTS_CACHE_PATH, exist_ok=True)

CLASSIFIER_CONVERSION_TABLE = {
    'Asterionellopsis' : 'Asterionellopsis glacialis',
    'Corethron' : 'Corethron hystrix',
    'DactFragCerataul' : 'Dactyliosolen fragilissimus',
    'Dactyliosolen' : 'Dactyliosolen blavyanus',
    'Ditylum' : 'Ditylum brightwellii',
    'Eucampia' : 'Eucampia cornuta',
    'Guinardia' : 'Guinardia delicatula',
    'Pseudonitzschia' : 'Pseudo-nitzschia',
    'Thalassiosira_dirty' : 'Thalassiosira', # TAGGED: 'external detritus'
    'dino30' : 'Dinophyceae',
    'Lauderia' : 'Lauderia annulata',
    'Cerataulina' : 'Cerataulina pelagica',
    'Paralia' : 'Paralia sulcata',
    'ciliate_mix' : 'Ciliate mix',
    'Laboea' : 'Laboea strobila',
    'Myrionecta' : 'Mesodinium',
    'tintinnid' : 'Tintinnida',
    'Pyramimonas' : 'Pyramimonas longicauda',
    'clusterflagellate' : 'Corymbellus',
    'kiteflagellates' : 'Chrysochromulina lanceolata',
}

def parseBinToTargets(bin, timeseries):
    targets = {}

    t = time.time()
    while os.path.isfile(TARGETS_CACHE_PATH + '/' + bin + '_temp'):
        if time.time() - t > 30: # 30 second timeout before just trying to download the file again
            break
        time.sleep(1)

    if areTargetsCached(bin):
        with open(TARGETS_CACHE_PATH + '/' + bin) as f:
            return json.load(f)
    else:
        # create the temp file first so we know it's being downloaded
        f = open(TARGETS_CACHE_PATH + '/' + bin + '_temp', 'w+')
        f.close()

        logging.info('started downloading: ' + timeseries + bin + '_roisizes')
        with closing(requests.get(timeseries + bin + '_roisizes', stream=True)) as r:
            if r.status_code == 404:
                logging.error('Invalid bin: ' + bin)
                return False
            data = json.loads(r.text)
            n = 0
            while n < len(data['targetNumber']):
                pid = bin + '_' + str(data['targetNumber'][n]).zfill(5)
                # reversed because regardless of how they go through IFCB, on display these values are backwards
                targets[pid] = {
                    'width' : data['height'][n],
                    'height' : data['width'][n],
                }
                n += 1
        with open(TARGETS_CACHE_PATH + '/' + bin + '_temp', 'w') as f:
            json.dump(targets, f)
        os.rename(TARGETS_CACHE_PATH + '/' + bin + '_temp', TARGETS_CACHE_PATH + '/' + bin)
        logging.info('finished downloading: ' + timeseries + bin + '_roisizes')
        return targets

# dictionary with key = values:
# pid = {'height' : height, 'width' : width}
def getTargets(bins, timeseries):
    targets = {}
    for bin in bins:
        logging.info('[SERVING] ' + bin + '...')
        if areTargetsCached(bin):
            with open(TARGETS_CACHE_PATH + '/' + bin) as f:
                new_targets = json.load(f)
        else:
            new_targets = parseBinToTargets(bin, timeseries)
        if new_targets == False:
            return False
        targets.update(new_targets)
    return targets

def areTargetsCached(bin):
    return os.path.isfile(TARGETS_CACHE_PATH + '/' + bin)

def formatROI(roi):
    roi_s = str(roi)
    while len(roi_s) != 5:
        roi_s = '0' + roi_s
    return roi_s

def getUserPower(user_id):
    user = User.objects.get(id=user_id)
    if user is None:
        return -1
    return user.get_user_power()

def getUserName(user_id):
    user = User.objects.get(id=user_id)
    if user is None:
        return None
    return user.username

def isZipDownloaded(bin):
    return os.path.isfile(ZIP_CACHE_PATH + '/' + bin + '.zip')

def getZipForBin(bin, timeseries):
    if not isZipDownloaded(bin):
        downloadZipForBin(bin, timeseries)
    return open(ZIP_CACHE_PATH + '/' + bin + '.zip', 'rb').read()

def downloadZipForBin(bin, timeseries):
    if not isZipDownloaded(bin):
        logging.info('started downloading: ' + timeseries + bin + '.zip')
        # create the file first, just so we know it's being downloaded
        f = open(ZIP_CACHE_PATH + '/' + bin + '_temp.zip', 'w+')
        f.close()
        r = requests.get(timeseries + bin + '.zip')
        with open(ZIP_CACHE_PATH + '/' + bin + '_temp.zip', 'wb') as f:
            f.write(r.content)
        if os.path.getsize(ZIP_CACHE_PATH + '/' + bin + '_temp.zip') > 0:
            os.rename(ZIP_CACHE_PATH + '/' + bin + '_temp.zip', ZIP_CACHE_PATH + '/' + bin + '.zip')
            logging.info('finished downloading: ' + timeseries + bin + '.zip')
        else:
            os.remove(ZIP_CACHE_PATH + '/' + bin + '_temp.zip')
            logging.error('failed to download zip for bin: ' + timeseries + bin + '.zip')
            print("error")

def areAutoResultsCached(bin):
    return os.path.isfile(AUTO_RESULTS_CACHE_PATH + '/' + bin)

def removeDuplicates(arr):
    seen = set()
    result = []
    for item in arr:
        if item in seen: continue
        seen.add(item)
        result.append(item)
    return result

# reads class scores csv file and interprets the highest score as being the "auto classifier's choice"

# Param 1: a string, representing the name of the bin to read scores for
# Output: a dictionary, indexed by pid, with string values representing the name of the winner class for that pid

def getAutoResultsForBin(bin, timeseries):
    classifications = {}
    path = timeseries + bin + '_class_scores.csv'

    logging.info('started downloading: ' + path)
    with closing(requests.get(path, stream=True)) as r:
        if r.status_code == 404:
            logging.info('no auto results available at: ' + path)
            return None
        reader = csv.reader(codecs.iterdecode(r.iter_lines(), 'utf-8'), delimiter=',')
        headers = next(reader)
        try:
            pid_index = headers.index('pid')
        except:
            return None
        for row in reader:
            i = 0
            winner = None
            for col in row:
                if i == pid_index:
                    i += 1
                    continue
                v = float(col)
                if not winner:
                    winner = (headers[i], v)
                else:
                    if v > winner[1]:
                        winner = (headers[i], v)
                i += 1
            classifications[row[pid_index]] = winner[0]
        logging.info('finished downloading: ' + path)
    return classifications

# gets all bin names for a timeseries in a date range

# Param 1: a datetime object representing the beginning of the time range to find bins in
# Param 2: a datetime object representing the end of the time range
# Param 3: a string representing a timeseries url
# Output: an array of strings, representing bin names in the time range
def getBinsInRange(start, end, timeseries):
    start = start.strftime('%Y-%m-%dT%H:%M:00')
    end = end.strftime('%Y-%m-%dT%H:%M:00')
    url = timeseries + '/api/feed/temperature/start/' + start + '/end/' + end
    bins = []
    with closing(requests.get(url, stream=True)) as r:
        data = json.loads(r.text)
        for dict in data:
            bins.append(binWithoutTimeseries(timeseries, dict['pid']))
    return bins

def binWithoutTimeseries(ts, bin):
    bin = bin.replace(ts, '')
    ts_alt = None
    if ts.find("https") >= 0:
        ts_alt = ts.replace("https", "http")
    else:
        ts_alt = ts.replace("http", "https")
    return bin.replace(ts_alt, '')
