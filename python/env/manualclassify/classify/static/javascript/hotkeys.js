let FORWARD_KEY = 78; // N
let PREVIOUS_KEY = 80; // P
let CONTEXT_MENU_KEY = 76; // L
let SUBMIT_UPDATES_KEY = 13; // ENTER
let VERIFY_ANY_KEY = 219; // [
let OPEN_SELECT_1 = 49 // 1
let OPEN_SELECT_2 = 50 // 2
let OPEN_SELECT_3 = 51 // 3
let OPEN_SELECT_4 = 52 // 4

let NO_ANNOTATION_ID = -1
for (let c in classification_labels) {
    if (c['name'] == 'No annotation') {
        NO_ANNOTATION_ID = c['id']
    }
}

let bound_keys = [
        FORWARD_KEY,
        PREVIOUS_KEY,
        CONTEXT_MENU_KEY,
        SUBMIT_UPDATES_KEY,
        VERIFY_ANY_KEY,
        OPEN_SELECT_1,
        OPEN_SELECT_2,
        OPEN_SELECT_3,
        OPEN_SELECT_4
    ];

document.addEventListener('keydown', generalKeyDown, false);

let pids_in_views = {};
let ordered_views = [];

function setupViews() {
    if (views.length == 0) {
        for (let c in pids_in_views) {
            for (let t in pids_in_views[c]) {
                let t_arr = t.split(',');
                if (t_arr.length == 1 && t_arr[0] == '')
                    t_arr = []
                ordered_views.push([c, t_arr.sort()]);
            }
        }
        ordered_views.sort(compareViews);
    } else {
        for (let n = 0; n < views.length; n++) {
            if (views[n][1] != 'SMART') {
                ordered_views.push(views[n]);
            } else {
                let temp = [];
                if (views[n][0] in pids_in_views) {
                    for (let t in pids_in_views[views[n][0]]) {
                        let t_arr = t.split(',');
                        if (t_arr.length == 1 && t_arr[0] == '')
                            t_arr = []
                        temp.push([views[n][0], t_arr.sort()]);
                    }
                    temp.sort(compareViews);
                    for (let n = 0; n < temp.length; n++)
                        ordered_views.push(temp[n]);
                }
            }
        }
    }
}

function compareViews(a, b) {
    let c1 = getAlphabeticClassID(a[0]);
    let c2 = getAlphabeticClassID(b[0]);
    let t1 = [];
    for (let n = 0; n < a[1].length; n++) {
        t1[n] = getAlphabeticTagID(a[1][n]);
    }
    let t2 = [];
    for (let n = 0; n < b[1].length; n++) {
        t2[n] = getAlphabeticTagID(b[1][n]);
    }
    if (c1 < c2)
        return -1;
    if (c2 < c1)
        return 1;
    if (t1.length < t2.length)
        return -1;
    if (t2.length < t1.length)
        return 1;
    for (let n = 0; n < t1.length; n++) {
        if (t1[n] < t1[n])
            return -1;
        if (t2[n] < t1[n])
            return 1;
    }
    // they are the same view somehow
    return 0;
}

function getAlphabeticID(id, ele) {
    let s = $(ele)[0];
    for (let n = 0; n < s.options.length; n++) {
        if (s.options[n].value == id)
            return n;
    }
    return -1;
}

function getAlphabeticClassID(id) {
    return getAlphabeticID(id, '#class-select');
}

function getAlphabeticTagID(id) {
    return getAlphabeticID(id, '#tag-select');
}

function sortPidIntoView(pid) {
    if (!(pid in classifications))
        return;
    let target = classifications[pid];
    let c;
    if (!('classifications' in target) || target['classifications'].length == 0) {
        c = NO_ANNOTATION_ID;
    } else {
        c = target['classifications'][0]['classification_id'];
    }
    if (!(c in pids_in_views)) {
        pids_in_views[c] = {};
    }
    let tags = getAcceptedTagsForPid(pid);
    if (!(tags in pids_in_views[c])) {
        pids_in_views[c][tags] = [];
    }
    pids_in_views[c][tags].push(classifications[pid]);
    if ('view' in target) {
        let oc = target['view'][0];
        let ot = target['view'][1];
        if (oc in pids_in_views) {
            if (ot in pids_in_views[oc]) {
                let o = pids_in_views[oc][ot];
                for (let n = 0; n < o.length; n++) {
                    if (o[n]['pid'] == pid) {
                        o.splice(n, 1);
                        break;
                    }
                }
                if (o.length == 0)
                    delete pids_in_views[oc][ot];
                if (pids_in_views[oc].length == 0)
                    delete pids_in_views[oc];
            }
        }
    }
    target['view'] = [c, tags];
}

