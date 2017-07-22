import requests
import re
import csv
import json
import codecs
from contextlib import closing
from xml.etree import ElementTree
from classify import database, config
import os

if not os.path.exists('classify/zip_cache'):
	os.mkdir('classify/zip_cache')
	
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
	
def verifyBins(str):
	list = re.split(',', str)
	if not list:
		list = [str]
	bins = []
	failures = []
	for s in list:
		if len(s) == 0:
			continue
		if s[0] == 'I' and len(s) == 21:
			bins.append(s)
		elif s[0] == 'D' and len(s) == 24:
			bins.append(s)
		else:
			failures.append(s)
	for bin in bins:
		url = timeseries + bin
		try:
			r = requests.get(url)
			if r.status_code == 404:
				failures.append(bin)
		except:
			failures.append(bin)
	return (bins, failures)
	
def parseBinToTargets(bin):
	targets = {}
	with closing(requests.get(timeseries + bin + '.csv', stream=True)) as r:
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
	return targets
	
# dictionary with key = values:
# pid = {'height' : height, 'width' : width}
def getTargets(bins):
	targets = {}
	for bin in bins:
		print('parsing bin: ' + bin)
		targets = {**targets, **parseBinToTargets(bin)}
	return targets

def formatROI(roi):
	roi_s = str(roi)
	while len(roi_s) != 5:
		roi_s = '0' + roi_s
	return roi_s
	
def getZipForBin(bin):
	if not os.path.isfile('classify/zip_cache/' + bin + '.zip'):
		downloadZipForBin(bin)
	return open('classify/zip_cache/' + bin + '.zip', 'rb').read()
	
def downloadZipForBin(bin):
	print('started downloading: ' + timeseries + bin + '.zip')
	r = requests.get(timeseries + bin + '.zip')
	with open('classify/zip_cache/' + bin + '.zip', 'wb') as f:
		f.write(r.content)
	print('finished downloading: ' + timeseries + bin + '.zip')
	
def getAutoResultsForBin(bin):
	classifications = {}
	path = timeseries + bin + '_class_scores.csv'
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
	return classifications
	
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
			if classification_id and data[pid] and not 'classification_id' in data[pid]:
				data[pid]['classification_id'] = classification_id
				data[pid]['user_id']  = -1;
				data[pid]['user_power'] = -1;
				if classification == 'Thalassiosira_dirty':
					print('adding dirty tag')
					tag_id = None
					for t in tags:
						if t['name'] == 'external detritus':
							tag_id = t['id']
					data[pid]['tags'] = [{
						'pid' : pid,
						'user_id' : -1,
						'user_power' : -1,
						'time' : 0,
						'tag_id' : tag_id,
						'level' : 1
					}]
	return data