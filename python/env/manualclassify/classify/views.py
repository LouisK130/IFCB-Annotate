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
		return render(request, 'index.html', {'failed' : request.session.pop('failed_bins_input', False)})
		
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
			pidsInput = request.POST.get('pids', '')
			(bins, misfit_pids, targets) = utils.getTargets(pidsInput)
			if len(bins) == 0:
				request.session['failed_bins_input'] = True
				return redirect('/')
			classList = database.getClassificationList()
			print(str(len(targets)) + ' total pids found')
			print(str(len(misfit_pids)) + ' are misfits')
			if len(misfit_pids) > 0:
				print('misfits are not yet supported')
			classifications = json.dumps(database.getAllClassificationsForBins(bins, targets))
		return render(request, 'classify.html', {
			'web_services_path' : config.web_services_path,
			'classification_labels' : classList,
			'classifications' : classifications,
			'pids_input' : pidsInput,
			'bins' : json.dumps(bins),
			'user_id' : request.session.get('user_id', 1) # TO-DO: Make this real
		})

class SubmitUpdatesPageView(TemplateView):
	def post(self, request, **kwargs):
		if request.method == 'POST':
			if not request.user.is_authenticated:
				return redirect(settings.LOGIN_URL)
			updates = request.POST.get('updates', 'EMPTY')
			result = database.insertUpdatesForPids(json.loads(updates))
			return HttpResponse(result)