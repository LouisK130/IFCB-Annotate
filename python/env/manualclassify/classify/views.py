from django.shortcuts import render, redirect
from django.views.generic import TemplateView
from django.http import HttpResponse
from django import forms
import json
from classify import utils, database, config
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.conf import settings

# Create your views here.
class HomePageView(TemplateView):
	def get(self, request, **kwargs):
		if not request.user.is_authenticated:
			return redirect(settings.LOGIN_URL)
		return render(request, 'index.html', {
			'failed' : request.session.pop('failed', ''),
			'username' : request.user.username,
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
		if request.method == 'POST':
			if not request.user.is_authenticated:
				return redirect(settings.LOGIN_URL)
			binsInput = request.POST.get('bins', '')
			shouldImport = json.loads(request.POST.get('import', False)) # boolean conversion with json lib
			utils.timeseries = request.POST.get('timeseries', '')
			(bins, failures) = utils.verifyBins(binsInput)
			if len(failures) > 0:
				request.session['failed'] = 'Invalid bin(s) specified for given timeseries:'
				for f in failures:
					request.session['failed'] = request.session['failed'] + '\\n' + f
				return redirect('/')
			classList = database.getClassificationList()
			tagList = database.getTagList()
			targets = utils.getTargets(bins)
			classifications = database.getAllDataForBins(bins, targets)
			print(str(len(targets)) + ' total targets found')
			if shouldImport:
				print('including auto results')
				classifications = utils.addClassifierData(bins, classList, tagList, classifications)
		return render(request, 'classify.html', {
			'timeseries' : utils.timeseries,
			'classification_labels' : classList,
			'tag_labels' : tagList,
			'classifications' : json.dumps(classifications),
			'bins' : json.dumps(bins),
			'user_id' : request.user.pk,
			'username' : request.user.username,
		})

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
			result1 = database.insertClassificationUpdates(c_updates, id)
			result2 = database.insertTagUpdates(t_updates, id, False)
			result3 = database.insertTagUpdates(t_n_updates, id, True)
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