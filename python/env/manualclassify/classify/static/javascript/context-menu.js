var keyCode = 67; // this is C

var mouse_x = 0;
var mouse_y = 0;

document.addEventListener('mousemove', updateMousePos, false);

function updateMousePos(e) {
	mouse_x = e.clientX;
	mouse_y = e.clientY;
}

document.addEventListener('keydown', contextMenuKeyDown, false);

function contextMenuKeyDown(e) {
	if (e.keyCode == keyCode) {
		var menu = document.getElementById('MCContextMenu');
		if (menu) {
			menu.outerHTML = '';
		}
		else if (document.activeElement == document.body) {
			createContextMenu()
		}
	}
}

document.addEventListener('mouseup', deleteContextMenu, false);

function deleteContextMenu(e) {
	var menu = document.getElementById('MCContextMenu');
	if (!(menu))
		return;
	if (!(e.target == menu || menu.contains(e.target))) {
		menu.outerHTML = '';
	}
}

function createContextMenu() {
	var old_menu = document.getElementById('MCContextMenu');
	if (old_menu)
		old_menu.outerHTML = '';
	
	var menu = document.createElement('div')
	menu.id = 'MCContextMenu';
	menu.style.width = '200px'
	menu.style.height = '296px';
	menu.style.position = 'absolute';
	menu.style.left = mouse_x;
	menu.style.top = mouse_y;
	menu.style.backgroundColor = 'white';
	menu.style.outlineWidth = '2px';
	menu.style.outline = 'solid';
	
	var title = document.createElement('div');
	title.style.textAlign = 'center';
	title.innerHTML = '<b>Recent Applications</b>';
	menu.appendChild(title);
	
	var cTitle = document.createElement('div');
	cTitle.style.textAlign = 'center';
	cTitle.style.cssFloat = 'left';
	cTitle.style.width = '50%';
	cTitle.style.marginBottom = '3px';
	cTitle.innerHTML = '<b>Classification</b>';
	menu.appendChild(cTitle);
	
	var tTitle = document.createElement('div');
	tTitle.style.marginLeft = '50%';
	tTitle.style.textAlign = 'center';
	tTitle.style.width = '50%';
	tTitle.style.marginBottom = '3px';
	tTitle.innerHTML = '<b>Tag</b>';
	
	menu.appendChild(tTitle);
	document.body.appendChild(menu);
	
	var recents = getRecentApplications();

	for (var n = 0; n < recents.length; n++) {
		var r = recents[n];
		var option = createApplicationOption(r[0], r[1], n == 0);
		menu.appendChild(option);
		var clas = option.children[0];
		var tag = option.children[1];
		// Probably an inefficient way to resize, but certainly the easiest for me; let CSS do the math
		while (clas.scrollWidth > clas.clientWidth || tag.scrollWidth > tag.clientWidth)
			menu.style.width = menu.offsetWidth + 1 + 'px';
	}
	
	if (menu.offsetWidth > 200)
		menu.style.width = (menu.offsetWidth + 30) + 'px';
	
	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	width -= 10;
	var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	height -= 10;
	var rect = menu.getBoundingClientRect();
	
	if (rect.right >= width)
		menu.style.left = width - menu.offsetWidth + 'px';
	if (rect.bottom >= height)
		menu.style.top = height - menu.offsetHeight + 'px';
	
}

function createApplicationOption(c, t, first) {
	var div = document.createElement('div');
	div.style.borderBottom = '1px solid';
	div.style.borderTop = '1px solid';
	div.style.marginBottom = '-1px';
	div.style.marginTop = '-1px';
	div.style.height = '25px';
	div.classification = c;
	div.tag = t;
	div.style.cursor = 'hand';
	
	div.onmouseover = function() {
		this.style.backgroundColor = 'rgb(175, 229, 255)';
	}
	
	div.onmouseout = function() {
		this.style.backgroundColor = 'white';
	}
	
	div.onclick = function() {
		document.getElementById('ClassificationApplicationSelection').value = this.classification;
		document.getElementById('TagApplicationSelection').value = this.tag;
		document.getElementById('MCContextMenu').outerHTML = "";
	}
	
	if (first) {
		div.style.borderTop = '2px solid';
		div.style.marginTop = '-2px';
	}
	
	[cl, tl] = getLabelsForCombo(c, t);
	
	var clas = document.createElement('div');
	clas.style.width = '50%';
	clas.style.height = '100%';
	clas.style.textAlign = 'center';
	clas.style.lineHeight = div.style.height;
	clas.style.cssFloat = 'left';
	clas.style.borderRight = '1px solid';
	clas.style.whiteSpace = 'nowrap';
	clas.innerHTML = cl;
	div.appendChild(clas);
	
	var tag = document.createElement('div');
	tag.style.width = '50%';
	tag.style.height = '100%';
	tag.style.lineHeight = div.style.height;
	tag.style.textAlign = 'center';
	tag.style.marginLeft = '50%';
	tag.style.whiteSpace = 'nowrap';
	tag.innerHTML = tl;
	div.appendChild(tag);

	return div;
}