function generalKeyDown(e) {
    if (bound_keys.includes(e.keyCode)) {
        if (document.activeElement != document.body) {
            return;
        }
        switch (e.keyCode) {
        case FORWARD_KEY:
            setTimeout(function() {
                moveToNextView();
            }, 10);
            break;
        case PREVIOUS_KEY:
            setTimeout(function() {
                moveToPreviousView();
            }, 10);
            break;
        case CONTEXT_MENU_KEY:
			let menu = document.getElementById('MCContextMenu');
			if (menu) {
				menu.outerHTML = '';
			} else {
				createContextMenu()
			}
            break;
        case SUBMIT_UPDATES_KEY:
            submitUpdates();
            break;
        case VERIFY_ANY_KEY:
            var targets = getAllVisibleTargets();
            var c = $('#class-apply-select');
            var t = $('#tag-apply-select');
            var old_c = c.selectpicker('val');
            var old_t = t.selectpicker('val');
            c.selectpicker('val', $('#class-select').selectpicker('val'));
            t.selectpicker('val', $('#tag-select').selectpicker('val'));
            for (var n = 0; n < targets.length; n++) {
                var pid = targets[n].id.replace('MCTarget_', '');
                if (!(pid in classification_updates) && !(pid in tag_updates))
                    targets[n].click();
            }
            c.selectpicker('val', old_c);
            t.selectpicker('val', old_t);
            break;
        case OPEN_SELECT_1:
            $('#class-select').selectpicker('toggle');
            break;
        case OPEN_SELECT_2:
            $('#tag-select').selectpicker('toggle');
            break;
        case OPEN_SELECT_3:
            $('#class-apply-select').selectpicker('toggle');
            break;
        case OPEN_SELECT_4:
            $('#tag-apply-select').selectpicker('toggle');
            break;
        }
    }

}

let current_view = -1;

function moveToNextView() {
    current_view = current_view + 1;
    if (current_view >= ordered_views.length) {
        current_view = ordered_views.length - 1;
        return;
    }
    loadView();
}

function moveToPreviousView() {
    current_view = current_view - 1;
    if (current_view < 0) {
        current_view = 0
        return;
    }
    loadView();
}

function loadView() {
    submitUpdates();
    let c = $('#class-select');
    let t = $('#tag-select');
    c.selectpicker('val', ordered_views[current_view][0]);
    t.selectpicker('val', ordered_views[current_view][1]);
    reloadTargets();
    $('#view-label').text('View ' + (current_view + 1) + ' / ' + ordered_views.length);
}

function getAllVisibleTargets() {
    var visible = [];
    var targets = document.getElementsByClassName('MCTarget');
    for (var n = 0; n < targets.length; n++) {
        var rect = targets[n].getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight)
            visible.push(targets[n]);
    }
    return visible;
}

function moveToPreviousBatch() {
    if (binIndex > 0) {
        loadBinIndex(Math.max(binIndex - BATCH_SIZE, 0));
    }
}

function moveToNextBatch() {
    if (binIndex + BATCH_SIZE < bins.length) {
        loadBinIndex(binIndex + BATCH_SIZE);
    }
}

function loadBinIndex(i) {
    let form = document.createElement('form');
    form.action = '/classify/';
    form.method = 'POST';
    form.appendChild(createInput('bins', bins));
    form.appendChild(createInput('timeseries', timeseries));
    form.appendChild(createInput('import', shouldImport));
    form.appendChild(createInput('sortby', sortby));
    form.appendChild(createInput('views', JSON.stringify(views)));
    form.appendChild(createInput('index', i));
    form.insertAdjacentHTML('beforeend', csrf_token_form);
    document.body.appendChild(form);
    form.submit();
}
