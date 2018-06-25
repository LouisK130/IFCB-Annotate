import re
import time
import logging
import requests
import iso8601
import json
from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django import forms
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings
from datetime import datetime
from classify import utils, database, config

logger = logging.getLogger(__name__)

def alertResponse(msg, red=True):
    return HttpResponse(json.dumps({
        'red' : red,
        'message' : msg
    }), content_type="application/json")
    
def redirectResponse(to):
    return HttpResponse(json.dumps({
        'redirect' : to
    }), content_type="application/json")

# Create your views here.
class HomePageView(TemplateView):
    def get(self, request, **kwargs):
        if not request.user.is_authenticated:
            return redirect(settings.LOGIN_URL)
        database.loadAllTimeseries()
        return render(request, 'index.html', {
            'failed' : request.session.pop('failed', ''),
            'username' : request.user.username,
            'timeseries_list' : database.timeseries_ids.keys(),
            'classification_labels' : database.getClassificationList(),
            'tag_labels' : database.getTagList(),
            'bins' : request.session.pop('bins', []),
        })
        
class LoginPageView(TemplateView):
    def get(self, request, **kwargs):
        return render(request, 'login.html', {})
    def post(self, request, **kwargs):
        if request.method == 'POST':
            username = request.POST.get('username')
            password = request.POST.get('password')
            user = authenticate(request=request, username=username, password=password)
            if user is not None:
                if (user.is_active):
                    login(request, user)
                    return redirectResponse("/")
                else:
                    return alertResponse("This account needs to be enabled by an administrator, please email epeacock@whoi.edu.")
            else:
                return alertResponse("Invalid credentials.")

def validate_username(username):
    return re.match(r'[A-Za-z][a-zA-Z0-9]*', username)

def validate_email(email):
    return re.match(r'[^@]+@[^@]+\.[^@]+', email)

def validate_password(password):
    return len(password) >= 8
    
class ValidateBinsView(TemplateView):
    def post(self, request, **kwargs):
        ts = request.POST.get('timeseries')
        bins = json.loads(request.POST.get('bins'))
        good = []
        bad = []
        for bin in bins:
            url = ts + bin + '_short.json'
            r = requests.get(url, allow_redirects=True)
            if r.status_code == 200:
                bin = r.json()['pid'].replace(ts, '')
                date = iso8601.parse_date(r.json()['date']).strftime("%b %e, %Y %I:%M %p").replace(" 0", " ")
                good.append((bin, date))
            else:
                bad.append(bin)
        return HttpResponse(json.dumps({
            'good' : good,
            'bad' : bad
        }), content_type="application/json")
        
class SearchBinsView(TemplateView):
    def post(self, request, **kwargs):
        ts = request.POST.get('timeseries')
        start = request.POST.get('start')
        end = request.POST.get('end')
        start = datetime.strptime(start, '%m/%d/%Y %I:%M %p')
        end = datetime.strptime(end, '%m/%d/%Y %I:%M %p')
        start = start.strftime('%Y-%m-%dT%H:%M:00')
        end = end.strftime('%Y-%m-%dT%H:%M:00')
        url = ts + 'api/feed/temperature/start/' + start + '/end/' + end
        bins = []
        r = requests.get(url)
        for dict in r.json():
            bin = dict['pid'].replace(ts, '')
            date = iso8601.parse_date(dict['date']).strftime("%b %e, %Y %I:%M %p").replace(" 0", " ")
            bins.append((bin, date))
        return HttpResponse(json.dumps({
            'bins' : bins
        }), content_type="application/json")
        

class RegisterPageView(TemplateView):
    def get(self, request, **kwargs):
        return render(request, 'register.html')
    def post(self, request, **kwargs):
        username = request.POST.get('username')
        password = request.POST.get('password')
        email = request.POST.get('email')
        # limit number of inactive users
        n_inactive = User.objects.filter(is_active=False).count()
        inactive_user_limit = settings.INACTIVE_USER_LIMIT
        if n_inactive > inactive_user_limit:
            logger.warn('inactive users over the limit of {}'.format(inactive_user_limit))
            return alertResponse("Something went wrong. Please try again later.")
        if User.objects.filter(username=username).exists():
            return alertResponse("That username is already in use.")
        if User.objects.filter(email=email).exists():
            return alertResponse("That email is already in use.")
        if not validate_username(username):
            return alertResponse("Your username can only contain letters and numbers.")
        if not validate_email(email):
            return alertResponse("Please enter a valid email.")
        if not validate_password(password):
            return alertResponse("Your password must be atleast 8 characters.")
        user = User.objects.create_user(username, email, password)
        user.is_active = False
        user.is_staff = True
        user.save()
        return alertResponse("Success! Your account has been registered, but needs to be enabled. Please email epeacock@whoi.edu.", False)

class LogoutPageView(TemplateView):
    def get(self, request, **kwargs):
        logout(request)
        return redirect('/login/')

