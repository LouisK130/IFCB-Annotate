// https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function addRecentBinToCookies(new_bin) {
	var bins = getRecentBins();
	for (var n = 0; n < bins.length; n++) {
		if (bins[n] == new_bin)
			bins.splice(n, 1);
	}
	if (bins.length == 10)
		bins.splice(bins.length-1, 1);
	bins.splice(0, 0, new_bin);
	bins_string = bins.join();
	setCookie('MCRecentBins', bins_string, 3650);
}

function getRecentBins() {
	var bins_string = getCookie('MCRecentBins');
	var bins = bins_string.split(',');
	if (bins_string.length == 0)
		bins = [];
	return bins;
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
	// this seems to (USUALLY) trigger a regular click event, so no need to do it twice
	//if (box.left > rect.left && box.right < rect.right && box.top > rect.top && box.bottom < rect.bottom) // box is entirely within the element
		//return true;
	return false;
}