var classification_updates = {};

var set_size = getCookie('MCSetSize');
if (set_size == "")
	set_size = 100;
document.getElementById('MCSetSize').value = set_size

for(var n = 0; n < bins.length; n++) {
	addRecentBinToCookies(bins[n]);
	downloadZip(bins[n]);
}

var target_counter = 0;
var loaded = 0;
var current_targets = getTargetsInCategory(1);

// change current view to different classification
var classSelect = document.getElementById('IFCBClassificationSelection');
classSelect.value = 1;
classSelect.onchange = function() {
	classification_updates = {};
	target_counter = 0;
	loaded = 0;
	var include_unclassified = this.options[this.selectedIndex].text.substring(0,5) == 'other';
	current_targets = getTargetsInCategory(classSelect.value, include_unclassified);
	updateLoadedCounter();
	updateAppliedCounter();
	var targets = document.getElementsByClassName('IFCBTarget');
	var z = targets.length - 1; // don't update each loop
	for (var z = z; z >= 0; z--) {
		targets.item(z).outerHTML = '';
	}
	deleteLoadMoreButton();
	var set = parseInt(document.getElementById('MCSetSize').value);
	if (set <= 0)
		set = 100;
	loadMore(set);
}

// redo layout when window is resized
var timeout = setTimeout(layoutMosaic, 0); // define the timer and call layout once immediately
document.body.onresize = function() {
	clearTimeout(timeout);
	timeout = setTimeout(layoutMosaic, 200);
}

setTimeout(function() {
	var set = parseInt(document.getElementById('MCSetSize').value);
	if (set <= 0)
		set = 100;
	loadMore(set);
}, 50); // delayed because container needs time to size properly first

// load more when scrolled down
window.addEventListener("scroll", function(){
    var D = document;
	dHeight = Math.max(
        D.body.scrollHeight, D.documentElement.scrollHeight,
        D.body.offsetHeight, D.documentElement.offsetHeight,
        D.body.clientHeight, D.documentElement.clientHeight
    )
    var winheight= window.innerHeight || (document.documentElement || document.body).clientHeight
	var scrollTop = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop
    var trackLength = dHeight - winheight
	if (trackLength == scrollTop) {
		var disabledElement = document.getElementById('IFCBDisablePage');
		if (!disabledElement && loaded == target_counter) {
		var set = parseInt(document.getElementById('MCSetSize').value);
		if (set <= 0)
			set = 100;
		loadMore(target_counter+set);
		}
	}
}, false)

// update set size
var setSizeElement = document.getElementById('MCSetSize');
setSizeElement.onchange = function() {
	var set = parseInt(this.value);
	if (set <= 0)
		set = 100;
	setCookie('MCSetSize', set, 3650); // 10 years expiration...
}

// Above this is initialization
// Below this is function declarations

function layoutMosaic() {
	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	var targetContainer = document.getElementById('IFCBTargetContainer');
	var targetContainerX = targetContainer.getBoundingClientRect().left;
	width = width - targetContainerX - 20; // ensures there's no extra horizontal scrollbar
	targetContainer.style.width = width;
	targetContainer.style.height = height - 10;
	var targets = document.getElementsByClassName('IFCBTarget');
	width -= 5;
	for (var n = 0; n < targets.length; n++) {
		var target = targets.item(n);
		var img = target.children[1];
		if (img.naturalWidth > img.width || img.width > width) {
			img.width = Math.min(img.naturalWidth, width);
			img.height = img.width * (img.naturalHeight / img.naturalWidth);
		}
	}
	
	var div = document.getElementById('MCLoadMoreDiv');
	if (div)
		div.style.width = targetContainer.style.width;
	
	var btn = document.getElementById('MCLoadMore');
	if (btn)
		btn.style.width = (targetContainer.offsetWidth / 3) + 'px';
}

function createTile(pid, width, height) {
	var targetContainer = document.getElementById('IFCBTargetContainer');
	var tile = document.createElement('div');
	tile.classList.add('IFCBTarget');
	tile.id = 'IFCBTarget_' + pid;
	tile.style.cursor = 'crosshair';
	tile.userSelect = 'none';
	
	if (width > targetContainer.offsetWidth - 20) {
		var width_new = targetContainer.offsetWidth - 20;
		height = (width_new / width) * height;
		width = width_new;
	}
	
	tile.onclick = function() {
		var pid = this.id.replace('IFCBTarget_', '');
		var filter = document.getElementById('IFCBClassificationSelection').value;
		var val = document.getElementById('ClassificationApplicationSelection').value;
		var verify_other = false;
		for(var n = 0; n < current_targets.length; n++) {
			if (current_targets[n]['pid'] == pid && 'other_classifications' in current_targets[n]) {
				for(var z = 0; z < current_targets[n]['other_classifications'].length; z++) {
					var c = current_targets[n]['other_classifications'][z]
					if (c['classification_id'] == val) {
						if (user_id == c['user_id']) {
							verify_other = c['classification_id'];
						}
					}
				}
			}
		}
		var label = document.getElementById('IFCBNewClassification_' + pid)
		if (val == '' || (pid in classification_updates && val == classification_updates[pid])) {
			delete classification_updates[pid];
			label.innerHTML = '';
		}
		else if (val != '') {
			classification_updates[pid] = val;
			label.style.color = 'red';
			this.style.outlineColor = 'black';
			if (val == filter)
				label.innerHTML = '<small><b>VERIFIED</b></small>';
			else if (verify_other)
				label.innerHTML = '<small><b>VERIFIED: ' + verify_other + '</b></small>';
			else
				label.innerHTML = '<b>' + val + '</b>';
		}
		updateAppliedCounter();
	}
	
	var img = document.createElement('img');
	img.classList.add('IFCBImg');
	img.id = 'IFCBImg_' + pid;
	img.classification = document.getElementById('IFCBClassificationSelection').value;
	img.height = width;
	img.width = height;
	loadImageForPid(pid, img);
	img.draggable = false;
	
	var newClassification = document.createElement('div');
	newClassification.classList.add('IFCBNewClassification');
	newClassification.id = 'IFCBNewClassification_' + pid;
	
	tile.appendChild(newClassification);
	tile.appendChild(img);
	targetContainer.appendChild(tile);
	return tile;
}

