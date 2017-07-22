// `mouse_x` and `mouse_y` are tracked by context-menu.js

function createRightClickMenu(pid) {
	
	deleteRightClickMenu();
	
	var div = document.createElement('div')
	div.id = 'MCRightClickMenu';
	div.innerHTML = pid;
	div.style.position = 'fixed';
	div.style.left = mouse_x;
	div.style.top = mouse_y;
	div.style.backgroundColor = 'white';
	div.style.outline = 'solid';
	div.style.outlineWidth = '1px';
	
	keepElementOnScreen(div);
	
	document.body.appendChild(div);
}

function deleteRightClickMenu() {
	var menu = document.getElementById('MCRightClickMenu');
	if (menu)
		menu.outerHTML = '';
}