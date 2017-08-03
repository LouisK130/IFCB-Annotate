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
	var ts = document.getElementById('MCTimeSeries').value;
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

document.getElementById('MCBinsSubmit').onclick = function() {
	submitForm(true);
}

document.getElementById('MCBinsSubmitAndImport').onclick = function() {
	submitForm(false);
}

function submitForm(raw) {
	var bins_string = '';
	var options = document.getElementById('MCBins').options;
	for (var n = 0; n < options.length; n++) {
		bins_string += options[n].text + ',';
	}
	bins_string = bins_string.substring(0, bins_string.length - 1);
	if (bins_string == '')
		return;
	var form = document.createElement('form');
	form.action = '/classify/';
	form.method = 'POST';
	var input1 = document.createElement('input');
	input1.type = 'hidden';
	input1.name = 'bins';
	input1.value = bins_string;
	var input2 = document.createElement('input');
	input2.type = 'hidden';
	input2.name = 'timeseries';
	input2.value = document.getElementById('MCTimeSeries').value;
	var input3 = document.createElement('input');
	input3.type = 'hidden';
	input3.name = 'import';
	input3.value = !raw
	form.appendChild(input1);
	form.appendChild(input2);
	form.appendChild(input3);
	form.insertAdjacentHTML('beforeend', csrf_token_form);
	document.body.appendChild(form);
	form.submit();
}

function addBins(text) {
	var container = document.getElementById('MCBins');
	var bins = text.split(',');
	outerLoop:
		for (var j = 0; j < bins.length; j++) {
			var bin = bins[j].trim();
			var i = bin.lastIndexOf('/');
			var url = bin.substring(0, i+1);
			bin = bin.substring(i+1, bin.length);
			for (var n = 0; n < container.options.length; n++) {
				if (container.options[n].value == bin)
					continue outerLoop;
			}
			var option = document.createElement('option');
			option.text = bin;
			option.value = bin;
			document.getElementById('MCBins').add(option);
			document.getElementById('MCTimeSeries').value = url;
		}
}