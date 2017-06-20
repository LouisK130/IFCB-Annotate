import os
for root, dirs, filenames in os.walk('C:/Users/Louis/Desktop/Whoi Dashboard/csv/bins,rois'):
	for f in filenames:
		fn = os.path.join(root, f)
		with open(fn, 'r') as file:
			data = file.readlines()
		newdata = []
		for line in data:
			k = line.rfind('_')
			line = line[:k] + ',' + line[k+1:]
			newdata.append(line)
		with open(fn, 'w') as file:
			file.writelines(newdata)