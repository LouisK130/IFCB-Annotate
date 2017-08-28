if (failed != '') {
	var failure = document.createElement('div')
	failure.innerHTML = failed;
	failure.style.whiteSpace = 'pre';
	failure.style.color = 'red';
	failure.style.marginBottom = '0px';
	failure.style.marginTop = '5px';
	var children = document.body.children;
	document.body.insertBefore(failure, children[children.length-1]); // not working as expected
}

var last_ts = getLastTimeseries();
var ts = document.getElementById('MCTimeSeries');
for (var n = 0; n < ts.options.length; n++) {
	if (ts.options[n].value == last_ts) {
		ts.selectedIndex = n;
		break;
	}
}

var recent_bins = getRecentBins();
var recentBinsEle = document.getElementById('MCRecentBinsSelect');
for (var n = 0; n < recent_bins.length; n++) {
	var option = document.createElement('option');
	option.text = recent_bins[n];
	option.value = recent_bins[n];
	recentBinsEle.add(option);
}

document.getElementById('MCRecentBinsAddBtn').onclick = clickAddRecent;

function clickAddRecent() {
	var options = document.getElementById('MCRecentBinsSelect').options;
	for(var n = 0; n < options.length; n++) {
		if (options[n].selected) {
			addBins(options[n].value);
			options[n].outerHTML = '';
			return;
		}
	}
}

if (recent_bins.length == 0) {
	document.getElementById('MCRecentBinsDiv').outerHTML = '';
}

document.getElementById('MCBinsAddBtn').onclick = clickAddManual;

function clickAddManual() {
	var ele = document.getElementById('MCBinsText');
	var text = ele.value;
	if (text.length > 0) {
		addBins(text);
	}
	ele.value = '';
}

document.getElementById('MCBinsRemoveBtn').onclick = clickRemoveBin;

function clickRemoveBin() {
	var options = document.getElementById('MCBins').options;
	for(var n = 0; n < options.length; n++) {
		if (options[n].selected) {
			for (var i = 0; i < recent_bins.length; i++) {
				if (recent_bins[i].indexOf(options[n].text) >= 0) {
					var option = document.createElement('option');
					option.text = recent_bins[i];
					option.value = recent_bins[i];
					recentBinsEle.add(option);
				}
			}
			options[n].outerHTML = '';
			return;
		}
	}
}

function addBins(text) {
	var container = document.getElementById('MCBins');
	var bins = text.split(',');
	var ts = document.getElementById('MCTimeSeries');
	ts = ts.options[ts.selectedIndex].value;
	outerLoop:
		for (var j = 0; j < bins.length; j++) {
			var bin = bins[j].trim();
			bin = bin.replace(ts, '')
			for (var n = 0; n < container.options.length; n++) {
				if (container.options[n].value == bin)
					continue outerLoop;
			}
			var option = document.createElement('option');
			option.text = bin;
			option.value = bin;
			document.getElementById('MCBins').add(option);
		}
}

document.getElementById('MCBinsSubmit').onclick = function() {
	submitForm(true);
}

document.getElementById('MCBinsSubmitAndImport').onclick = function() {
	submitForm(false);
}

document.getElementById('MCBatchMode').onclick = function() {
	if (this.checked)
		document.getElementById('MCBatchModeOptions').style.display = 'block';
	else
		document.getElementById('MCBatchModeOptions').style.display = 'none';
}

document.getElementById('MCBatchSize').value = getBatchSize();

function submitForm(raw) {
	var bins_string = '';
	var batchmode = document.getElementById('MCBatchMode').checked;
	var batchSize = batchmode ? document.getElementById('MCBatchSize').value : null;
	
	var options = document.getElementById('MCBins').options;
	for (var n = 0; n < options.length; n++) {
			bins_string += options[n].text + ',';
	}
	
	bins_string = bins_string.substring(0, bins_string.length - 1);
	
	if (bins_string == '' && !batchmode)
		return;

	var ts = document.getElementById('MCTimeSeries');
	ts = ts.options[ts.selectedIndex].value;
	setLastTimeseries(ts);
	
	var form = document.createElement('form');
	form.action = '/classify/';
	form.method = 'POST';
	
	form.appendChild(createInput('bins', bins_string));
	form.appendChild(createInput('timeseries', ts));
	form.appendChild(createInput('import', !raw));
	form.appendChild(createInput('batchmode', batchmode));
	
	if (batchmode) {
		
		var bstart = document.getElementById('MCBatchStart').value;
		var bend = document.getElementById('MCBatchEnd').value;

		form.appendChild(createInput('batchsize', batchSize));
		
		if (bstart != '' && bend != '') {
			form.appendChild(createInput('batchstart', document.getElementById('MCBatchStart').value))
			form.appendChild(createInput('batchend', document.getElementById('MCBatchEnd').value))
		}
		
		form.appendChild(createInput('batchclass', document.getElementById('MCBatchClass').value))
		form.appendChild(createInput('batchtag', document.getElementById('MCBatchTag').value))
		
		setBatchSize(batchSize);
		
	}
	
	form.insertAdjacentHTML('beforeend', csrf_token_form);
	document.body.appendChild(form);
	
	form.submit();
}