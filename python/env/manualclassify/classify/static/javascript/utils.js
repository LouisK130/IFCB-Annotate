var target_img_sources = {};
var zips = {};
var queued_targets = {};

// https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
    let d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + encodeURIComponent(cvalue) + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return decodeURIComponent(c.substring(name.length, c.length));
        }
    }
    return "";
}

function addRecentBinToCookies(new_bin, time, timeseries) {
    let bins = getRecentBins(timeseries);
    let new_bins = [];
    for (let n = 0; n < bins.length; n++) {
        if (bins[n][0] != new_bin)
            new_bins.push(bins[n][0] + "|" + bins[n][1]);
    }
    while (new_bins.length >= 10)
        new_bins.splice(new_bins.length-1, 1);
    new_bins.splice(0, 0, new_bin + "|" + time);
    setCookie(timeseries + "_bins", new_bins.join("|"), 3650);
}

function getRecentBins(timeseries) {
    let bins_string = getCookie(timeseries + "_bins");
    let items = bins_string.split('|');
    if (bins_string.length == 0)
        items = [];
    let bins = [];
    for (let n = 0; n < items.length; n = n + 2) {
        bins.push([items[n], items[n + 1]])
    }
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

function setBatchClass(claz) {
    setCookie('MCBatchClass', claz, 3650);
}

function getBatchClass() {
    return getCookie('MCBatchClass') || null;
}

function setBatchTag(tag) {
    setCookie('MCBatchTag', tag, 3650);
}

function getBatchTag() {
    return getCookie('MCBatchTag') || null;
}

function setBatchStart(dt) {
    setCookie('MCBatchStart', dt, 3650);
}

function getBatchStart() {
    return getCookie('MCBatchStart') || null;
}

function setBatchEnd(dt) {
    setCookie('MCBatchEnd', dt, 3650);
}

function getBatchEnd() {
    return getCookie('MCBatchEnd') || null;
}

// this should really only be used for tag arrays
// it modifies the given arrays to make all elements ints
function sameArray(one, two) {
    if (one.length != two.length) return false;
    for (let n = 0; n < one.length; n++) {
        try {
            one[n] = parseInt(one[n]);
            two[n] = parseInt(two[n]);
        } catch(err) {
            console.log("Exception comparing arrays: " + err);
            return false;
        }
    }
    for (let n = 0; n < one.length; n++)
        if (!one.includes(two[n]) || !two.includes(one[n])) return false;
    return true;
}

function serializeTags(tags) {
    let s = '['
    for (let n = 0; n < tags.length; n++) {
        s = s + tags[n] + '!';
    }
    if (tags.length > 0) {
        s = s.substring(0, s.length - 1);
    }
    return s + ']'
}

function deserializeTags(str) {
    str = str.substring(1, str.length - 1);
    let arr = str.split('!');
    let r = [];
    for (let n = 0; n < arr.length; n++) {
        if (arr[n] != '')
            r.push(arr[n]);
    }
    return r;
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
        combos[n] = [s[0], deserializeTags(s[1])];
    }
    return combos;
}

function addRecentApplicationToCookies(classification, tags) {
    var combos = getRecentApplications();
    var new_combos = [];
    for (var n = 0; n < combos.length; n++) {
        if (!(combos[n][0] == classification && sameArray(combos[n][1], tags))) {
            new_combos.push(combos[n][0] + '/' + serializeTags(combos[n][1]));
        }
    }
    while (new_combos.length >= 14)
        new_combos.splice(new_combos.length-1, 1);
    if (classification == '')
        classification = 'BLANK';
    new_combos.splice(0, 0, classification + '/' + serializeTags(tags));
    setCookie('MCRecentApplications', new_combos.join(), 3650);
}

