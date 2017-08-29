var target_img_sources = {};
var zips = {};
var queued_targets = {};

// https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function addRecentBinToCookies(new_bin) {
	new_bin = timeseries + new_bin
	var bins = getRecentBins();
	var new_bins = [];
	for (var n = 0; n < bins.length; n++) {
		if (bins[n] != new_bin)
			new_bins.push(bins[n]);
	}
	while (new_bins.length >= 50)
		new_bins.splice(bins.length-1, 1);
	new_bins.splice(0, 0, new_bin);
	setCookie('MCRecentBins', new_bins.join(), 3650);
}

function getRecentBins() {
	var bins_string = getCookie('MCRecentBins');
	var bins = bins_string.split(',');
	if (bins_string.length == 0)
		bins = [];
	return bins;
}

function setLastTimeseries(ts) {
	setCookie('MCLastTimeseries', ts, 3650)
}

function getLastTimeseries() {
	return getCookie('MCLastTimeseries')
}

function setBatchSize(size) {
	setCookie('MCBatchSize', size, 3650);
}

function getBatchSize(size) {
	return getCookie('MCBatchSize') || 5;
}

function getRecentApplications() {
	var combos_string = getCookie('MCRecentApplications');
	var oldCombos = combos_string.split(',');
	if (combos_string.length == 0)
		oldCombos = [];
	var combos = [];
	for (var n = 0; n < oldCombos.length; n++) {
		var s = oldCombos[n].split('/');
		if (s[0] == 'BLANK')
			s[0] = '';
		if (s[1] == 'BLANK')
			s[1] = '';
		combos[n] = [s[0], s[1]];
	}
	return combos;
}

function addRecentApplicationToCookies(classification, tag) {
	var combos = getRecentApplications();
	var new_combos = [];
	for (var n = 0; n < combos.length; n++) {
		if (!(combos[n][0] == classification && combos[n][1] == tag)) {
			new_combos.push(combos[n][0] + '/' + combos[n][1]);
		}
	}
	while (new_combos.length >= 9)
		new_combos.splice(new_combos.length-1, 1);
	if (classification == '')
		classification = 'BLANK';
	if (tag == '')
		tag = 'BLANK';
	new_combos.splice(0, 0, classification + '/' + tag);
	setCookie('MCRecentApplications', new_combos.join(), 3650);
}

function getLabelsForCombo(classification, tag) {
	var c;
	var t;
	var cSelect = document.getElementById('ClassificationApplicationSelection');
	var tSelect = document.getElementById('TagApplicationSelection');
	for (var n = 0; n < cSelect.options.length; n++) {
		if (cSelect.options[n].value == classification)
			c = cSelect.options[n].text;
	}
	for (var n = 0; n < tSelect.options.length; n++) {
		if (tSelect.options[n].value == tag)
			t = tSelect.options[n].text;
	}
	return [c, t];
}

function isClippedByBox(ele, box) {
	if (!(ele) || !(box))
		return false;
	ele = ele.getBoundingClientRect();
	box = box.getBoundingClientRect();
	var in_column = (ele.right > box.left && ele.right < box.right) || (ele.left > box.left && ele.left < box.right);
	var in_row = (ele.top > box.top && ele.top < box.bottom) || (ele.bottom > box.top && ele.bottom < box.bottom);
	if (in_column && box.top > ele.top && box.bottom < ele.bottom) // box clips left or right side of element
		return true;
	if (in_row && box.left > ele.left && box.right < ele.right) // box clips top or bottom side of element
		return true;
	if (in_column && in_row) // box clips a corner of element
		return true;
	// this seems to (USUALLY) trigger a regular click event, so no need to do it twice
	//if (box.left > rect.left && box.right < rect.right && box.top > rect.top && box.bottom < rect.bottom) // box is entirely within the element
		//return true;
	return false;
}

function compareTargets(a, b) {
	if (a['height'] > b['height'])
		return -1;
	else if(a['height'] < b['height'])
		return 1;
	return 0;
}

