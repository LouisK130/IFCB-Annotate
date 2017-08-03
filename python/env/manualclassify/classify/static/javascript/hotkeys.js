var FORWARD_KEY = 78; // N
var PREVIOUS_KEY = 80; // P
var CONTEXT_MENU_KEY = 76; // L
var SUBMIT_UPDATES_KEY = 13; // ENTER
var VERIFY_ALL_KEY = 219; // [

document.addEventListener('keydown', generalKeyDown, false);

function generalKeyDown(e) {
	if (e.keyCode == FORWARD_KEY ||
		e.keyCode == PREVIOUS_KEY ||
		e.keyCode == CONTEXT_MENU_KEY ||
		e.keyCode == SUBMIT_UPDATES_KEY ||
		e.keyCode == VERIFY_ALL_KEY) {
		if (document.activeElement.className == 'MCSelectBox') {
			document.activeElement.blur();
			e.preventDefault();
		}
		switch (e.keyCode) {
			case FORWARD_KEY:
				moveToNextView();
				break;
			case PREVIOUS_KEY:
				moveToPreviousView();
				break;
			case CONTEXT_MENU_KEY:
				createContextMenu()
				break;
			case SUBMIT_UPDATES_KEY:
				submitUpdates();
				break;
			case VERIFY_ALL_KEY:
				var targets = getAllVisibleTargets();
				var c = document.getElementById('ClassificationApplicationSelection');
				var t = document.getElementById('TagApplicationSelection');
				var old_c = c.value;
				var old_t = t.value;
				var verify_c = document.getElementById('MCClassificationSelection').value;
				if (verify_c == 'ALL')
					verify_c = '';
				var verify_t = document.getElementById('MCTagSelection').value;
				if (verify_t == 'ALL' || verify_t == 'NONE')
					verify_t = '';
				c.value = verify_c;
				t.value = verify_t;
				for (var n = 0; n < targets.length; n++)
					targets[n].click();
				c.value = old_c;
				t.value = old_t;
				break;
		}
	}

}

function moveToNextView() {
	submitUpdates();
	var c = document.getElementById('MCClassificationSelection');
	var t = document.getElementById('MCTagSelection');
	if (t.selectedIndex == t.options.length-1) {
		if (c.selectedIndex != c.options.length-1) {
			c.selectedIndex = c.selectedIndex + 1;
			t.value = 'NONE';
		}
		else {
			return;
		}
	}
	else {
		t.selectedIndex = t.selectedIndex + 1;
	}
	reloadTargets();
	if (current_targets.length == 0)
		moveToNextView();
}

function moveToPreviousView() {
	submitUpdates();
	var c = document.getElementById('MCClassificationSelection');
	var t = document.getElementById('MCTagSelection');
	if (t.value == 'NONE' || t.value == 'ALL') {
		if (c.selectedIndex != 1) {
			c.selectedIndex = c.selectedIndex - 1;
			t.selectedIndex = t.options.length - 1;
		}
		else {
			return;
		}
	}
	else {
		t.selectedIndex = t.selectedIndex - 1;
	}
	reloadTargets();
	if (current_targets.length == 0)
		moveToPreviousView();
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