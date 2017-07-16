var FORWARD_KEY = 78; // N
var PREVIOUS_KEY = 80; // P
var CONTEXT_MENU_KEY = 67; // C
var SUBMIT_UPDATES_KEY = 13; // ENTER

document.addEventListener('keydown', generalKeyDown, false);

function generalKeyDown(e) {
	if (e.keyCode == FORWARD_KEY || e.keyCode == PREVIOUS_KEY || e.keyCode == CONTEXT_MENU_KEY || e.keyCode == SUBMIT_UPDATES_KEY) {
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
		}
	}

}

function moveToNextView() {
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