function getLabelsForCombo(classification, tags) {
    var c = '';
    var t = '';
    var cSelect = $('#class-apply-select')[0];
    var tSelect = $('#tag-apply-select')[0];
    for (var n = 0; n < cSelect.options.length; n++) {
        if (cSelect.options[n].value == classification)
            c = cSelect.options[n].text;
    }
    for (var n = 0; n < tSelect.options.length; n++) {
                if (tags.includes(tSelect.options[n].value))
                    t = t + tSelect.options[n].text + ', '
    }
    t = t.substring(0, t.length - 2);
    if (tags.includes('CLEAR'))
        t = 'CLEAR';
    if (tags.includes('ANY'))
        t = 'ANY';
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
    // this seems to (usually) trigger a regular click event, so no need to do it twice
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

function morePowerful(c1, c2) {
    return c2['user_power'] > c1['user_power'] ? c2 : c1;
}

function moreRecent(c1, c2) {
    let t1 = 'verification_time' in c1 && c1['verification_time'] ? c1['verification_time'] : ('time' in c1 ? c1['time'] : 0);
    let t2 = 'verification_time' in c2 && c2['verification_time'] ? c2['verification_time'] : ('time' in c2 ? c2['time'] : 0);
    return t2 > t1 ? c2 : c1;
}

function compareClassifications(c1, c2) {
    if (sortby == 'power') {
        if ((c1['user_power'] == c2['user_power'] && moreRecent(c1, c2) == c2) || morePowerful(c1, c2) == c2) {
			return 1
        }
    } else if (sortby == "date" && moreRecent(c1, c2) == c2) {
		return 1
    } else if (sortby == 'classifier' && c2['user_id'] == -1) {
        return 1
    }
	return -1
}

function checkPidFilter(target, filter) {
    if (target['classifications'].length == 0)
        return filter == 'ANY' || filter == 'NONE';
    let c = target['classifications'][0];
    let sb;
    switch (filter) {
        case 'ANY':
            return true;
        case 'ME':
            return c['user_id'] == user_id;
        case 'OTHERS':
            return c['user_id'] && c['user_id'] > 0 && c['user_id'] != user_id;
        case 'NONE':
            return !c['user_id'] || (c['user_id'] < 0 && target['classifications'].length == 1);
        case 'PD_DIFFER':
            sb = ['power', 'date']
        case 'PC_DIFFER':
            sb = ['power', 'classifier']
        case 'PC_AGREE':
            sb = ['power', 'classifier']
        default:
            // notice fallthrough here
            if (target['classifications'].length < 2)
                return false;
            let old = sortby;
            sortby = sb[0];
            target['classifications'].sort(compareClassifications);
            let c1 = target['classifications'][0];
            sortby = sb[1];
            target['classifications'].sort(compareClassifications);
            let c2 = target['classifications'][0];
            sortby = old;
            target['classifications'].sort(compareClassifications);
            if (filter == "PC_AGREE") {
                return (c1['user_id'] != c2['user_id']) && (c1['classification_id'] == c2['classification_id']);
            } else { 
                return c1['classification_id'] != c2['classification_id']
            }
    }
    return false;
}

function getTargetsInCategory(classification, tags, filter) {
    let targets = [];
    let tagArrays = [];
    tags.sort();
    if (!(classification in pids_in_views)) return [];
    if (tags[0] == 'ANY') {
        for (let arr in pids_in_views[classification]) tagArrays.push(arr);
    } else {
        if (!(tags in pids_in_views[classification])) return [];
        tagArrays.push(tags)
    }
    for (let k = 0; k < tagArrays.length; k++) {
        let arr = tagArrays[k];
        for(let n = 0; n < pids_in_views[classification][arr].length; n++) {
            let t = pids_in_views[classification][arr][n];
            if (checkPidFilter(t, filter))
                targets.push(t)
        }
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
    return results.sort();
}

function makeUpdatesToClassifications(updates) {
    let to_sort = new Set();
    for (let pid in updates['classifications']) {
        if (pid in classifications) { // should be unnecessary...
            var c = classifications[pid];
            var update = updates['classifications'][pid]
            var oc = c['classifications'];
            for (var n = 0; n < oc.length; n++) {
                if (oc[n]['user_id'] == update['user_id'] && oc[n]['classification_id'] == update['classification_id']) {
                    oc.splice(n, 1);
                    break;
                }
            }
            let old_c = -1;
            if (oc.length > 0)
                oc[0]['classification_id'];
            let old_t = getAcceptedTagsForPid(pid);
            c['classifications'].push(update);
            c['classifications'].sort(compareClassifications);
            sortPidIntoView(pid, old_c, old_t);
        }
    }
    for (let pid in updates['tags']) {
        if (pid in classifications) {
            let c = classifications[pid];
            outerLoop:
            for (var n = 0; n < updates['tags'][pid].length; n++) {
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
            let old_c = -1;
            if (c['classifications'].length > 0)
                old_c = c['classifications'][0]['classification_id'];
            let old_t = getAcceptedTagsForPid(pid);
            labelAcceptedTagsForPid(pid);
            sortPidIntoView(pid, old_c, old_t);
        }
    }
}

function downloadZip(bin) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/getzip/')
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    var params = 'csrfmiddlewaretoken=' + csrf_token + '&bin=' + bin + '&timeseries=' + timeseries;
    xhr.responseType = 'blob';
    xhr.onload = function() {
        zips[bin] = xhr.response;
        loadImagesFromZip(bin);
        zips_downloaded++;
        if (zips_downloaded == BATCH_SIZE) // don't cache until current zips are done
            cacheBinsOnServer();
    }
    xhr.onerror = function() {
        console.log('something went wrong downloading zip');
        zips_downloaded++;
        if (zips_downloaded == BATCH_SIZE)
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
    width -= 25;
    var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    height -= 10;
    var rect = ele.getBoundingClientRect();
    
    if (rect.right >= width)
        ele.style.left = width - $(ele).width() + "px"
    if (rect.bottom >= height)
        ele.style.top = height - $(ele).height() + "px"
}

function getLabelById(id, tag) {
    var options;
    if (tag) {
        options = $('#tag-select')[0].options;
    }
    else {
        options = $('#class-select')[0].options;
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
    var to_cache = bins.slice(binIndex + BATCH_SIZE, binIndex + (BATCH_SIZE * 2)).join(',');
    if (to_cache != '') {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/cachebins/')
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        var params = 'csrfmiddlewaretoken=' + csrf_token + '&bins=' + to_cache + '&timeseries=' + timeseries;
        xhr.send(params);
    }
}
