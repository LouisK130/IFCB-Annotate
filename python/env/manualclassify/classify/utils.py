# Point to webservices
web_services_path = "http://ifcb-data.whoi.edu/mvco/"
other_classification_id = 1 # updates automatically when classify.html is served by views.py

import requests
import re
import csv
import json
import codecs
from contextlib import closing
from xml.etree import ElementTree
from classify import database

def splitBinsAndPids(str):
	both = re.split(',', str)
	if not both:
		both = [str]
	pids = []
	bins = []
	for s in both:
		if len(s) == 0:
			continue
		s = s.replace(' ', '')
		s_cut = s.replace(web_services_path, '')
		if s_cut[0] == 'I':
			if len(s_cut) == 21:
				bins.append(s)
			elif len(s_cut) == 27:
				pids.append(s)
			else:
				print("[WARNING] Invalid bin/pid specified: " + s)
		elif s_cut[0] == 'D':
			if len(s_cut) == 24:
				bins.append(s)
			elif len(s_cut) == 30:
				pids.append(s)
			else:
				print("[WARNING] Invalid bin/pid specified: " + s)
		else:
			print("[WARNING] Invalid bin/pid specified: " + s)
	return (bins, pids)
	
# dictionary of format:
# pid = height
def parseBinToPids(bin):
	pids = {}
	with closing(requests.get(web_services_path + bin + '.csv', stream=True)) as r:
		reader = csv.reader(codecs.iterdecode(r.iter_lines(), 'utf-8'), delimiter=',')
		headers = next(reader)
		pid_index = headers.index('pid')
		width_index = headers.index('width')
		height_index = headers.index('height')
		for row in reader:
			data = {'width' : int(row[width_index]), 'height' : int(row[height_index])}
			pids[row[pid_index]] = data
	return pids
	
# dictionary of format:
# pid = height
def getTargets(str):
	bins, misfit_pids = splitBinsAndPids(str)
	targets = {}
	#for pid in misfit_pids:
	#	data = json.loads(requests.get(web_services_path + pid + '.json').text)
	#	targets[pid] = data['width']
	for bin in bins:
		print('parsing bin: ' + bin)
		targets = {**targets, **parseBinToPids(bin)}
	return (bins, misfit_pids, targets)

def formatROI(roi):
	roi_s = str(roi)
	while len(roi_s) != 5:
		roi_s = '0' + roi_s
	return roi_s