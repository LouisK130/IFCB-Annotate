var mouse_x = 0;
var mouse_y = 0;

document.addEventListener('mousemove', updateMousePos, false);

function updateMousePos(e) {
    mouse_x = e.clientX;
    mouse_y = e.clientY;
}

document.addEventListener('mouseup', deleteContextMenu, false);

function deleteContextMenu(e) {
    var menu = document.getElementById('MCContextMenu');
    if (!(menu))
        return;
    if (!(e.target == menu || menu.contains(e.target))) {
        menu.outerHTML = '';
		return;
    }
}

function createContextMenu() {
    var menu = document.createElement('div')
    menu.id = 'MCContextMenu';
    menu.style.width = '200px'
    menu.style.minHeight = '296px';
    menu.style.position = 'fixed';
    menu.style.left = mouse_x + 'px';
    menu.style.top = mouse_y + 'px';
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

    for (var n = -1; n < recents.length; n++) {
        var option;
        
        if (n == -1) {
            var verify_c = $('#class-select')[0].value;
            if (verify_c == 'ANY')
                verify_c = '';
            let ts = $('#tag-select')[0].selectedOptions;
            let v_tags = [];
            for (let n = 0; n < ts.length; n++) {
                if (ts[n].value == 'ANY') {
                    v_tags = [];
                    break;
                }
                v_tags.push(parseInt(ts[n].value));
            }
            option = createApplicationOption(verify_c, v_tags);
            option.style.borderTop = '2px solid';
            option.style.marginTop = '-2px';
        }
        else {
            var r = recents[n];
            option = createApplicationOption(r[0], r[1]);
        }
        
        menu.appendChild(option);
        var clas = option.children[0];
        var tag = option.children[1];
        // Probably an inefficient way to resize, but certainly the easiest for me; let CSS do the math
	for (let i = 0; i < 200; i++) {
		if (clas.scrollWidth > clas.clientWidth || tag.scrollWidth > tag.clientWidth) {
			$(menu).width($(menu).width() + 1);
		} else {
			break;
		}
	}
    }
	
    if ($(menu).width() > 200) {
    	$(menu).width($(menu).width() + 30)
    }
    
    keepElementOnScreen(menu);
    
}

function createApplicationOption(c, t, menu) {
    var div = document.createElement('div');
    div.style.borderBottom = '1px solid';
    div.style.borderTop = '1px solid';
    div.style.marginBottom = '-1px';
    div.style.marginTop = '-1px';
    div.style.height = '25px';
    div.classification = c;
    div.tags = t;
    div.style.cursor = 'hand';
    
    div.onmouseover = function() {
        this.style.backgroundColor = 'rgb(175, 229, 255)';
    }
    
    div.onmouseout = function() {
        this.style.backgroundColor = 'white';
    }
    
    div.onclick = function() {
        let c = $('#class-apply-select');
        let t = $('#tag-apply-select');
        c.selectpicker('val', this.classification);
        t.selectpicker('val', this.tags);
        document.getElementById('MCContextMenu').outerHTML = "";
    }
    
    var [cl, tl] = getLabelsForCombo(c, t);
    
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
