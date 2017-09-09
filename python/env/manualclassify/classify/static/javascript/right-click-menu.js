 // `mouse_x` and `mouse_y` are tracked by context-menu.js

 function createRightClickMenu(pid) {

	 deleteRightClickMenu();

	 var menu = document.createElement('div');
	 menu.id = 'MCRightClickMenu';
         menu.pid = pid;
         menu.style.left = mouse_x+'px';
         menu.style.top = mouse_y+'px';

	 document.body.appendChild(menu);

	 var title = document.createElement('div');
	 title.innerHTML = '<b>' + pid + '</b>';
	 title.style.padding = '5px';
	 title.style.textAlign = 'center';

	 var header = createDetailEntry('<b>Type</b>', '<b>User</b>', '<b>Updated</b>', '<b>Verified</b>', '<b>Label</b>', '<b>Action</b>');

	 menu.appendChild(title);
	 menu.appendChild(header);

	 var entries = getClassificationsForPid(pid);

	 for (var n = 0; n < entries.length; n++) {
		 var c = entries[n];
		 if (c['user'] == 'auto') {
			 c['time'] = 'N/A';
			 c['verifications'] = 'N/A';
		 }
		 var color = 'black';
		 if (n != 0)
			 color = 'red';
		 var entry = createDetailEntry('C', c['user'], c['time'], c['verifications'], c['label'], '', color)
		 menu.appendChild(entry);
	 }

	 var entries = getTagsForPid(pid);
	 var delayed = [];
	 for (var n = 0; n < entries.length; n++) {
		 var c = entries[n];
		 if (c['user'] == 'auto') {
			 c['time'] = 'N/A';
			 c['verifications'] = 'N/A';
		 }
		 var action = createActionButton('Disagree', disagreeTag)
		 if (c['negation'] == true)
			 action = ''
		 var entry = createDetailEntry('T', c['user'], c['time'], c['verifications'], c['label'], action, c['color']);
		 entry.id = c['id'];
		 if (c['color'] == 'black')
			 menu.appendChild(entry);
		 else
			 delayed.push(entry);
	 }

	 for (var n = 0; n < delayed.length; n++)
		 menu.appendChild(delayed[n]);

	 var entries = getPendingClassificationsForPid(pid);

	 for (var n = 0; n < entries.length; n++) {
		 var c = entries[n];
		 var action = createActionButton('Cancel', cancelPendingEntry);
		 var entry = createDetailEntry('C', c['user'], c['time'], c['verifications'], c['label'], action, c['color']);
		 entry.type = 'classification';
		 entry.labelID = c['id'];
		 menu.appendChild(entry);
	 }

	 var entries = getPendingTagsForPid(pid);

	 for (var n = 0; n < entries.length; n++) {
		 var c = entries[n];
		 var action = createActionButton('Cancel', cancelPendingEntry);
		 var entry = createDetailEntry('T', c['user'], c['time'], c['verifications'], c['label'], action, c['color']);
		 entry.type = 'tag';
		 entry.labelID = c['id'];
		 if (c['negation'] == true)
			 entry.type = 'tagNegation';
		 menu.appendChild(entry);
	 }

	 resizeMenu();
	 keepElementOnScreen(menu);
 }

 function deleteRightClickMenu() {
	 var menu = document.getElementById('MCRightClickMenu');
	 if (menu)
		 menu.outerHTML = '';
 }

 function createActionButton(text, action) {
	 var btn = document.createElement('button');
	 btn.classList.add('MCDetailActionButton');
	 btn.innerHTML = text;
	 btn.onclick = action;
	 btn.style.fontSize = 'x-small';
	 return btn;
 }

 function cancelPendingEntry() {
	 var e = this;
	 while (!(e.classList.contains('MCDetailEntry'))) {
		 if (e.parentNode.id == 'MCRightClickMenu')
			 return;
		 e = e.parentNode;
	 }
	 var pid = e.parentNode.pid;
	 if (!(e.type))
		 return;
	 switch (e.type) {
		 case 'classification':
			 delete classification_updates[pid];
			 document.getElementById('MCNewClassification_' + pid).innerHTML = '';
			 break;
		 case 'tag':
			 delete tag_updates[pid];
			 document.getElementById('MCNewTag_' + pid).innerHTML = '';
			 break;
		 case 'tagNegation':
			 var i = tag_negations[pid].indexOf(e.labelID);
			 if (i >= 0)
				 tag_negations[pid].splice(i, 1);
			 if(tag_negations[pid].length == 0)
				 delete tag_negations[pid];
			 break;
	 }
	 updateAppliedCounter();
	 e.outerHTML = '';
	 resizeMenu();
 }

 function disagreeTag() {
	 var e = this;
	 while (!(e.classList.contains('MCDetailEntry'))) {
		 if (e.parentNode.id == 'MCRightClickMenu')
			 return;
		 e = e.parentNode;
	 }
	 var pid = e.parentNode.pid;
	 if (!(tag_negations[pid])) {
		 tag_negations[pid] = [];
	 }
	 var tn = tag_negations[pid];
	 if (tn.indexOf(e.id) < 0) {
		 tn.push(e.id);
		 var action = createActionButton('Cancel', cancelPendingEntry);
		 var entry = createDetailEntry('T', username, 'PENDING', 'N/A', 'NO: ' + getLabelById(e.id, true), action, 'blue')
		 entry.type = 'tagNegation';
		 entry.labelID = e.id;
		 document.getElementById('MCRightClickMenu').appendChild(entry);
		 resizeMenu();
	 }
 }

 function createDetailEntryPiece(html, type, color) {
	 var div = document.createElement('div');
	 div.classList.add('MCDetailEntryPiece');
	 div.innerHTML = html;
	 div.cellType = type;
	 div.style.color = color;
	 div.style.borderColor = 'black';
	 return div;
 }

 function createDetailEntry(type, username, time, v, label, action, color) {
	 var entry = document.createElement('div');
	 entry.classList.add('MCDetailEntry');
	 entry.id = type + '-' + username + '-' + label;

	 entry.appendChild(createDetailEntryPiece(type, 'type', color));
	 entry.appendChild(createDetailEntryPiece(username, 'user', color));
	 entry.appendChild(createDetailEntryPiece(time, 'time', color))
	 entry.appendChild(createDetailEntryPiece(v, 'verifications', color))
	 entry.appendChild(createDetailEntryPiece(label, 'label', color))

	 var action_div = document.createElement('div');
	 action_div.classList.add('MCDetailEntryPiece');
	 if (typeof action == 'string' || action instanceof String) {
		 action_div.innerHTML = action;
	 }
	 else {
		 action_div.appendChild(action);
	 }

	 action_div.style.borderRight = '0px';
	 action_div.cellType = 'action';
	 action_div.style.color = color;
	 action_div.style.borderColor = 'black';
	 entry.appendChild(action_div);

	 return entry;
 }

 function resizeMenu() {
	 var total_width = 0;
	 var cells = document.getElementsByClassName('MCDetailEntryPiece');
	 var widths = {};
	 var heights = {};
	 var firstrow; // doesn't actually need to be first... just one at random
	 for (var n = 0; n < cells.length; n++) {
		 var cell = cells[n];
		 cell.style.width = 'auto'; // reset for a second
		 cell.style.height = 'auto';
		 cell.style.lineHeight = 'initial';
		 var w = cell.offsetWidth;
		 var h = cell.offsetHeight;
		 var parent = cell.parentNode.id;
		 if (!firstrow)
			 firstrow = parent;
		 if (!(cell.cellType in widths))
			 widths[cell.cellType] = 0;
		 if (!(parent in heights))
			 heights[parent] = 0;
		 if (w > widths[cell.cellType]) {
			 widths[cell.cellType] = w;
		 }
		 if (h > heights[parent])
			 heights[parent] = h;
	 }
	 for (var n = 0; n < cells.length; n++) {
		 var cell = cells[n];
		 cell.style.width = widths[cell.cellType] + 'px';
		 cell.style.height = heights[cell.parentNode.id] + 'px';
		 cell.style.lineHeight = cell.style.height;
		 if (firstrow == cell.parentNode.id) {
			 total_width += widths[cell.cellType];
		 }
	 }
	 total_width += 29; // hardcoded compensation for .offsetWidth not including padding + borders (it should?!)
	 document.getElementById('MCRightClickMenu').style.width = total_width + 'px';

	 var btns = document.getElementsByClassName('MCDetailActionButton');
	 for (var n = 0; n < btns.length; n++) {
		 var btn = btns[n];
		 var margin = (btn.parentNode.offsetHeight - btn.offsetHeight) / 2;
		 btn.style.marginTop = (margin - 1) + 'px';
		 btn.parentNode.style.paddingTop = '0';
	 }
 }

 function getClassificationsForPid(pid) {
	 var results = [];
	 var c = classifications[pid];

	 if (c['accepted_classification'])
		 results.push(buildEntryLabels(c['accepted_classification']));
	 if (c['other_classifications']) {
		 for (var n = 0; n < c['other_classifications'].length; n++)
			 results.push(buildEntryLabels(c['other_classifications'][n]));
	 }

	 return results;
 }

 function getTagsForPid(pid) {
	 var results = [];
	 var c = classifications[pid];
	 if (c['tags']) {
		 for (var n = 0; n < c['tags'].length; n++) {
			 results.push(buildEntryLabels(c['tags'][n], true));
		 }
	 }
	 return results;
 }

 function getPendingClassificationsForPid(pid) {
	 var results = [];
	 if (classification_updates[pid]) {
		 var dict = {};
		 dict['user'] = username;
		 dict['time'] = 'PENDING';
		 dict['verifications'] = 'N/A';
		 dict['label'] = getLabelById(classification_updates[pid], false)
		 dict['id'] = classification_updates[pid];
		 dict['color'] = 'blue';
		 results.push(dict)
	 }
	 return results;
 }

 function getPendingTagsForPid(pid) {
	 var results = [];
	 if (tag_updates[pid]) {
		 var dict = {};
		 dict['user'] = username;
		 dict['time'] = 'PENDING';
		 dict['verifications'] = 'N/A';
		 dict['label'] = getLabelById(tag_updates[pid], true)
		 dict['id'] = tag_updates[pid];
		 dict['color'] = 'blue';
		 results.push(dict)
	 }
	 if (tag_negations[pid]) {
		 var tn = tag_negations[pid];
		 for (var n = 0; n < tn.length; n++) {
			 var dict = {};
			 dict['user'] = username;
			 dict['time'] = 'PENDING';
			 dict['verifications'] = 'N/A';
			 dict['label'] = 'NO: ' + getLabelById(tn[n], true)
			 dict['id'] = tn[n];
			 dict['color'] = 'blue';
			 dict['negation'] = true;
			 results.push(dict);
		 }
	 }
	 return results;
 }

 function buildEntryLabels(c, tag) {
	 var dict = {};
	 if (c['time']) {
		 var d = c['verification_time'] ? new Date(c['verification_time']) : new Date(c['time']);
		 dict['time'] = d.toLocaleDateString();
	 }
	 else {
		 dict['time'] = 'N/A';
	 }
	 dict['verifications'] = c['user'] == -1 ? 'N/A' : (c['verifications'] || 0) + ' times';
	 dict['id'] = c['tag_id'];
	 dict['user'] = c['username'];
	 if (tag) {
		 dict['label'] = getLabelById(c['tag_id'], true);
		 dict['negation'] = c['negation'];
		 dict['color'] = 'black';
		 if (c['negation'] == true)
			 dict['label'] = 'NO: ' + dict['label'];
		 if (c['accepted'] == false)
			 dict['color'] = 'red';
	 }
	 else {
		 dict['label'] = getLabelById(c['classification_id'], false);
	 }
	 return dict;
 }
