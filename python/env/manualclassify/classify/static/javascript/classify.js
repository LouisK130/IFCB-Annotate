var classification_updates = {};
var set_size = getCookie('MCSetSize');
if (set_size == "")
	set_size = 100;
document.getElementById('MCSetSize').value = set_size

function layoutMosaic() {
	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	var targetContainer = document.getElementById('IFCBTargetContainer');
	var targetContainerX = targetContainer.getBoundingClientRect().left;
	width = width - targetContainerX - 20; // ensures there's no extra horizontal scrollbar
	targetContainer.style.width = width;
	targetContainer.style.height = height - 10;
	var targets = document.getElementsByClassName('IFCBTarget');
	for (var n = 0; n < targets.length; n++) {
		var target = targets.item(n);
		var img = target.children[1];
		if (img.naturalWidth > img.width) {
			var old_width = img.width;
			var new_width = Math.min(img.naturalWidth, width);
			img.width = new_width;
			img.height = img.height * (new_width / old_width);
		}
	}
}

function createTile(pid, width, height) {
	var targetContainer = document.getElementById('IFCBTargetContainer');
	var tile = document.createElement('div');
	tile.classList.add('IFCBTarget');
	tile.id = 'IFCBTarget_' + pid;
	tile.style.cursor = 'crosshair';
	tile.userSelect = 'none';
	
	if (width > targetContainer.offsetWidth - 20) {
		width_new = targetContainer.offsetWidth - 20;
		height = (width_new / width) * height;
		width = width_new;
	}
	
	tile.onclick = function() {
		var pid = this.id.replace('IFCBTarget_', '');
		var filterSelect = document.getElementById('IFCBClassificationSelection');
		var applySelect = document.getElementById('ClassificationApplicationSelection');
		var filter = filterSelect.value
		var val = applySelect.value
		var verify_other = false;
		for(var n = 0; n < classifications.length; n++) {
			if (classifications[n]['pid'] == pid && 'other_classifications' in classifications[n]) {
				for(var z = 0; z < classifications[n]['other_classifications'].length; z++) {
					var c = classifications[n]['other_classifications'][z]
					if (c['classification_id'] == val) {
						if (user_id == c['user_id']) {
							verify_other = c['classification_id'];
						}
					}
				}
			}
		}
		if (val == '' || (pid in classification_updates && val == classification_updates[pid])) {
			delete classification_updates[pid];
			document.getElementById('IFCBNewClassification_' + pid).innerHTML = '';
		}
		else if (val != '') {
			classification_updates[pid] = val;
			if (val == filter) {
				document.getElementById('IFCBNewClassification_' + pid).innerHTML = '<small><b>VERIFIED</b></small>';
			}
			else if (verify_other) {
				document.getElementById('IFCBNewClassification_' + pid).innerHTML = '<small><b>VERIFIED: ' + verify_other + '</b></small>'
			}
			else {
				document.getElementById('IFCBNewClassification_' + pid).innerHTML = '<b>' + val + '</b>';
			}
		}
		updateAppliedCounter();
	}
	
	var img = document.createElement('img');
	img.src = web_services_path + pid + '.png';
	img.classList.add('IFCBImg');
	img.id = 'IFCBImg_' + pid;
	img.height = width;
	img.width = height;
	img.onload = function() {
		loaded++;
		updateLoadedCounter()
	}
	// so if one image fails to load it doesn't stop all future loading...
	img.onerror = function() {
		loaded++;
		updateLoadedCounter()
	}
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
		if (http.status == 200) {
			new_classifications = [];
			for (var n = 0; n < classifications.length; n++) {
				var pid = classifications[n]['pid'];
				if (pid in classification_updates) {
					document.getElementById('IFCBTarget_' + pid).outerHTML = '';
					loaded--;
					i--;
				}
				else {
					new_classifications.push(classifications[n]);
				}
			}
			classifications = new_classifications;
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


var i = 0;
var loaded = 0;
function loadMore(n) {
	deleteLoadMoreButton();
	for (i = i; i < classifications.length; i++) {
		if (i >= n) {
			break;
		}
		var pid = classifications[i]['pid'];
		createTile(pid, classifications[i]['width'], classifications[i]['height']);
	}
	if (i != classifications.length)
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
		loadMore(i+set);
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
	label.innerHTML = loaded + ' loaded of ' + classifications.length;
}

function updateAppliedCounter() {
	var label = document.getElementById('IFCBNumberAppliedLabel');
	label.innerHTML = Object.keys(classification_updates).length + ' targets updated';
}

var classSelect = document.getElementById('IFCBClassificationSelection');
classSelect.value = classification_input;
classSelect.onchange = function() {
	var form = document.createElement('form');
	form.action = window.location.href;
	form.method = 'POST';
	var input1 = document.createElement('input');
	input1.type = 'hidden';
	input1.name = 'classification';
	input1.value = this.value;
	var input2 = document.createElement('input');
	input2.type = 'hidden';
	input2.name = 'pids';
	input2.value = pids_input;
	form.appendChild(input1);
	form.appendChild(input2);
	form.insertAdjacentHTML('beforeend', csrf_token_form);
	document.body.appendChild(form);
	form.submit();
}

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
		if (!disabledElement && loaded == i) {
		var set = parseInt(document.getElementById('MCSetSize').value);
		if (set <= 0)
			set = 100;
		loadMore(i+set);
		}
	}
}, false)

var setSizeElement = document.getElementById('MCSetSize');
setSizeElement.onchange = function() {
	var set = parseInt(this.value);
	if (set <= 0)
		set = 100;
	setCookie('MCSetSize', set, 3650); // 10 years expiration...
}

var mouseX1;
var mouseY1;
window.addEventListener('mousedown', function(event) {
	var ele = event.target || event.srcElement;
	if (!(ele == document.body ||
		ele.classList.contains('IFCBTarget') ||
		ele.classList.contains('IFCBImg') ||
		ele.id == 'IFCBTargetContainer')) {
		return;
	}
	mouseX1 = event.clientX;
	mouseY1 = event.clientY;
	var box = document.createElement('div');
	box.id = 'MCSelectAreaBox';
	box.style.outlineStyle = 'solid';
	box.style.outlineWidth = '1px';
	box.style.outlineColor = 'red';
	box.style.position = 'fixed';
	box.style.left = mouseX1 + 'px';
	box.style.top = mouseY1 + 'px';
	box.style.backgroundColor = 'rgba(0,0,0,.5)';
	document.body.appendChild(box);
});
window.addEventListener('mousemove', function(event) {
	if (mouseX1) { // means mouse is down
		var box = document.getElementById('MCSelectAreaBox');
		if (event.clientX < mouseX1) {
			box.style.left = event.clientX + 'px';
			box.style.width = mouseX1 - event.clientX;
		}
		else {
			box.style.width = event.clientX - mouseX1;
		}
		if (event.clientY < mouseY1) {
			box.style.top = event.clientY + 'px';
			box.style.height = mouseY1 - event.clientY;
		}
		else {
			box.style.height = event.clientY - mouseY1;
		}
	}
});
window.addEventListener('mouseup', function(event) {
	var targets = document.getElementsByClassName('IFCBTarget');
	var box = document.getElementById('MCSelectAreaBox');
	for(var n = 0; n < targets.length; n++) {
		var target = targets.item(n);
		if (isClippedByBox(target, box))
			target.click();
	}
	mouseX1 = null;
	mouseY1 = null;
	if (box)
		box.outerHTML = '';
});

for(var n = 0; n < bins.length; n++) {
	addRecentBinToCookies(bins[n]);
}