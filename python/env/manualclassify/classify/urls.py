from django.conf.urls import url, include
from django.contrib import admin

from classify import views

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', views.HomePageView.as_view()),
    url(r'^classify/$', views.ClassifyPageView.as_view()),
    url(r'^submitupdates/$', views.SubmitUpdatesPageView.as_view()),
    url(r'^login/$', views.LoginPageView.as_view()),
    url(r'^register/$', views.RegisterPageView.as_view()),
    url(r'^logout/$', views.LogoutPageView.as_view()),
    url(r'^getzip/$', views.ZipDownloadPageView.as_view()),
    url(r'^cachebins/$', views.CacheBinPageView.as_view()),
]
