from django.contrib import admin
from django.urls import include, path
from api.views import admin_dashboard

urlpatterns = [
    path('', admin_dashboard, name='admin_dashboard'),
    path("api/", include("api.urls")),
    path('client_data_collector/', include('client_data_collector.urls')),
    path('admin/', admin.site.urls),
]
