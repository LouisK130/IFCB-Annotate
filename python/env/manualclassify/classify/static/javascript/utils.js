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
	if (new_bins.length == 10)
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
	if (new_combos.length == 10)
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

function getTargetsInCategory(classification, tag, include_unclassified) {
	var targets = [];
	for(var pid in classifications) {
		if (classifications.hasOwnProperty(pid)) {
			var c = classifications[pid];
			var c_ok = (c['classification_id'] && c['classification_id'] == classification) || (!(c['classification_id']) && include_unclassified) || classification == 'ALL';
			var t_ok = tag == 'ALL';
			if (!(t_ok)) {
				if (c['tags'] && c['tags'].length > 0) {
					for (var n = 0; n < c['tags'].length; n++) {
						if (c['tags'][n]['tag_id'] && c['tags'][n]['tag_id'] == tag) {
							t_ok = true;
							break;
						}
					}
				}
				else {
					t_ok = tag == 'NONE';
				}
			}
			if (c_ok && t_ok)
				targets.push(classifications[pid])
		}
	}
	targets.sort(compareTargets);
	return targets;
}

function makeUpdatesToClassifications(updates) {
	for (pid in updates['classifications']) {
		if (pid in classifications) { // should be unnecessary...
			var c = classifications[pid];
			var h = c['height'];
			var w = c['width'];
			var update = updates['classifications'][pid]
			if (!(c['classification_id'])) {
				classifications[pid] = update;
				classifications[pid]['height'] = h;
				classifications[pid]['width'] = w;
				classifications[pid]['other_classifications'] = [];
				classifications[pid]['tags'] = [];
			}
			else {
				var time1 = c['time'];
				if (c['verification_time'] && c['verification_time'] > time1)
					time1 = c['verification_time'];
				var time2 = update['time'];
				if (update['verification_time'] && update['verification_time'] > time2)
					time2 = update['verification_time'];
				if (update['user_power'] > c['user_power'] || (update['user_power'] == c['user_power'] && time2 > time1)) {
					var oc = c['other_classifications'];
					delete c['other_classifications'];
					oc.push(c);
					var tags = c['tags'];
					classifications[pid] = update
					classifications[pid]['tags'] = tags;
					classifications[pid]['height'] = h;
					classifications[pid]['width'] = w;
					classifications[pid]['other_classifications'] = oc;
				}
				else {
					classifications[pid]['other_classifications'].push(update);
				}
			}

		}
	}
	outerLoop:
		for (pid in updates['tags']) {
			if (pid in classifications) {
				var c = classifications[pid];
				if (!(c['tags']))
					c['tags'] = [];
				innerLoop:
					for (var i = 0; i < c['tags'].length; i++) {
						var tag = c['tags'][i];
						if (tag['tag_id'] == updates['tags'][pid]['tag_id'] && tag['user_id'] == updates['tags'][pid]['user_id']) {
							c['tags'][i] = updates['tags'][pid]
							continue outerLoop; // done with this tag update, don't add it to 'tags' again
						}
					}
				c['tags'].push(updates['tags'][pid]);
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
		if (queued_targets[bin]) {
			for (pid in queued_targets[bin]) {
				loadImageForPid(pid, queued_targets[bin][pid]);
			}
		}
		delete queued_targets[bin];
	}
	xhr.onerror = function() {
		console.log('something went wrong downloading zip');
	}
	xhr.send(params);
}

function loadImageForPid(pid, img) {
	var k = pid.lastIndexOf('/')
	pid = pid.substring(k+1, pid.length);
	k = pid.lastIndexOf('_');
	var bin = pid.substring(0, k);
	if (!(target_img_sources[pid])) {
		var zipFile = zips[bin];
		if (!(zipFile)) {
			if (!(queued_targets[bin]))
				queued_targets[bin] = {};
			queued_targets[bin][pid] = img;
			return;
		}
		zip.createReader(new zip.BlobReader(zipFile), function(reader) {
			reader.getEntries(function(entries) {
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].filename == pid + '.png') {
						entries[i].getData(new zip.BlobWriter('text/plain'), function(data) {
							var src = URL.createObjectURL(data);
							target_img_sources[pid] = src;
							if (img) {
								img.src = target_img_sources[pid]
								loaded++;
								updateLoadedCounter();
							}
							reader.close();
						});
						return;
					}
				}
			});
		}, function(error) {
			console.log('error reading zip');
		});
	}
	else if (img) {
		img.src = target_img_sources[pid];
		loaded++;
		updateLoadedCounter();
	}
}