function checkPidBelongsInView(pid, classification, tag, filter, include_unclassified) {
	if (classifications.hasOwnProperty(pid)) {
		
		var t_ok = tag == 'ALL';
		if (!(t_ok)) {
			var acceptedTags = getAcceptedTagsForPid(pid);
			if (tag == 'NONE') {
				t_ok = (acceptedTags.length == 0);
			}
			else {
				t_ok = (acceptedTags.indexOf(parseInt(tag)) >= 0);
			}
		}
		
		if (!('accepted_classification' in classifications[pid]))
			return t_ok && include_unclassified && (filter == 'ALL' || filter == 'NONE');
		
		var c = classifications[pid]['accepted_classification'];
		
		var c_ok = classification == 'ALL' || c['classification_id'] == classification;

		var f_ok = false;
		switch (filter) {
			case 'ALL':
				f_ok = true;
				break;
			case 'ME':
				f_ok = c['user_id'] == user_id;
				break;
			case 'OTHERS':
				f_ok = c['user_id'] && c['user_id'] > 0 && c['user_id'] != user_id;
				break;
			case 'NONE':
				f_ok = !c['user_id'] || c['user_id'] < 0;
				break;
		}
		return c_ok && t_ok && f_ok;
	}
	return false;
}

function getTargetsInCategory(classification, tag, filter, include_unclassified) {
	var targets = [];
	for(var pid in classifications) {
		if (checkPidBelongsInView(pid, classification, tag, filter, include_unclassified))
			targets.push(classifications[pid])
	}
	targets.sort(compareTargets);
	return targets;
}

function getAcceptedTagsForPid(pid) {
	var results = [];
	if (pid in classifications && 'tags' in classifications[pid]) {
		var tags = classifications[pid]['tags'];
		for (var n = 0; n < tags.length; n++) {
			if (tags[n]['accepted'] == true && (!('negation' in tags[n]) || tags[n]['negation'] == false))
				results.push(tags[n]['tag_id']);
		}
	}
	return results;
}

function makeUpdatesToClassifications(updates) {
	for (pid in updates['classifications']) {
		if (pid in classifications) { // should be unnecessary...
			var c = classifications[pid];
			var h = c['height'];
			var w = c['width'];
			var update = updates['classifications'][pid]
			if (!c['accepted_classification']) {
				c['accepted_classification'] = update;
			}
			else {
				var to_remove = null;
				var oc = c['other_classifications'];
				for (var n = 0; n < oc.length; n++) {
					if (oc[n]['user_id'] = update['user_id'] && oc[n]['classification_id'] == update['classification_id']) {
						to_remove = n;
						break;
					}
				}
				if (to_remove != null)
					oc.splice(to_remove, 1);
				var ac = c['accepted_classification'];
				var old_time = c['verification_time'] ? ac['verification_time'] : ac['time'];
				var new_time = update['verification_time'] ? update['verification_time'] : update['time'];
				if (update['user_power'] > ac['user_power'] || (update['user_power'] == ac['user_power'] && new_time > old_time)) {
					if (ac['user_id'] != update['user_id'] || ac['classification_id'] != update['classification_id'])
						c['other_classifications'].push(ac);
					c['accepted_classification'] = update;
				}
				else {
					c['other_classifications'].push(update);
				}
			}

		}
	}
	for (pid in updates['tags']) {
		if (pid in classifications) {
			outerLoop:
				for (var n = 0; n < updates['tags'][pid].length; n++) {
					var c = classifications[pid];
					var u = updates['tags'][pid][n];
					if (!(c['tags']))
						c['tags'] = [];
					for (var i = 0; i < c['tags'].length; i++) {
						var tag = c['tags'][i];
						if (tag['tag_id'] == u['tag_id'] && tag['user_id'] == u['user_id'] && tag['negation'] == u['negation']) {
							c['tags'][i] = u;
							continue outerLoop; // done with this tag update, don't add it to 'tags' again
						}
					}
					c['tags'].push(u);
				}
			labelAcceptedTagsForPid(pid);
		}
	}
}