function submitUpdates() {
	if (Object.keys(classification_updates).length == 0)
		return;
	disablePage();
	var http = new XMLHttpRequest();
	http.open('POST', '/submitupdates/', true);
	http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	var params = 'csrfmiddlewaretoken=' + csrf_token + '&updates=' + JSON.stringify(classification_updates);
	http.send(params);
	http.onload = function() {
		if (http.status == 200 && http.responseText != 'failure') {
			new_targets = [];
			for (var n = 0; n < current_targets.length; n++) {
				var pid = current_targets[n]['pid'];
				var current_classification = document.getElementById('IFCBClassificationSelection').value;
				if (pid in classification_updates) {
					if (classification_updates[pid] == current_classification) {
						document.getElementById('IFCBTarget_' + pid).style.outlineColor = '#56f442';
						document.getElementById('IFCBNewClassification_' + pid).style.color = '#56f442';
						new_targets.push(current_targets[n]);
					}
					else {
						document.getElementById('IFCBTarget_' + pid).outerHTML = '';
						loaded--;
						target_counter--;
					}
				}
				else {
					new_targets.push(current_targets[n]);
				}
			}
			makeUpdatesToClassifications(JSON.parse(http.responseText)); // this function updates JS with results from DB
			current_targets = new_targets;
			classification_updates = {};
			updateLoadedCounter();
			updateAppliedCounter();
		}
		enablePage();
	}
}

function disablePage() {
	var overlay = document.createElement('div');
	overlay.id = 'IFCBDisablePage';
	overlay.style.width = '100%';
	overlay.style.height = '100%';
	overlay.style.backgroundColor = 'black';
	overlay.style.position = 'fixed';
	overlay.style.zIndex = '10';
	overlay.style.opacity = '.5';
	overlay.style.top = '0';
	overlay.style.left = '0';
	document.body.insertBefore(overlay, document.body.firstChild);
	document.getElementById('IFCBSubmitUpdates').innerHTML = 'Saving...';
}

function enablePage() {
	document.getElementById('IFCBDisablePage').outerHTML = '';
	document.getElementById('IFCBSubmitUpdates').innerHTML = 'Save Updates';
}

function loadMore(n) {
	deleteLoadMoreButton();
	for (target_counter = target_counter; target_counter < current_targets.length; target_counter++) {
		if (target_counter >= n) {
			break;
		}
		var pid = current_targets[target_counter]['pid'];
		createTile(pid, current_targets[target_counter]['width'], current_targets[target_counter]['height']);
	}
	if (target_counter != current_targets.length)
		createLoadMoreButton();
}

function createLoadMoreButton() {
	var container = document.getElementById('IFCBTargetContainer');
	var div = document.createElement('div');
	div.id = 'MCLoadMoreDiv';
	div.style.textAlign = 'center';
	div.style.width = container.offsetWidth + 'px';
	var btn = document.createElement('button');
	btn.id = 'MCLoadMore';
	btn.innerHTML = 'Load More';
	btn.style.width = (container.offsetWidth / 3) + 'px';
	btn.onclick = function() {
		var set = parseInt(document.getElementById('MCSetSize').value);
		if (set <= 0)
			set = 100;
		loadMore(target_counter+set);
	}
	div.appendChild(btn);
	container.appendChild(div);
}

function deleteLoadMoreButton() {
	var div = document.getElementById('MCLoadMoreDiv');
	var btn = document.getElementById('MCLoadMore');
	if (div)
		div.outerHTML = '';
	if(btn)
		btn.outerHTML = '';
}

function updateLoadedCounter() {
	var label = document.getElementById('IFCBNumberLoadedLabel');
	label.innerHTML = loaded + ' loaded of ' + current_targets.length;
}

function updateAppliedCounter() {
	var label = document.getElementById('IFCBNumberAppliedLabel');
	label.innerHTML = Object.keys(classification_updates).length + ' targets updated';
}