let BATCH_SIZE = 10;

var classification_updates = {};
var tag_updates = {};
var tag_negations = {};

var target_counter = 0;
var loaded = 0;
var current_targets = [];

var zips_downloaded = 0;
var zips_expected = Math.min(BATCH_SIZE, bins.length - binIndex);

$.fn.selectpicker.Constructor.DEFAULTS.liveSearchStyle = 'startsWith';

$(function() {
    var set_size = getCookie('MCSetSize');
    if (set_size == "")
        set_size = 100;
    $('#MCSetSize')[0].value = set_size;


    let current_bins_ele = document.getElementById('MCCurrentBins');
    for(var n = binIndex; n < binIndex + zips_expected; n++) {
        addRecentBinToCookies(bins[n]);
        downloadZip(bins[n]);
        let label = document.createElement('p');
        label.innerHTML = bins[n];
        label.style.padding = '0';
        label.style.margin = '0';
        current_bins_ele.appendChild(label);
    }
    
    let binMax = Math.min(binIndex + BATCH_SIZE, bins.length);
    $('#bin-label').text('Bins ' + (binIndex + 1) + ' - ' + binMax + ' / ' + bins.length);

    var classSelect = document.getElementById('class-select');
    var tagSelect = document.getElementById('tag-select');
    var filterSelect = document.getElementById('filter-select');

    var classApplySelect = document.getElementById('class-apply-select');
    var tagApplySelect = document.getElementById('tag-apply-select');

    // select first classification
    classSelect.selectedIndex = 1;
    classSelect.onchange = reloadTargets;

    // select 'NONE' tags
    tagSelect.value = 'NONE';
    tagSelect.onchange = reloadTargets;

    // see all completion levels by default
    filterSelect.value = 'ANY';
    filterSelect.onchange = reloadTargets;

    // select blank applications
    classApplySelect.value = '';
    tagApplySelect.value = '';

    // choosing a new classification to apply resets tag application
    classApplySelect.onchange = function() {
        $('#tag-apply-select').selectpicker('deselectAll');
    }
    
    let old_scroll;
    
    // when an option is clicked, bootstrap-select focuses the dropdown button
    // and scrolls to it, causing an undesirable scroll
    // this works because mousedown happens before click, so we can determine the
    // scroll position immediately before the click and then get back to it afterwards
    $('body').on('mousedown', '.dropdown-menu a', function(e) {
        old_scroll = $(window).scrollTop();
    });
    
    $('body').on('focus', '[data-id=class-apply-select]', function() {
        if (old_scroll != undefined) {
            $(window).scrollTop(old_scroll);
        }
        old_scroll = undefined;
    });
    
    $(window).scroll(function() {
        old_scroll = undefined;
    });
    
    // redo layout when window is resized
    var timeout = setTimeout(layoutMosaic, 0); // define the timer and call layout once immediately
    document.body.onresize = function() {
        clearTimeout(timeout);
        timeout = setTimeout(layoutMosaic, 50);
    }

    showLoading();
    for (var pid in classifications) {
        labelAcceptedTagsForPid(pid);
        if ('classifications' in classifications[pid]) {
            classifications[pid]['classifications'].sort(compareClassifications);
        }
        sortPidIntoView(pid, null, null);
    }
    setupViews();
    setTimeout(function() {
        moveToNextView();
        hideLoading();
    }, 50); // delayed because container needs time to size properly first
    
    $('#previous-view').click(moveToPreviousView);
    $('#next-view').click(moveToNextView);
    $('#previous-batch').click(moveToPreviousBatch);
    $('#next-batch').click(moveToNextBatch);

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
    
    let hide = $('#hide-toolbox');
    hide.click(function() {
        let tb = $('.col-xs-2');
        let tc = $('#MCTargetContainer');
        let w = tb.width();
        let p = hide.find('p');
        if (p.text() == 'Hide') {
            tb.animate({
                'margin-left' : -w + 'px'
            }, 250);
            p.text('Show');
            tc.animate({
                'width' : tc.width() + w + 'px'
            }, 250, function() {
                layoutMosaic();
            });
        } else {
            tb.animate({
                'margin-left' : '5px'
            }, 250);
            tc.animate({
                'width' : tc.width() - w + 'px'
            }, 250, function() {
                layoutMosaic();
            });
            p.text("Hide");
        }
    });
    
});

