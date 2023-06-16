from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('upload', views.upload, name='upload'),
    path('upload_v2', views.upload_v2, name='upload_v2'),
    path('analytics', views.analytics, name='analytics'),
]