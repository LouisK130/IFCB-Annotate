// Listeners and logic for area selection
var mouseX1;
var mouseY1;
window.addEventListener('mousedown', function(event) {
    var ele = event.target || event.srcElement;
    if (!(isDescendant(document.getElementById('MCRightClickMenu'), ele)))
        deleteRightClickMenu();
    if (!(ele.classList))
        return;
    if (event.button != 0) // left click
        return;
    if (!(ele == document.body ||
          ele.classList.contains('MCTarget') ||
          ele.classList.contains('MCImg') ||
          ele.id == 'MCTargetContainer')) {
        return;
    }
    mouseX1 = event.clientX;
    mouseY1 = event.clientY;
    var box = document.createElement('div');
    box.id = 'MCSelectAreaBox';
    box.style.outlineStyle = 'solid';
    box.style.outlineWidth = '1px';
    box.style.outlineColor = 'red';
    box.style.position = 'fixed';
    box.style.left = mouseX1 + 'px';
    box.style.top = mouseY1 + 'px';
    box.style.backgroundColor = 'rgba(0,0,0,.5)';
    document.body.appendChild(box);
});

window.addEventListener('mousemove', function(event) {
    if (mouseX1) { // means mouse is down
        var box = document.getElementById('MCSelectAreaBox');
        if (event.clientX < mouseX1) {
            box.style.left = event.clientX + 'px';
            box.style.width = (mouseX1 - event.clientX) + 'px';
        }
        else {
            box.style.width = (event.clientX - mouseX1) + 'px';
        }
        if (event.clientY < mouseY1) {
            box.style.top = event.clientY + 'px';
            box.style.height = (mouseY1 - event.clientY) + 'px';
        }
        else {
            box.style.height = (event.clientY - mouseY1) + 'px';
        }
    }
});

window.addEventListener('mouseup', function(event) {
    var targets = document.getElementsByClassName('MCTarget');
    var box = document.getElementById('MCSelectAreaBox');
    for(var n = 0; n < targets.length; n++) {
        var target = targets.item(n);
        if (isClippedByBox(target, box)) {
            applyToTile(target);
        }
    }
    mouseX1 = null;
    mouseY1 = null;
    if (box)
        box.outerHTML = '';
});
