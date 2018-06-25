$(function() {
    
    // flag for whether or not the form is expanded
	let registering = false;

	let btn1 = $('#form-submit-1');
	let btn2 = $('#form-submit-2');
	let regBlock = $('#hidden-register');
    let form = $('#login-form');
    let alert = $('#alert');
    
    // don't actually delete the alert, we'll want to show it again later
    $('#alert-close').click(function() {
        alert.fadeTo(500, 0);
    });
    
    // some custom form validation
    let u = $('#form-username');
    let pw1 = $('#form-password');
    let pw2 = $('#form-confirm');
    function validate() {
        if (!u.val().match(/^[0-9a-z]+$/) && registering) {
            u[0].setCustomValidity("Username can only contain letters and numbers.");
        } else {
            if (u.val().length < 4 && registering) {
                u[0].setCustomValidity("Username must be atleast 4 characters.");
            } else {
                u[0].setCustomValidity("");
            }
        }
        if (pw1.val().length < 8) {
            pw1[0].setCustomValidity("Password must be atleast 8 characters.");
            pw2[0].setCustomValidity("");
            return;
        } else {
            pw1[0].setCustomValidity("");
        }
        if (pw1.val() != pw2.val() && registering) {
            pw2[0].setCustomValidity("Passwords don't match.");
        } else {
            pw2[0].setCustomValidity("");
        }
    }
    pw1.on('keyup', validate);
    pw2.on('keyup', validate);
    u.on('keyup', validate);
    
    form.on('submit', function(e) {
        e.preventDefault();
        if (registering) {
            btn2.click();
        } else {
            btn1.click();
        }
        return false;
    });
    
    // if red is false, the alert is green
    function showAlert(message, red) {
        if(red) {
            alert.removeClass('alert-success');
            alert.addClass('alert-danger');
        } else {
            alert.removeClass('alert-danger');
            alert.addClass('alert-success');
        }
        $('#alert-message').html(message);
        alert.css('opacity', '0');
        alert.fadeTo(500, 1.0)
    }
	
	btn2.click(function() {
		if(!registering) {
            // if not registering, btn2 expands the form to registration
			registering = true;
			regBlock.animate({
				'height' : regBlock.get(0).scrollHeight
			}, 500);
			btn2.removeClass('btn-secondary');
			btn2.addClass('btn-primary');
			btn1.removeClass('btn-primary');
			btn1.addClass('btn-secondary');
			btn1.html('Back');
            regBlock.find('input').prop('required', true);
		} else {
            // if registering, btn2 attempts to submit
            if (!form[0].checkValidity()) {
                // dummy submit forces the browser to display validation errors
                $('#dummy-submit').click();
                return false;
            }
            btn1.addClass('disabled');
            btn2.addClass('disabled');
            $.post('/register/', {
                'username' : $('#form-username').val(),
                'password' : $('#form-password').val(),
                'email' : $('#form-email').val(),
                'csrfmiddlewaretoken' : getCookie('csrftoken')
            }, function(data, status) {
                if (data.message) {
                    showAlert(data.message, data.red);
                }
                btn1.removeClass('disabled');
                btn2.removeClass('disabled');
            });
		}
	});
	
	btn1.click(function() {
		if (registering) {
            // registering, btn1 shrinks the form back to login only
			registering = false;
			regBlock.animate({
				'height' : '0'
			}, 500, function() {
				regBlock.find("input").val("");
			});
			btn1.removeClass('btn-secondary');
			btn1.addClass('btn-primary');
			btn2.removeClass('btn-primary');
			btn2.addClass('btn-secondary');
			btn1.html('Login');
            regBlock.find('input').prop('required', false);
		} else {
            // if not registering, btn1 attempts to submit login
            if (!form[0].checkValidity()) {
                // dummy submit forces the browser to display validation errors
                $('#dummy-submit').click();
                return false;
            }
            btn1.addClass('disabled');
            btn2.addClass('disabled');
            $.post('/login/', {
                'username' : $('#form-username').val(),
                'password' : $('#form-password').val(),
                'csrfmiddlewaretoken' : getCookie('csrftoken')
            }, function(data, status) {
                btn1.removeClass('disabled');
                btn2.removeClass('disabled');
                if (data.message) {
                    showAlert(data.message, data.red);
                }
                if (data.redirect) {
                    // on successful login, goto the redirect
                    window.location.href = data.redirect;
                }
            });
		}
	});
	
});