import os
for root, dirs, filenames in os.walk('D:/GitHub/Manual-Classify/python/tools/annotations_csv_May2017/'):
	for f in filenames:
		fn = os.path.join(root, f)
		with open(fn, 'r') as file:
			data = file.readlines()
		newdata = []
		for line in data:
			k = line.rfind('_')
			i = line.rfind('/')
			line = line[i+1:k] + ',' + line[k+1:]
			newdata.append(line)
		with open(fn, 'w') as file:
			file.writelines(newdata)