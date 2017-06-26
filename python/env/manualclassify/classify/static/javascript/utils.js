var target_img_sources = {};
var zips = {};

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
	for (var n = 0; n < bins.length; n++) {
		if (bins[n] == new_bin)
			bins.splice(n, 1);
	}
	if (bins.length == 10)
		bins.splice(bins.length-1, 1);
	bins.splice(0, 0, new_bin);
	bins_string = bins.join();
	setCookie('MCRecentBins', bins_string, 3650);
}

function getRecentBins() {
	var bins_string = getCookie('MCRecentBins');
	var bins = bins_string.split(',');
	if (bins_string.length == 0)
		bins = [];
	return bins;
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
	if (a['width'] > b['width'])
		return -1;
	else if(a['width'] < b['width'])
		return 1;
	return 0;
}

function getTargetsInCategory(classification, include_unclassified) {
	var targets = [];
	for(var pid in classifications) {
		if (classifications.hasOwnProperty(pid)) {
			if (classifications[pid]['classification_id']) {
				if (classifications[pid]['classification_id'] == classification)
					targets.push(classifications[pid]);
			}
			else if (include_unclassified) {
				targets.push(classifications[pid]);
			}
		}
	}
	targets.sort(compareTargets);
	return targets;
}

function makeUpdatesToClassifications(updates) {
	for (pid in updates) {
		if (pid in classifications) { // should be unnecessary...
			var c = classifications[pid];
			var h = c['height'];
			var w = c['width'];
			if (!(c['classification_id'])) {
				classifications[pid] = updates[pid];
				classifications[pid]['height'] = h;
				classifications[pid]['width'] = w;
				classifications[pid]['other_classifications'] = [];
			}
			else {
				var time1 = c['time'];
				if (c['verification_time'] && c['verification_time'] > time1)
					time1 = c['verification_time'];
				var time2 = updates[pid]['time'];
				if (updates[pid]['verification_time'] && updates[pid]['verification_time'] > time2)
					time2 = updates[pid]['verification_time'];
				if (updates[pid]['user_power'] > c['user_power'] || (updates[pid]['user_power'] == c['user_power'] && time2 > time1)) {
					var oc = c['other_classifications'];
					delete c['other_classifications']
					oc.push(c);
					classifications[pid] = updates[pid]
					classifications[pid]['height'] = h;
					classifications[pid]['width'] = w;
					classifications[pid]['other_classifications'] = oc;
				}
				else {
					classifications[pid]['other_classifications'].push(updates[pid]);
				}
			}

		}
	}
}

function getZipForPid(pid) {
	var k = pid.lastIndexOf('_');
	var bin = pid.substring(0, k);
	if (zips[bin])
		return zips[bin];
	return null;
}

function downloadZip(bin) {
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/getzip/')
	xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	var params = 'csrfmiddlewaretoken=' + csrf_token + '&bin=' + bin;
	xhr.responseType = 'blob';
	xhr.onload = function() {
		zips[bin] = xhr.response;
	}
	xhr.onerror = function() {
		console.log('something went wrong downloading zip');
	}
	xhr.send(params);
}

function loadImageForPid(pid, img) {
	var k = pid.lastIndexOf('/')
	pid = pid.substring(k+1, pid.length);
	if (!(target_img_sources[pid])) {
		var zipFile = getZipForPid(pid);
		if (!(zipFile)) {
			console.log('couldn\'t find zip file for pid: ' + pid);
			return;
		}
		zip.createReader(new zip.BlobReader(zipFile), function(reader) {
			reader.getEntries(function(entries) {
				for (var i = 0; i < entries.length; i++) {
					if (entries[i].filename == pid + '.png') {
						entries[i].getData(new zip.BlobWriter('text/plain'), function(data) {
							var src = URL.createObjectURL(data);
							if (img) {
								img.src = src;
								loaded++;
								updateLoadedCounter();
							}
							target_img_sources[pid] = src;
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