// Above this is initialization
// Below this is function declarations

function showLoading() {
    $('#MCLoading')[0].innerHTML = 'Loading ...';
}

function hideLoading() {
    $('#MCLoading')[0].innerHTML = '';
}

function reloadTargets() {
    let c = $('#class-select')[0];
    let t = $('#tag-select')[0];
    let f = $('#filter-select')[0];
    classification_updates = {};
    tag_updates = {};
    tag_negations = {};
    target_counter = 0;
    loaded = 0;
    let tags = [];
    for (let n = 0; n < t.selectedOptions.length; n++) {
        tags.push(t.selectedOptions[n].value);
        if (t.selectedOptions[n].value == 'ANY') {
            tags = ['ANY'];
            break;
        }
    }
    current_targets = getTargetsInCategory(c.value, tags, f.value);
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
        
    let tb = $('.col-xs-2');
    if (tb.css('margin-left').substring(0, 1) == '-') {
        tb.css('margin-left', '-' + tb.width() + 'px');
    }
    
    var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    let x = $('#MCToolboxContainer')[0].getBoundingClientRect().right;
    var targetContainer = document.getElementById('MCTargetContainer');
    width = width - x - 30;
    //targetContainer.style.left = x + 'px';
    targetContainer.style.width = width + "px";
    if (targetContainer.getBoundingClientRect().height < (height - 75)) {
        targetContainer.style.minHeight = (height - 75) + 'px';
    }
    var targets = document.getElementsByClassName('MCTarget');
    width -= 5;
    for (var n = 0; n < targets.length; n++) {
        var target = targets.item(n);
        var pid = target.id.replace('MCTarget_', '');
        var img = document.getElementById('MCImg_' + pid);
        if (img.naturalWidth > img.width || img.width > width) {
            img.width = (Math.min(img.naturalWidth, width));
            img.height = (img.width * (img.naturalHeight / img.naturalWidth));
            target.style.width = img.width + 'px';
            target.style.height = img.height + 'px';
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
        if (document.activeElement)
            document.activeElement.blur();
    }
    
    var img = document.createElement('img');
    img.classList.add('MCImg');
    img.id = 'MCImg_' + pid;
    img.height = height;
    img.width = width;
    img.draggable = false;
    tile.style.width = width+'px';
    tile.style.height = height+'px';

    img.onmousedown = function(e) {
        if (e.preventDefault)
            e.preventDefault();
    }
    
    img.oncontextmenu = function(e) {
        if (e.preventDefault)
            e.preventDefault();
        createRightClickMenu(pid);
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
    var filter = $('#class-select')[0].value;
    var clas = $('#class-apply-select')[0].value;
    let ts = $('#tag-apply-select')[0];
    let tags = [];
    for (let n = 0; n < ts.selectedOptions.length; n++) {
        if (ts.selectedOptions[n].value == 'CLEAR') {
            tags = ['CLEAR'];
            break;
        } else {
            tags.push(parseInt(ts.selectedOptions[n].value));
        }
    }
    var verify_other = false;
    for(var n = 0; n < current_targets.length; n++) {
        if (current_targets[n]['pid'] == pid) {
            if ('classifications' in current_targets[n]) {
                for(var z = 0; z < current_targets[n]['classifications'].length; z++) {
                    var c = current_targets[n]['classifications'][z]
                    if (c['classification_id'] == clas) {
                        if (user_id == c['user_id']) {
                            verify_other = true;
                        }
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
        c_label.setAttribute('title',classification_labels[clas+'']);
        tile.style.outlineColor = 'black';
        if (clas == filter)
            c_label.innerHTML = '<small><b>V</b></small>';
        else if (verify_other)
            c_label.innerHTML = '<small><b>V: ' + clas + '</b></small>';
        else
            c_label.innerHTML = '<b>' + clas + '</b>';
    }
    if (tags.length > 0) {
        if (tags[0] == 'CLEAR') {
            delete tag_updates[pid];
            t_label.innerHTML = '';
        } else {
            tag_updates[pid] = tags;
            t_label.style.color = 'blue';
            if (tags.length > 1) {
                let s = serializeTags(tags);
                s = s.substring(1, s.length - 1);
                s = s.replace(/!/g, ', ');
                t_label.innerHTML = '<small><b>' + s + '</b></small>';
            } else {
                t_label.innerHTML = '<b>' + tags[0] + '</b>';
            }
        }
    }
    addRecentApplicationToCookies(clas, tags);
    updateAppliedCounter();
}

function submitUpdates() {
    if (Object.keys(classification_updates).length == 0 && Object.keys(tag_updates).length == 0 && Object.keys(tag_negations).length == 0)
        return;
    disablePage();
    var http = new XMLHttpRequest();
    http.open('POST', '/submitupdates/', true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    var params = 'csrfmiddlewaretoken=' + csrf_token +
        '&classifications=' + JSON.stringify(classification_updates) +
        '&tags=' + JSON.stringify(tag_updates) +
        '&tagnegations=' + JSON.stringify(tag_negations) +
        '&timeseries=' + timeseries;
    http.send(params);
    http.onload = function() {
        
        var response;
        if (http.status == 200)
            response = JSON.parse(http.responseText);
        
        if (response && !(response['failure'])) {
            
            var new_targets = [];
            
            var c_select = $('#class-select');
            var t_select = $('#tag-select');
            var f_select = $('#filter-select');
            
            makeUpdatesToClassifications(response); // this function updates JS with results from DB

            for (var n = 0; n < current_targets.length; n++) {
                
                let target = current_targets[n];
                let pid = target['pid'];
                
                if (target['pid'] in tag_updates)
                    document.getElementById('MCNewTag_' + pid).style.color = '#56f442';
                
                let tagMatch = sameArray(target['view'][1], t_select.selectpicker('val'))
                                || t_select.selectpicker('val') == 'ANY';
                
                if (target['view'][0] == c_select.selectpicker('val') && tagMatch &&
                    checkPidFilter(target, f_select.selectpicker('val'))) {
                    
                    if (pid in classification_updates) {
                        document.getElementById('MCTarget_' + pid).style.outlineColor = '#56f442';
                        document.getElementById('MCNewClassification_' + pid).style.color = '#56f442';
                    }
                    
                    new_targets.push(current_targets[n]);
                    
                }
                else {
                    
                    document.getElementById('MCTarget_' + pid).outerHTML = '';
                    loaded--;
                    target_counter--;
                    
                }
                
            }

            current_targets = new_targets;
            classification_updates = {};
            tag_updates = {};
            tag_negations = {};
            updateLoadedCounter();
            updateAppliedCounter();
            
        }
        enablePage();
        if (current_targets.length == 0)
            moveToNextView();
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
    var bins = [];
    deleteLoadMoreButton();
    if (target_counter == current_targets.length)
        return;
    if (target_counter == 0) {
        var markers = document.getElementsByClassName('MCEndSetMarker');
        while (markers.length > 0) {
            markers[0].parentNode.removeChild(markers[0])
        }
    }
    else {
        var container = document.getElementById('MCTargetContainer');
        
        var marker = document.createElement('div');
        marker.classList.add('MCEndSetMarker');

        var markerLine = document.createElement('div');
        markerLine.classList.add('MCEndSetMarkerInner');

        marker.appendChild(markerLine);
        container.appendChild(marker);
    }
    for (target_counter = target_counter; target_counter < current_targets.length; target_counter++) {
        if (target_counter >= n) {
            break;
        }
        var pid = current_targets[target_counter]['pid'];
        var bin = pid.substring(0, pid.lastIndexOf('_'))
        if (bins.indexOf(bin) == -1)
            bins.push(bin);
        createTile(pid, current_targets[target_counter]['width'], current_targets[target_counter]['height']);
    }
    if (target_counter != current_targets.length)
        createLoadMoreButton();
    for (var n = 0; n < bins.length; n++) {
        loadImagesFromZip(bins[n]);
    }
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
