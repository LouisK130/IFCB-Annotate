$(function() {

    let TIMESERIES = null;

    let main = $('#main-form');
    let page1 = $('#page1');
    let tspage = $('#timeseries-page');
    let binpage = $('#bin-page');
    let addoptions = $('#add-options');
    let recents = $('#recent-bins');
    let alert = $('#alert');

    $('#date-start').datetimepicker();
    $('#date-end').datetimepicker();
    $('#date-start').data('DateTimePicker').useCurrent('day');
    $('#date-end').data('DateTimePicker').useCurrent('day');

    $.fn.selectpicker.Constructor.DEFAULTS.liveSearchStyle = 'startsWith';

    if (failed != "") {
        showAlert(failed, 'alert-danger');
    }
    
    $('#import-checkbox').change(function() {
        setCookie('import', $(this).prop('checked'), 365);
    });

    // don't actually delete the alert, we'll want to show it again later
    $('#alert-close').click(function() {
        alert.fadeTo(500, 0);
    });

    if (getCookie('timeseries') != '' &&
            $('#timeseries-select option[value="' + getCookie('timeseries') + '"]').length > 0) {
        $('#timeseries-select').selectpicker('val', getCookie('timeseries'));
    }
    
    if (getCookie('datestart') != '') {
        $('#date-start input').val(getCookie('datestart'));
    }
    
    if (getCookie('dateend') != '') {
        $('#date-end input').val(getCookie('dateend'));
    }
    
    if (getCookie('import') != '') {
        if (getCookie('import') == 'true') {
            let cb = $('#import-checkbox');
            cb.find('span').addClass('checked');
            cb.prop('checked', 'true');
        }
    }
    
    if (getCookie('selectedbins') != '') {
        // loop and add bins and ranges
        let cook = getCookie('selectedbins');
        while (cook != '') {
            if (cook.substring(0, 6) == 'range(') {
                cook = cook.substring(6);
                if (cook.indexOf('%|%') < 0) {
                    console.log("ERROR: Malformated selectedbins cookie.");
                    break;
                }
                let start = cook.substring(0, cook.indexOf('%|%'))
                cook = cook.substring(cook.indexOf('%|%') + 3);
                let stop = cook.substring(0, cook.indexOf(');'))
                cook = cook.substring(cook.indexOf(');') + 2);
                let range = createRangeItem(start, stop);
                $('#bin-list').append(range);
                $('#none-selected').css('display', 'none');
            } else if (cook.substring(0, 4) == 'bin(') {
                cook = cook.substring(4);
                if (cook.indexOf('%|%') < 0) {
                    console.log("ERROR: Malformated selectedbins cookie.");
                    break;
                }
                let name = decodeURIComponent(cook.substring(0, cook.indexOf('%|%')));
                cook = cook.substring(cook.indexOf('%|%') + 3);
                let date = cook.substring(0, cook.indexOf(');'));
                cook = cook.substring(cook.indexOf(');') + 2);
                let item = createBinItem(name, date, false);
                $('#bin-list').append(item);
                $('#none-selected').css('display', 'none');
            } else {
                console.log("ERROR: Malformated selectedbins cookie.");
                break;
            }
        }
    }

    $(window).resize(function() {

        if (binpage.height() > 0) {

            addoptions.stop();
            addoptions.css('left', main[0].getBoundingClientRect().left - addoptions[0].getBoundingClientRect().width - 20)
            recents.stop();
            recents.css('left', main[0].getBoundingClientRect().right + 20);

        }

    });

    $(document).on('click', '.glyphicon-plus', function() {
        let recent = $(this).parent().parent().attr('id') == 'recent-list';
        let results = $(this).parent().parent().attr('id') == 'date-list';
        let bin = $(this).parent().detach();
        bin.data("recent", recent);
        bin.data("results", results);
        $('#none-selected').css('display', 'none');
        $('#bin-list').append(bin);
        $(this).removeClass('glyphicon-plus');
        $(this).addClass('glyphicon-remove');
        if ($('#recent-list li').length == 1) {
            $('#no-recents').css('display', 'block');
        }
        updateSelectedBinsCookie();
    });

    $(document).on('click', '.glyphicon-remove', function() {
        let bin = $(this).closest('li').detach();
        if (bin.data('recent')) {
            $('#no-recents').css('display', 'none');
            $('#recent-list').append(bin);
            $(this).removeClass('glyphicon-remove');
            $(this).addClass('glyphicon-plus');
        }
        if (bin.data("results") && $('#date-results').height() > 0) {
            $('#date-list').append(bin);
            $(this).removeClass('glyphicon-remove');
            $(this).addClass('glyphicon-plus');
        }
        if ($('#bin-list li').length == 1) {
            $('#none-selected').css('display', 'block');
        }
        if ($('#views-list li').length == 1) {
            $('#add-view-item').css('max-height', 'calc(100% - 5px');
        }
        updateSelectedBinsCookie();
    });

    $('#classify-button').click(function() {
        page1.stop().animate({
            'height' : 0,
        }, 500, function() {
            let height = tspage.css('height', 'auto').height();
            tspage.height(0);
            tspage.stop().animate({
                'height': height
            }, 500, function() {
                tspage.css('height', 'auto');
            });
            let tsselect = $('#timeseries-page .bootstrap-select');
            tsselect.stop().animate({
                'width' : '350px'
            }, 500);
        });
    });

    $('#timeseries-back').click(function() {
        tspage.stop().animate({
            'height' : 0,
        }, 500, function() {
            let height = page1.css('height', 'auto').height();
            page1.height(0);
            page1.stop().animate({
                'height' : height
            }, 500, function() {
                page1.css('height', 'auto');
            });
            let tsselect = $('#timeseries-page .bootstrap-select');
            tsselect.stop().animate({
                'width' : '0'
            }, 500);
        });
    });

    $('#timeseries-next').click(function() {

        TIMESERIES = $('#timeseries-select').val();
        setCookie('timeseries', TIMESERIES, 365);

        $('#no-recents').css('display', 'block');

        $('#recent-list li').each(function() {
            if ($(this).attr('id') != 'no-recents') {
                $(this).remove();
            }
        });

        let recent_bins = getRecentBins(TIMESERIES);
        for (let n = 0; n < recent_bins.length; n++) {
            let item = recent_bins[n];
            let b = createBinItem(item[0], item[1], true);
            $('#recent-list').append(b);
            $('#no-recents').css("display", "none");
        }

        tspage.stop().animate({
            'height' : 0,
        }, 500, function() {
            let height = binpage.css('height', 'auto').height();
            binpage.height(0);
            binpage.stop().animate({
                'height' : height
            }, 500, function() {
                binpage.css('height', 'auto');
            });
            let tsselect = $('#timeseries-page .bootstrap-select');
            let old_width = tsselect.width();
            tsselect.width(0);
            let left = main[0].getBoundingClientRect().left;
            let right = main[0].getBoundingClientRect().right;
            tsselect.width(old_width);
            tsselect.stop().animate({
                'width' : '0'
            }, 500);
            addoptions.animate({
                'left' : left - addoptions[0].getBoundingClientRect().width - 20
            }, 500);
            recents.animate({
                'left' : right + 20
            }, 500);
        });

    });

    $('#bin-back').click(function() {

        addoptions.animate({
            'left' : 0 - addoptions[0].getBoundingClientRect().width
        }, 500);

        recents.animate({
            'left': '100%'
        }, 500);

        binpage.stop().animate({
            'height' : 0,
        }, 500, function() {
            let height = tspage.css('height', 'auto').height();
            tspage.height(0);
            tspage.stop().animate({
                'height' : height
            }, 500, function() {
                tspage.css('height', 'auto');
            });
            let tsselect = $('#timeseries-page .bootstrap-select');
            tsselect.stop().animate({
                'width' : '350px'
            }, 500);
            if ($('#options-manual').height() > 0) {
                $('#manual-back').click();
            } else if ($('#options-date').height() > 0) {
                $('#date-back').click();
            } else if ($('#date-results').height() > 0) {
                $('#results-back').click();
            }
        });

    });

    $('#recent-clear').click(function() {
        $('#recent-list li').each(function() {
            if ($(this).attr('id') == 'no-recents') {
                $(this).removeAttr("style");
            } else {
                $(this).remove();
            }
        });
        setCookie(TIMESERIES + "_bins", "", 3650);
    });

    $('#add-manual').click(function() {

        $('#options-page1').stop().animate({
            'height' : 0
        }, 500, function() {
            let height = $('#options-manual').css('height', 'auto').height();
            $('#options-manual').height(0);
            $('#options-manual').stop().animate({
                'height' : height
            }, 500, function() {
                $('#options-manual').css('height', 'auto');
            });
        });

    });

    $('#manual-back').click(function() {

        $('#options-manual').stop().animate({
            'height' : 0
        }, 500, function() {
            let height = $('#options-page1').css('height', 'auto').height();
            $('#options-page1').height(0);
            $('#options-page1').stop().animate({
                'height' : height
            }, 500, function() {
                $('#options-page1').css('height', 'auto');
            });
            $('#manual-entry').val('');
        });

    });

    $('#manual-add').click(function() {
        let bins = $('#manual-entry').val().split(/[\s,]+/).filter(Boolean);
        if (bins.length == 0) {
            showAlert("Please input at least one bin.", 'alert-danger');
            return;
        }

        $('#manual-add').prop("disabled", true);
        $('#manual-back').prop("disabled", true);
        $('#bin-back').prop("disabled", true);
        $('#bin-next').prop("disabled", true);
        $('#manual-add').text("Loading...");
        $('#manual-entry').prop("disabled", true);

        function done() {
            $('#manual-add').prop("disabled", false);
            $('#manual-back').prop("disabled", false);
            $('#bin-back').prop("disabled", false);
            $('#bin-next').prop("disabled", false);
            $('#manual-entry').prop("disabled", false);
            $('#manual-add').text("Add");
            $('#manual-entry').val('');
        }

        let stripped = [];
        for(let n = 0; n < bins.length; n++) {
            stripped.push(bins[n].replace(TIMESERIES, ""));
        }

        $.ajax({
            url : '/validatebins/',
            type : 'POST',
            dataType : 'json',
            data : {
                'csrfmiddlewaretoken' : getCookie('csrftoken'),
                'timeseries' : TIMESERIES,
                'bins' : JSON.stringify(stripped)
            },
            success : function(data) {
                for (let n = 0; n < data.good.length; n++) {
                    let item = createBinItem(data.good[n][0], data.good[n][1], false);
                    $('#bin-list').append(item);
                    $('#none-selected').css('display', 'none');
                }
                updateSelectedBinsCookie();
                if (data.bad.length > 0) {
                    showAlert(data.bad.length + " invalid bins were omitted.", 'alert-danger');
                }
                done();
            },
            error : function(){
                showAlert("Something went wrong validating bins. Please try again later.", 'alert-danger');
                done();
            }
        });

    });

    $('#add-date').click(function() {
        $('#options-page1').stop().animate({
            'height' : 0
        }, 500, function() {
            let height = $('#options-date').css('height', 'auto').height();
            $('#options-date').height(0);
            $('#options-date').stop().animate({
                'height' : height
            }, 500, function() {
                $('#options-date').css({
                    'height' : 'auto',
                    'overflow' : 'visible'
                });
            });
        });
    });

    $('#date-back').click(function() {
        $('#options-date').css('overflow', 'hidden')
        $('#options-date').stop().animate({
            'height' : 0
        }, 500, function() {
            let height = $('#options-page1').css('height', 'auto').height();
            $('#options-page1').height(0);
            $('#options-page1').stop().animate({
                'height' : height
            }, 500, function() {
                $('#options-page1').css('height', 'auto');
            });
        });
    });

    let start = $('#date-start input');
    let end = $('#date-end input');

    $('#date-search').click(function() {
        if (!start.val() || !end.val()) {
            showAlert("Please pick two times to search between.", 'alert-danger');
            return;
        }
        
        setCookie('datestart', start.val(), 365);
        setCookie('dateend', end.val(), 365);

        $('#date-search').prop("disabled", true);
        $('#date-back').prop("disabled", true);
        $('#bin-back').prop("disabled", true);
        $('#bin-next').prop("disabled", true);
        $('#date-search').text("Loading...");

        function done() {
            $('#date-search').prop("disabled", false);
            $('#date-back').prop("disabled", false);
            $('#bin-back').prop("disabled", false);
            $('#bin-next').prop("disabled", false);
            $('#date-search').text("Search");
        }

        $.ajax({
            url : '/searchbins/',
            type : 'POST',
            dataType : 'json',
            data : {
                'csrfmiddlewaretoken' : getCookie('csrftoken'),
                'timeseries' : TIMESERIES,
                'start' : start.val(),
                'end' : end.val()
            },
            success : function(data) {
                done();
                if (data.bins.length == 0) {
                    showAlert("No bins found in that range.", 'alert-danger');
                    return;
                }
                if (data.bins.length > 100) {
                    showAlert("Showing only the first 100 results. Use \"Add All\" to add both visible and hidden bins.", 'alert-warning');
                }

                $('#options-date').css('overflow', 'hidden');

                $('#bin-list li').each(function() {
                    $(this).data("results", false);
                });

                for (let n = 0; n < Math.min(100, data.bins.length); n++) {
                    let bin = data.bins[n][0];
                    let date = data.bins[n][1];
                    let item = createBinItem(bin, date, true);
                    $('#date-list').append(item);
                }
                $('#options-date').stop().animate({
                    'height' : 0
                }, 500, function() {
                    let height = $('#date-results').css('height', 'auto').height();
                    $('#date-results').height(0);
                    $('#date-results').stop().animate({
                        'height' : height
                    }, 500, function() {
                        $('#date-results').css('height', 'auto');
                    });
                });
            },
            error : function(){
                showAlert("Something went wrong searching for bins. Please try again later.", 'alert-danger');
                done();
            }
        });

    });

    $('#results-back').click(function() {
        $('#date-results').stop().animate({
            'height' : 0
        }, 500, function() {
            let height = $('#options-page1').css('height', 'auto').height();
            $('#options-page1').height(0);
            $('#options-page1').stop().animate({
                'height' : height
            }, 500, function() {
                $('#options-page1').css('height', 'auto');
                $('#date-list li').remove();
            });
        });
    });

    $('#results-add-all').click(function() {
        $('#date-list li').each(function() {
            $(this).remove();
        });
        let item = createRangeItem(start.val(), end.val());
        $('#bin-list').append(item);
        $('#none-selected').css('display', 'none');
        $('#results-back').click();
        updateSelectedBinsCookie();
    });

    $('#bin-next').click(function() {
        if ($('#none-selected').css('display') != 'none') {
            showAlert("You must select at least 1 bin.", 'alert-danger');
            return;
        } else {
            $('#bin-page').animate({
                'height' : 0
            }, 500, function() {
                let height = $('#views-page').css('height', 'auto').height();
                $('#views-page').height(0);
                $('#views-page').animate({
                    'height' : height
                }, 500, function() {
                    $('#views-page').css('height', 'auto');
                });
                let width = $('#views-page .radio').css('width', 'auto').width();
                $('#views-page .radio').width(0);
                $('#views-page .radio').animate({
                    'width' : width
                }, 500, function() {
                    $('#views-page .radio').css('width', 'auto');
                });
                $('#views-list').animate({
                    'width' : 500
                }, 500);
            });
            $('#add-options').animate({
                'left' : '-300px'
            }, 500, function() {
                if ($('#options-manual').height() > 0) {
                    $('#manual-back').click();
                } else if ($('#options-date').height() > 0) {
                    $('#date-back').click();
                } else if ($('#date-results').height() > 0) {
                    $('#results-back').click();
                }
            });
            $('#recent-bins').animate({
                'left' : '100%'
            }, 500);
        }
    });

    $('#views-back').click(function() {
        $('#views-page').animate({
            'height' : 0
        }, 500, function() {
            $('#views-page .radio').animate({
                'width' : 0
            }, 500);
            let height = $('#bin-page').css('height', 'auto').height();
            $('#bin-page').height(0);
            $('#bin-page').animate({
                'height' : height
            }, 500, function() {
                $('#bin-page').css('height', 'auto');
            });
            $('#views-list').width(0);
            let left = main[0].getBoundingClientRect().left;
            let right = main[0].getBoundingClientRect().right;
            $('#views-list').width(500);
            addoptions.animate({
                'left' : left - addoptions[0].getBoundingClientRect().width - 20
            }, 500);
            recents.animate({
                'left' : right + 20
            }, 500);
        });
        $('#views-list').animate({
            'width' : 256
        }, 500);
    });

    $('#views-next').click(function() {
        let bins = $('#bin-list .bin-name');
        let string = ""
        for (let n = 0; n < bins.length; n++) {
            addRecentBinToCookies(bins[n].innerHTML, $(bins[n]).parent().find('.bin-date')[0].innerHTML, TIMESERIES);
            string = string + bins[n].innerHTML + ","
        }
        string = string.substring(0, string.length - 1);

        let timeranges = [];

        $('#bin-list').find('.time-range').each(function() {
            let tr = [];
            let dates = $(this).find('.bin-date');
            tr.push(dates[0].innerHTML);
            tr.push(dates[1].innerHTML);
            timeranges.push(tr);
        });

        let views = [];

        $('#views-list').find('.list-group-item').each(function() {
            if ($(this).attr('id') == 'add-view-item') {
                return;
            }
            let selects = $(this).find('select');
            let view = [];
            view.push(Math.round(selects[0].value));
            let tags = [];
            for (let n = 0; n < selects[1].selectedOptions.length; n++) {
                let opt = selects[1].selectedOptions[n];
                if (opt.value == 'SMART') {
                    tags = ['SMART'];
                    break;
                } else if (opt.value == 'ANY') {
                    tags = ['ANY'];
                    break;
                }
                tags.push(opt.value);
            }
            view.push(tags);
            views.push(view);
        });

        var form = document.createElement('form');
        form.action = '/classify/';
        form.method = 'POST';

        form.appendChild(createInput('bins', string));
        form.appendChild(createInput('timeranges', JSON.stringify(timeranges)));
        form.appendChild(createInput('timeseries', TIMESERIES));
        form.appendChild(createInput('import', $("#import-checkbox")[0].checked));
        form.appendChild(createInput('views', JSON.stringify(views)));
        form.appendChild(createInput('sortby', $('#views-page input:radio:checked').val()));
        form.appendChild(createInput('csrfmiddlewaretoken', getCookie('csrftoken')));

        $('body').append(form);
        form.submit();
    });

    $('#add-view-btn').click(function() {
        let v = $('#view-template').clone();
        v.find('.bootstrap-select').each(function() {
            $(this).find('select').insertBefore($(this));
        });
        v.removeAttr('id');
        v.find('.bootstrap-select').remove();
        $('#add-view-item').css('max-height', '45px');
        // $('#add-view-btn').css('top', '23px');
        v.insertBefore($('#add-view-item'));
        v.find('select').each(function() {
            $(this).selectpicker();
        });
    });

    function createBinItem(name, time, add) {

        let btnCls = add ? "glyphicon glyphicon-plus" : "glyphicon glyphicon-remove";

        return `
            <li class='list-group-item'>
                <div class="bin-name">` + name + `</div>
                <div class="bin-date">` + time + `</div>
                <span role="button" class="` + btnCls + `"></span>
            </li>
        `;
    }

    function createRangeItem(begin, end) {
        return `
            <li class='list-group-item time-range'>
                <div class='title'>Time Range</div>
                <div class='bin-date'>` + begin + `</div>
                <div class='bin-date'>` + end + `</div>
                <span role='button' class='glyphicon glyphicon-remove'></span>
            </li>
        `;
    }

    function showAlert(message, cls) {
        alert.removeClass('alert-success');
        alert.removeClass('alert-danger');
        alert.removeClass('alert-warning');
        alert.addClass(cls);
        $('#alert-message').html(message);
        alert.css('opacity', '0');
        alert.fadeTo(500, 1.0)
    }
    
    function updateSelectedBinsCookie() {
        let str = "";
        $('#bin-list').find('.list-group-item').each(function() {
            if ($(this).attr('id') == 'none-selected') return;
            // %|% is just some weirdly specific pattern that I hope won't appear in bin names...
           if ($(this).hasClass('time-range')) {
               let dates = $(this).find('.bin-date');
               str += "range(" + dates[0].innerHTML + '%|%' + dates[1].innerHTML + ');'
           } else {
               str += "bin(" + encodeURIComponent($(this).find('.bin-name').html()) + '%|%' + $(this).find('.bin-date').html() + ');'
           }
        });
        setCookie('selectedbins', str, 365);
    }

});
