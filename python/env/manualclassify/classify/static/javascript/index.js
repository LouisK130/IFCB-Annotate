if (failed == 'True') {
	var failure = document.createElement('div')
	failure.innerHTML = 'Please include at least 1 valid bin';
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
			addBin(options[n].value);
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
		addBin(text);
	}
	ele.value = '';
}

document.getElementById('MCBinsRemoveBtn').onclick = clickRemoveBin;

function clickRemoveBin() {
	var options = document.getElementById('MCBins').options;
	for(var n = 0; n < options.length; n++) {
		if (options[n].selected) {
			if (recent_bins.indexOf(options[n].text) >= 0) {
				var option = document.createElement('option');
				option.text = options[n].text;
				option.value = options[n].text;
				recentBinsEle.add(option);
			}
			options[n].outerHTML = '';
			return;
		}
	}
}

document.getElementById('MCBinsSubmit').onclick = submitForm;

function submitForm() {
	var bins_string = '';
	var options = document.getElementById('MCBins').options;
	for (var n = 0; n < options.length; n++) {
		bins_string += options[n].text + ',';
	}
	bins_string = bins_string.substring(0, bins_string.length - 1);
	console.log(bins_string);
	var form = document.createElement('form');
	form.action = '/classify/';
	form.method = 'POST';
	var input1 = document.createElement('input');
	input1.type = 'hidden';
	input1.name = 'pids';
	input1.value = bins_string;
	form.appendChild(input1);
	form.insertAdjacentHTML('beforeend', csrf_token_form);
	document.body.appendChild(form);
	form.submit();
}

function addBin(bin) {
	var container = document.getElementById('MCBins');
	for (var n = 0; n < container.options.length; n++) {
		if (container.options[n].value == bin)
			return
	}
	var option = document.createElement('option');
	option.text = bin;
	option.value = bin;
	document.getElementById('MCBins').add(option);
}