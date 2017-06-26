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
		width_index = headers.index('width')
		height_index = headers.index('height')
		for row in reader:
			data = {'width' : int(row[width_index]), 'height' : int(row[height_index])}
			targets[row[pid_index]] = data
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