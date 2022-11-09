from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('client_data_collector/', include('client_data_collector.urls')),
    path('admin/', admin.site.urls),
]