from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("api/", include("api.urls")),
    path('client_data_collector/', include('client_data_collector.urls')),
    path("where_is_eksisozluk/", include("where_is_eksisozluk.urls")),
    path('admin/', admin.site.urls),
]