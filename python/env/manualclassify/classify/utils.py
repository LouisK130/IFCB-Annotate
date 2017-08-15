import requests
import csv
import codecs
from contextlib import closing
import os
from classify import database
from django.contrib.auth.models import User
import json

ZIP_CACHE_PATH = 'classify/cache/zips'
TARGETS_CACHE_PATH = 'classify/cache/targets'
AUTO_RESULTS_CACHE_PATH = 'classify/cache/class_scores'

if not os.path.exists(ZIP_CACHE_PATH):
	os.mkdir(ZIP_CACHE_PATH)
if not os.path.exists(TARGETS_CACHE_PATH):
	os.mkdir(TARGETS_CACHE_PATH)
if not os.path.exists(AUTO_RESULTS_CACHE_PATH):
	os.mkdir(AUTO_RESULTS_CACHE_PATH)
	
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
	'dino30' : 'Dinoflagellata',
	'Lauderia' : 'Lauderia annulata',
	'Cerataulina' : 'Cerataulina pelagica',
	'Paralia' : 'Paralia sulcata',
	'ciliate_mix' : 'Ciliate mix',
	'Laboea' : 'Laboea strobila',
	'Myrionecta' : 'Mesodinium sp',
	'tintinnid' : 'Tintinnida',
	'Pyramimonas' : 'Pyramimonas longicauda',
}
	
def parseBinToTargets(bin):
	targets = {}
	
	with closing(requests.get(timeseries + bin + '.csv', stream=True)) as r:
		if r.status_code == 404:
			return False
		reader = csv.reader(codecs.iterdecode(r.iter_lines(), 'utf-8'), delimiter=',')
		headers = next(reader)
		pid_index = headers.index('pid')
		# reversed because regardless of how they go through IFCB, on display these values are backwards
		width_index = headers.index('height')
		height_index = headers.index('width')
		for row in reader:
			data = {'width' : int(row[width_index]), 'height' : int(row[height_index])}
			pid = row[pid_index].replace(timeseries, '')
			targets[pid] = data
	with open(TARGETS_CACHE_PATH + '/' + bin, 'w') as f:
		json.dump(targets, f)
	return targets
	
# dictionary with key = values:
# pid = {'height' : height, 'width' : width}
def getTargets(bins):
	targets = {}
	for bin in bins:
		if os.path.isfile(TARGETS_CACHE_PATH + '/' + bin):
			print('loading targets from cache: ' + bin)
			with open(TARGETS_CACHE_PATH + '/' + bin) as f:
				new_targets = json.load(f)
		else:
			print('fetching bin from dashboard: ' + bin)
			new_targets = parseBinToTargets(bin)
		if new_targets == False:
			return False
		targets = {**targets, **parseBinToTargets(bin)}
	return targets

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
	
def getZipForBin(bin):
	if not isZipDownloaded(bin):
		downloadZipForBin(bin)
	return open(ZIP_CACHE_PATH + '/' + bin + '.zip', 'rb').read()
	
def downloadZipForBin(bin):
	print('started downloading: ' + timeseries + bin + '.zip')
	r = requests.get(timeseries + bin + '.zip')
	with open(ZIP_CACHE_PATH + '/' + bin + '.zip', 'wb') as f:
		f.write(r.content)
	print('finished downloading: ' + timeseries + bin + '.zip')

# reads class scores csv file and interprets the highest score as being the "auto classifier's choice"

# Param 1: a string, representing the name of the bin to read scores for
# Output: a dictionary, indexed by pid, with string values representing the name of the winner class for that pid

def getAutoResultsForBin(bin):
	classifications = {}
	path = timeseries + bin + '_class_scores.csv'
	if os.path.isfile(AUTO_RESULTS_CACHE_PATH + '/' + bin):
		print('loading auto results from cache: ' + bin)
		with open(AUTO_RESULTS_CACHE_PATH + '/' + bin) as f:
			classifications = json.load(f)
	else:
		print('fetching auto results from dashboard: ' + bin)
		with closing(requests.get(path, stream=True)) as r:
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
					if not winner:
						winner = (headers[i], col)
					else:
						if col > winner[1]:
							winner = (headers[i], col)
					i += 1
				classifications[row[pid_index]] = winner[0]
		with open(AUTO_RESULTS_CACHE_PATH + '/' + bin, 'w') as f:
			json.dump(classifications, f)
	return classifications

# adds annotations based on the auto classifier results to the data being prepared for passing to the client

# Param 1: an array of strings, each representing a bin that's included in the data
# Param 2: an array with dictionary values; in each dictionary are "name", "id", and "international_id" keys representing values
# 	for a given classification label
# Param 3: an array with dictionary values; in each dictionary are "name" and "id" keys representing values
#	for a given tag label
# Param 4: a dictionary, indexed by pid and produced by database.getAllDataForBins(), containing all annotations for the given bins
# Output: the same dictionary given in Param 4, modified to include annotations from the auto classifier

def addClassifierData(bins, classes, tags, data):
	for bin in bins:
		auto_results = getAutoResultsForBin(bin)
		if not auto_results:
			continue;
		for pid, classification in auto_results.items():
			classification_id = None
			new_name = None
			if classification in CLASSIFIER_CONVERSION_TABLE:
				new_name = CLASSIFIER_CONVERSION_TABLE[classification]
			else:
				new_name = classification.replace('_', ' ')
			for c in classes:
				if c['name'] == new_name:
					classification_id = c['id']
			if pid in data:
				dict = {
					'user_id' : -1,
					'classification_id' : classification_id,
					'level' : 1,
					'timeseries_id' : database.getTimeseriesId(timeseries),
					'user_power' : -1,
					'username' : 'auto',
				}
				if not 'accepted_classification' in data[pid]:
					data[pid]['accepted_classification'] = dict
				else:
					data[pid]['other_classifications'].append(dict)
				# this is a special case, where the classifier also annotates an 'external detritus' tag
				if classification == 'Thalassiosira_dirty':
					tag_id = None
					for t in tags:
						if t['name'] == 'external detritus':
							tag_id = t['id']
					if tag_id:
						dict = {
							'user_id' : -1,
							'tag_id' : tag_id,
							'user_power' : -1,
							'level' : 1,
							'timeseries_id' : database.getTimeseriesId(timeseries),
							'username' : 'auto',
						}
						data[pid]['tags'].append(dict)
					else:
						print('[WARNING] Classifier attempted to annotate Thalassiosira_dirty but no external_detritus tag was found!')
	return data