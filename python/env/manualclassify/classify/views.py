from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django import forms
import json
from classify import utils, database, config
from django.contrib.auth import authenticate, login, logout
from django.conf import settings

# Create your views here.
class HomePageView(TemplateView):
	def get(self, request, **kwargs):
		if not request.user.is_authenticated:
			return redirect(settings.LOGIN_URL)
		return render(request, 'index.html', {'failed' : request.session.pop('failed', '')})
		
class LoginPageView(TemplateView):
	def get(self, request, **kwargs):
		return render(request, 'login.html')
	def post(self, request, **kwargs):
		if request.method == 'POST':
			username = request.POST.get('username')
			password = request.POST.get('password')
			user = authenticate(request=request, username=username, password=password)
			if user is not None:
				login(request, user)
				return redirect('/')
			else:
				return render(request, 'login.html', {'failed' : True})

class LogoutPageView(TemplateView):
	def get(self, request, **kwargs):
		logout(request)
		return redirect('/login/')

class ClassifyPageView(TemplateView):
	def post(self, request, **kwargs):
		if request.method == 'POST':
			if not request.user.is_authenticated:
				return redirect(settings.LOGIN_URL)
			binsInput = request.POST.get('bins', '')
			utils.timeseries = request.POST.get('timeseries', '')
			(bins, failures) = utils.verifyBins(binsInput)
			if len(failures) > 0:
				request.session['failed'] = 'Invalid bin(s) specified for given timeseries:'
				for f in failures:
					request.session['failed'] = request.session['failed'] + '\\n' + f
				return redirect('/')
			targets = utils.getTargets(bins)
			print(str(len(targets)) + ' total targets found')
			classifications = json.dumps(database.getAllDataForBins(bins, targets))
		return render(request, 'classify.html', {
			'timeseries' : utils.timeseries,
			'classification_labels' : database.getClassificationList(),
			'tag_labels' : database.getTagList(),
			'classifications' : classifications,
			'bins' : json.dumps(bins),
			'user_id' : request.session.get('user_id', 1) # TO-DO: Make this real
		})

class SubmitUpdatesPageView(TemplateView):
	def post(self, request, **kwargs):
		if request.method == 'POST':
			if not request.user.is_authenticated:
				return redirect(settings.LOGIN_URL)
			utils.timeseries = request.POST.get('timeseries', '')
			c_updates = json.loads(request.POST.get('classifications', ''))
			t_updates = json.loads(request.POST.get('tags', ''))
			result1 = database.insertUpdatesForPids(c_updates, True)
			result2 = database.insertUpdatesForPids(t_updates, False)
			result = json.dumps({**result1, **result2})
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