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
				
class RegisterPageView(TemplateView):
	def get(self, request, **kwargs):
		return render(request, 'register.html')
	def post(self, request, **kwargs):
		username = request.POST.get('username')
		password = request.POST.get('password')
		email = request.POST.get('email')
		if User.objects.filter(username=username).exists():
			return render(request, 'register.html', {'user_taken' : True})
		if User.objects.filter(email=email).exists():
			return render(request, 'register.html', {'email_taken' : True})
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
		shouldImport = json.loads(request.POST.get('import', False)) # boolean conversion with json lib
		utils.timeseries = request.POST.get('timeseries', '')
		batchmode = json.loads(request.POST.get('batchmode', False))
		
		current_bins = bins
		
		if batchmode:
			batchsize = int(request.POST.get('batchsize', 5))
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
				if delta.total_seconds() / 86400 > 90:
					request.session['failed'] = 'Date range cannot be greater than 90 days'
					return redirect('/')

				if len(bins) == 1 and bins[0] == '':
					bins = utils.getBinsInRange(batchstart, batchend, utils.timeseries)
				else:
					bins = utils.removeDuplicates(bins + utils.getBinsInRange(batchstart, batchend, utils.timeseries))
			current_bins = bins[:batchsize]
			
		if len(current_bins) == 1 and current_bins[0] == '':
			request.session['failed'] = 'You must supply at least one valid bin'
			return redirect('/')
		
		t = time.time()
		targets = utils.getTargets(current_bins)
		print(str(time.time() - t) + ' to load target PIDs and dimensions')
		
		if not targets:
			request.session['failed'] = 'One or more of the chosen bins was invalid for the chosen timeseries'
			return redirect('/')
		
		classList = database.getClassificationList()
		tagList = database.getTagList()
		
		t = time.time()
		classifications = database.getAllDataForBins(current_bins, targets)
		print(str(time.time() - t) + ' to get all annotations from database')
		
		print(str(len(targets)) + ' total targets found')
		
		if shouldImport:
			print('including auto results')
			t = time.time()
			classifications = utils.addClassifierData(current_bins, classList, tagList, classifications)
			print(str(time.time() - t) + ' to add classifier data')
		
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
			result = json.dumps({**{**result1, **result2}, **result3})
			return HttpResponse(result)
			
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
			bins = re.split(',', bins)
			if len(bins) > 0 and bins[0] != '':
				for bin in bins:
					print('[CACHING] ' + bin + '...')
					if not utils.areTargetsCached(bin):
						utils.parseBinToTargets(bin)
					if not utils.areAutoResultsCached(bin):
						utils.getAutoResultsForBin(bin)
					if not utils.isZipDownloaded(bin):
						utils.downloadZipForBin(bin)
		return HttpResponse('')