class ClassifyPageView(TemplateView):
    def post(self, request, **kwargs):
        
        if not request.user.is_authenticated:
            return redirect(settings.LOGIN_URL)
            
        binsInput = request.POST.get('bins', '')
        bins = re.split(',', binsInput)
        shouldImport = json.loads(request.POST.get('import', 'false')) # boolean conversion with json lib
        utils.timeseries = request.POST.get('timeseries', '')
        batchmode = json.loads(request.POST.get('batchmode', 'false'))
        
        classList = database.getClassificationList()
        tagList = database.getTagList()
        
        current_bins = bins
        
        if batchmode:
            batchsize = int(request.POST.get('batchsize', 5))
            
            if batchsize > 20:
                request.session['failed'] = 'Batch size cannot be greater than 20'
                return redirect('/')
            
            if 'batchstart' in request.POST:
            
                batchstart = request.POST.get('batchstart', '')
                batchend = request.POST.get('batchend', '')
                
                if batchstart == '' or batchend == '':
                    request.session['failed'] = 'Invalid date(s) given for batch mode range'
                    return redirect('/')
                    
                batchstart = datetime.strptime(batchstart, '%Y-%m-%d')
                batchend = datetime.strptime(batchend, '%Y-%m-%d')
                
                if batchend < batchstart:
                    temp = batchend
                    batchend = batchstart
                    batchstart = temp
                    
                delta = batchend - batchstart
                if delta.total_seconds() / 86400 > 365:
                    request.session['failed'] = 'Date range cannot be greater than 365 days'
                    return redirect('/')

                if len(bins) == 1 and bins[0] == '':
                    bins = utils.getBinsInRange(batchstart, batchend, utils.timeseries)
                else:
                    bins = utils.removeDuplicates(bins + utils.getBinsInRange(batchstart, batchend, utils.timeseries))
                
            batchclass = request.POST.get('batchclass', '')
            batchtag = request.POST.get('batchtag', '')
                
            bins = database.filterBins(bins, batchclass, batchtag)
            
            current_bins = bins[:batchsize]
            
        if len(current_bins) == 1 and current_bins[0] == '':
            request.session['failed'] = 'You must supply at least one valid bin'
            return redirect('/')
        
        targets = utils.getTargets(current_bins)
        
        if not targets:
            request.session['bins'] = bins
            request.session['failed'] = 'One or more of the chosen bins was invalid for the chosen timeseries'
            return redirect('/')

        classifications = database.getAllDataForBins(current_bins, targets)
        
        logger.info('{} total targets found'.format(len(targets)))
        
        if shouldImport:
            logger.info('including auto results')
            classifications = database.addClassifierData(current_bins, classList, tagList, classifications)
        
        JS_values = {
            'timeseries' : utils.timeseries,
            'classification_labels' : classList,
            'tag_labels' : tagList,
            'classifications' : json.dumps(classifications),
            'bins' : json.dumps(bins),
            'user_id' : request.user.pk,
            'username' : request.user.username,
            'batchmode' : batchmode,
            'batchsize' : 5,
            'shouldImport' : shouldImport,
        }
        
        if batchmode:
            JS_values['batchsize'] = batchsize
            JS_values['batchclass'] = batchclass
            JS_values['batchtag'] = batchtag
            
        return render(request, 'classify.html', JS_values)

class SubmitUpdatesPageView(TemplateView):
    def post(self, request, **kwargs):
        if request.method == 'POST':
            if not request.user.is_authenticated:
                return redirect(settings.LOGIN_URL)
            utils.timeseries = request.POST.get('timeseries', '')
            c_updates = json.loads(request.POST.get('classifications', ''))
            t_updates = json.loads(request.POST.get('tags', ''))
            t_n_updates = json.loads(request.POST.get('tagnegations', ''))
            id = request.user.pk
            result1 = database.insertUpdates(c_updates, id, True, False)
            result2 = database.insertUpdates(t_updates, id, False, False)
            result3 = database.insertUpdates(t_n_updates, id, False, True)
            result = dict()
            result.update(result1)
            result.update(result2)
            result.update(result3)
            return HttpResponse(json.dumps(result))
            
class ZipDownloadPageView(TemplateView):
    def post(self, request, **kwargs):
        if request.method == 'POST':
            bin = request.POST.get('bin', '')
            if bin == '':
                return HttpResponse('failure')
            response = HttpResponse(utils.getZipForBin(bin), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename=' + bin + '.zip'
            return response

class CacheBinPageView(TemplateView):
    def post(self, request, **kwargs):
        if request.method == 'POST':
            bins = request.POST.get('bins', '')
            utils.timeseries = request.POST.get('timeseries', '')
            bins = re.split(',', bins)
            if len(bins) > 0 and bins[0] != '':
                for bin in bins:
                    logger.info('CACHING ' + bin + '...')
                    if not utils.areTargetsCached(bin):
                        utils.parseBinToTargets(bin)
                    if not utils.areAutoResultsCached(bin):
                        utils.getAutoResultsForBin(bin)
                    if not utils.isZipDownloaded(bin):
                        utils.downloadZipForBin(bin)
        return HttpResponse('')
