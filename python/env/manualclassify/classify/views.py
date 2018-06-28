from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django import forms
import json
from classify import utils, database, config
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings
import re
import time
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
        return render(request, 'login.html', {'needs_approval' : request.session.pop('needs_approval', '')})
    def post(self, request, **kwargs):
        if request.method == 'POST':
            username = request.POST.get('username')
            password = request.POST.get('password')
            user = authenticate(request=request, username=username, password=password)
            if user is not None:
                if (user.is_active):
                    login(request, user)
                    return redirect('/')
                else:
                    request.session['needs_approval'] = True
                    return redirect('/login/')
            else:
                return render(request, 'login.html', {'failed' : True})

def validate_username(username):
    return re.match(r'[A-Za-z][a-zA-Z0-9]*', username)

def validate_email(email):
    return re.match(r'[^@]+@[^@]+\.[^@]+', email)

def validate_password(password):
    return len(password) >= 8

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
            return render(request, 'register.html', {'other_error': True})
        if User.objects.filter(username=username).exists():
            return render(request, 'register.html', {'user_taken' : True})
        if User.objects.filter(email=email).exists():
            return render(request, 'register.html', {'email_taken' : True})
        if not validate_username(username):
            return render(request, 'register.html', {'user_invalid' : True})
        if not validate_email(email):
            return render(request, 'register.html', {'email_invalid': True})
        if not validate_password(password):
            return render(request, 'register.html', {'password_invalid': True})
        user = User.objects.create_user(username, email, password)
        user.is_active = False
        user.is_staff = True
        user.save()
        request.session['needs_approval'] = True
        return redirect('/login/')

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
        request.session['timeseries'] = request.POST.get('timeseries', '')
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
                    bins = utils.getBinsInRange(batchstart, batchend, request.session['timeseries'])
                else:
                    bins = utils.removeDuplicates(bins + utils.getBinsInRange(batchstart, batchend, request.session['timeseries']))
                
            batchclass = request.POST.get('batchclass', '')
            batchtag = request.POST.get('batchtag', '')
            ordering = request.POST.get('ordering', '')
            
            if len(bins) == 0 or (len(bins) == 1 and bins[0] == ''):
                request.session['failed'] = 'You must specify at least one bin.'
                return redirect('/')
                
            bins = database.filterBins(bins, batchclass, batchtag, ordering)
            
            if len(bins) == 0:
                request.session['failed'] = 'No specified bins have annotations in that batch class.'
                return redirect('/')
            
            current_bins = bins[:batchsize]
        
        targets = utils.getTargets(current_bins, request.session['timeseries'])
        
        if not targets:
            request.session['bins'] = bins
            request.session['failed'] = 'One or more of the chosen bins was invalid for the chosen timeseries'
            return redirect('/')

        classifications = database.getAllDataForBins(current_bins, targets, request.session['timeseries'])
        
        logger.info('{} total targets found'.format(len(targets)))
        
        if shouldImport:
            logger.info('including auto results')
            classifications = database.addClassifierData(current_bins, classList, tagList, classifications, request.session['timeseries'])
        
        JS_values = {
            'timeseries' : request.session['timeseries'],
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
            JS_values['batchOrdering'] = ordering
            
        return render(request, 'classify.html', JS_values)

class SubmitUpdatesPageView(TemplateView):
    def post(self, request, **kwargs):
        if request.method == 'POST':
            if not request.user.is_authenticated:
                return redirect(settings.LOGIN_URL)
            request.session['timeseries'] = request.POST.get('timeseries', '')
            c_updates = json.loads(request.POST.get('classifications', ''))
            t_updates = json.loads(request.POST.get('tags', ''))
            t_n_updates = json.loads(request.POST.get('tagnegations', ''))
            id = request.user.pk
            result1 = database.insertUpdates(c_updates, id, True, False, request.session['timeseries'])
            result2 = database.insertUpdates(t_updates, id, False, False, request.session['timeseries'])
            result3 = database.insertUpdates(t_n_updates, id, False, True, request.session['timeseries'])
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
            zip = utils.getZipForBin(bin, request.session['timeseries'])
            if not zip:
                return HttpResponse("Failed to download zip: " + request.session['timeseries'] + bin + '.zip')
            response = HttpResponse(utils.getZipForBin(bin, request.session['timeseries']), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename=' + bin + '.zip'
            return response

class CacheBinPageView(TemplateView):
    def post(self, request, **kwargs):
        if request.method == 'POST':
            bins = request.POST.get('bins', '')
            request.session['timeseries'] = request.POST.get('timeseries', '')
            bins = re.split(',', bins)
            if len(bins) > 0 and bins[0] != '':
                for bin in bins:
                    logger.info('CACHING ' + bin + '...')
                    if not utils.areTargetsCached(bin):
                        utils.parseBinToTargets(bin, request.session['timeseries'])
                    if not utils.areAutoResultsCached(bin):
                        utils.getAutoResultsForBin(bin, request.session['timeseries'])
                    if not utils.isZipDownloaded(bin):
                        utils.downloadZipForBin(bin, request.session['timeseries'])
        return HttpResponse('')