function downloadZip(bin) {
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/getzip/')
	xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	var params = 'csrfmiddlewaretoken=' + csrf_token + '&bin=' + bin;
	xhr.responseType = 'blob';
	xhr.onload = function() {
		zips[bin] = xhr.response;
		loadImagesFromZip(bin);
		zips_downloaded++;
		if (batch_mode && zips_downloaded == batchsize) // don't cache until current zips are done
			cacheBinsOnServer();
	}
	xhr.onerror = function() {
		console.log('something went wrong downloading zip');
		zips_downloaded++;
		if (batch_mode && zips_downloaded == batchsize)
			cacheBinsOnServer();
	}
	xhr.send(params);
}

function loadImagesFromZip(bin) {
	var zipFile = zips[bin];
	if (!(zipFile))
		return; // // this function will be called again when downloadZip is finished
	zip.createReader(new zip.BlobReader(zipFile), function(reader) {
		reader.getEntries(function(entries) {
			for (var i = 0; i < entries.length; i++) {
				var pid = entries[i].filename.replace('.png', '');
				loadImage(pid, entries[i]);
			}
			//reader.close();
			// not sure when to close this, so we'll just hope it gets garbage collected :)
		})
	}, function(error) {
		console.log('error reading zip');
	});
}

function loadImage(pid, entry) {
	var img = document.getElementById('MCImg_' + pid);
	if (img && !img.src) {
		if (target_img_sources[pid]) {
			img.src = target_img_sources[pid];
			loaded++;
			updateLoadedCounter();
			return;
		}
		entry.getData(new zip.BlobWriter('text/plain'), function(data) {
			target_img_sources[pid] = URL.createObjectURL(data);
			var img = document.getElementById('MCImg_' + pid); // refresh reference in case this image has been deleted
			if (img) {
				img.src = target_img_sources[pid];
				loaded++;
				updateLoadedCounter();
			}
		});
	}
}

function keepElementOnScreen(ele) {
	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	width -= 10;
	var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	height -= 10;
	var rect = ele.getBoundingClientRect();
	
	if (rect.right >= width)
		ele.style.left = width - ele.offsetWidth + 'px';
	if (rect.bottom >= height)
		ele.style.top = height - ele.offsetHeight + 'px';
}

function getLabelById(id, tag) {
	var options;
	if (tag) {
		options = document.getElementById('MCTagSelection').options;
	}
	else {
		options = document.getElementById('MCClassificationSelection').options;
	}
	for (var n = 0; n < options.length; n++) {
		var o = options[n];
		if (o.value == id)
			return o.text.replace(' (' + id + ')', '');
	}
	return 'NULL';
}

function isDescendant(parent, child) {
     var node = child.parentNode;
     while (node != null) {
         if (node == parent) {
             return true;
         }
         node = node.parentNode;
     }
     return false;
}

function labelAcceptedTagsForPid(pid) {
	if (pid in classifications) {
		if ('tags' in classifications[pid]) {
			var temp_tags = {};
			var tags = classifications[pid]['tags'];
			for (var n = 0; n < tags.length; n++) {
				var t = tags[n];
				var id = t['tag_id'];
				if (!(id in temp_tags)) {
					temp_tags[id] = t;
				}
				else {
					var existing = temp_tags[id];
					var new_time = t['time'];
					var power = t['user_power'];
					if ('verification_time' in t && t['verification_time'] > t['time']) {
						new_time = t['verification_time'];
					}
					var old_time = existing['time'];
					if ('verification_time' in existing && existing['verification_time'] > existing['time'])
						old_time = existing['verification_time'];
					if (power > existing['user_power'] || (power == existing['user_power'] && new_time > old_time)) {
						temp_tags[id]['accepted'] = false;
						temp_tags[id] = t;
					}
					else {
						t['accepted'] = false;
					}
				}
			}
			for (var id in temp_tags) {
				temp_tags[id]['accepted'] = true;
			}
		}
	}
}

function createInput(name, value) {
	var input = document.createElement('input');
	input.type = 'hidden';
	input.name = name;
	input.value = value;
	return input;
}

function cacheBinsOnServer() {
	if (batch_mode) {
		var to_cache = bins.slice(batchsize, batchsize*2).join(',');
		if (to_cache != '') {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', '/cachebins/')
			xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			var params = 'csrfmiddlewaretoken=' + csrf_token + '&bins=' + to_cache + '&timeseries=' + timeseries;
			xhr.send(params);
		}
	}
}