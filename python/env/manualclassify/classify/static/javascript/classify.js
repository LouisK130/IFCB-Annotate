var classification_updates = {};
var tag_updates = {};

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
var current_targets = [];

// change current view to different classification
var classSelect = document.getElementById('MCClassificationSelection');
classSelect.value = 1;
classSelect.onchange = reloadTargets;

var tagSelect = document.getElementById('MCTagSelection');
tagSelect.value = 'ALL';
tagSelect.onchange = reloadTargets;

// redo layout when window is resized
var timeout = setTimeout(layoutMosaic, 0); // define the timer and call layout once immediately
document.body.onresize = function() {
	clearTimeout(timeout);
	timeout = setTimeout(layoutMosaic, 200);
}

setTimeout(function() {
	reloadTargets();
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
		var disabledElement = document.getElementById('MCDisablePage');
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

function reloadTargets() {
	var c_select = document.getElementById('MCClassificationSelection');
	var t_select = document.getElementById('MCTagSelection');
	classification_updates = {};
	target_counter = 0;
	loaded = 0;
	var include_unclassified = c_select.options[c_select.selectedIndex].text.substring(0,5) == 'other';
	current_targets = getTargetsInCategory(c_select.value, t_select.value, include_unclassified);
	updateLoadedCounter();
	updateAppliedCounter();
	var targets = document.getElementsByClassName('MCTarget');
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

function layoutMosaic() {
	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	var targetContainer = document.getElementById('MCTargetContainer');
	var targetContainerX = targetContainer.getBoundingClientRect().left;
	width = width - targetContainerX - 20; // ensures there's no extra horizontal scrollbar
	targetContainer.style.width = width;
	targetContainer.style.height = height - 10;
	var targets = document.getElementsByClassName('MCTarget');
	width -= 5;
	for (var n = 0; n < targets.length; n++) {
		var target = targets.item(n);
		var pid = target.id.replace('MCTarget_', '');
		var img = document.getElementById('MCImg_' + pid);
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
	var targetContainer = document.getElementById('MCTargetContainer');
	var tile = document.createElement('div');
	tile.classList.add('MCTarget');
	tile.id = 'MCTarget_' + pid;
	tile.style.cursor = 'crosshair';
	tile.userSelect = 'none';

	if (width > targetContainer.offsetWidth - 5) {
		var width_new = targetContainer.offsetWidth - 5;
		height = (width_new / width) * height;
		width = width_new;
	}
	
	tile.onclick = function() {
		applyToTile(this);
	}
	
	var img = document.createElement('img');
	img.classList.add('MCImg');
	img.id = 'MCImg_' + pid;
	img.height = height;
	img.width = width;
	loadImageForPid(pid, img);
	img.draggable = false;
	
	img.onmousedown = function(e) {
		if (e.preventDefault)
			e.preventDefault();
	}
	
	var newClassification = document.createElement('div');
	newClassification.classList.add('MCNewClassification');
	newClassification.id = 'MCNewClassification_' + pid;
	
	var newTag = document.createElement('div');
	newTag.classList.add('MCNewTag');
	newTag.id = 'MCNewTag_' + pid;
	
	tile.appendChild(newTag);
	tile.appendChild(newClassification);
	tile.appendChild(img);
	targetContainer.appendChild(tile);
	return tile;
}

function applyToTile(tile) {
	var pid = tile.id.replace('MCTarget_', '');
	var filter = document.getElementById('MCClassificationSelection').value;
	var clas = document.getElementById('ClassificationApplicationSelection').value;
	var tag = document.getElementById('TagApplicationSelection').value;
	var verify_other = false;
	var verify_other_tag = false;
	for(var n = 0; n < current_targets.length; n++) {
		if (current_targets[n]['pid'] == pid) {
			if ('other_classifications' in current_targets[n]) {
				for(var z = 0; z < current_targets[n]['other_classifications'].length; z++) {
					var c = current_targets[n]['other_classifications'][z]
					if (c['classification_id'] == clas) {
						if (user_id == c['user_id']) {
							verify_other = true;
						}
					}
				}
			}
			if ('tags' in current_targets[n]) {
				for (var z = 0; z < current_targets[n]['tags'].length; z++) {
					var t = current_targets[n]['tags'][z];
					if (t['tag_id'] == tag && user_id == t['user_id']) {
						verify_other_tag = true;
					}
				}
			}
		}
	}

	var c_label = document.getElementById('MCNewClassification_' + pid)
	var t_label = document.getElementById('MCNewTag_' + pid)
	if (clas == 'CLEAR') {
		delete classification_updates[pid];
		c_label.innerHTML = '';
	}
	else if (clas != '') {
		classification_updates[pid] = clas;
		c_label.style.color = 'red';
		tile.style.outlineColor = 'black';
		if (clas == filter)
			c_label.innerHTML = '<small><b>V</b></small>';
		else if (verify_other)
			c_label.innerHTML = '<small><b>V: ' + clas + '</b></small>';
		else
			c_label.innerHTML = '<b>' + clas + '</b>';
	}
	if (tag == 'CLEAR') {
		delete tag_updates[pid];
		t_label.innerHTML = '';
	}
	else if (tag != '') {
		tag_updates[pid] = tag;
		t_label.style.color = 'blue';
		if (verify_other_tag)
			t_label.innerHTML = '<small><b>V: ' + tag + '</b></small>';
		else
			t_label.innerHTML = '<b>' + tag + '</b>';
	}
	addRecentApplicationToCookies(clas, tag);
	updateAppliedCounter();
}

function submitUpdates() {
	if (Object.keys(classification_updates).length == 0 && Object.keys(tag_updates).length == 0)
		return;
	disablePage();
	var http = new XMLHttpRequest();
	http.open('POST', '/submitupdates/', true);
	http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	var params = 'csrfmiddlewaretoken=' + csrf_token + '&classifications=' + JSON.stringify(classification_updates) +'&tags=' + JSON.stringify(tag_updates) + '&timeseries=' + timeseries;
	http.send(params);
	http.onload = function() {
		var response;
		if (http.status == 200)
			response = JSON.parse(http.responseText);
		if (response && !(response['failure'])) {
			var new_targets = [];
			for (var n = 0; n < current_targets.length; n++) {
				var pid = current_targets[n]['pid'];
				var current_classification = document.getElementById('MCClassificationSelection').value;
				if (pid in tag_updates)
					document.getElementById('MCNewTag_' + pid).style.color = '#56f442';
				if (pid in classification_updates) {
					if (classification_updates[pid] == current_classification) {
						document.getElementById('MCTarget_' + pid).style.outlineColor = '#56f442';
						document.getElementById('MCNewClassification_' + pid).style.color = '#56f442';
						new_targets.push(current_targets[n]);
					}
					else {
						document.getElementById('MCTarget_' + pid).outerHTML = '';
						loaded--;
						target_counter--;
					}
				}
				else {
					new_targets.push(current_targets[n]);
				}
			}
			makeUpdatesToClassifications(response); // this function updates JS with results from DB
			current_targets = new_targets;
			classification_updates = {};
			tag_updates = {};
			updateLoadedCounter();
			updateAppliedCounter();
		}
		enablePage();
	}
}

function disablePage() {
	var overlay = document.createElement('div');
	overlay.id = 'MCDisablePage';
	overlay.style.width = '100%';
	overlay.style.height = '100%';
	overlay.style.backgroundColor = 'black';
	overlay.style.position = 'fixed';
	overlay.style.zIndex = '10';
	overlay.style.opacity = '.5';
	overlay.style.top = '0';
	overlay.style.left = '0';
	document.body.insertBefore(overlay, document.body.firstChild);
	document.getElementById('MCSubmitUpdates').innerHTML = 'Saving...';
}

function enablePage() {
	document.getElementById('MCDisablePage').outerHTML = '';
	document.getElementById('MCSubmitUpdates').innerHTML = 'Save Updates';
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
	var container = document.getElementById('MCTargetContainer');
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
	var label = document.getElementById('MCNumberLoadedLabel');
	label.innerHTML = loaded + ' loaded of ' + current_targets.length;
}

function updateAppliedCounter() {
	var cl = Object.keys(classification_updates).length;
	var tl = Object.keys(tag_updates).length;
	var label = document.getElementById('MCNumberAppliedLabel');
	label.innerHTML = cl + ' targets classified';
	label = document.getElementById('MCNumberTaggedLabel');
	label.innerHTML = tl + ' targets tagged';
	if (cl > 0 || tl > 0) {
		window.onbeforeunload = function() { return "" }
	}
	else {
		window.onbeforeunload = null;
	}
}