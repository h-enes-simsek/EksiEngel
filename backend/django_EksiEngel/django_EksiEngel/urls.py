from django.contrib import admin
from django.urls import include, path
from django.http import HttpResponse


def admin_api_index(request):
    """List all available API endpoints under /admin/api/"""
    html = """
    <html>
    <head>
        <title>API Endpoints</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            ul { line-height: 1.8; }
            a { color: #007bff; }
            h1 { color: #333; }
        </style>
    </head>
    <body>
        <h1>Available API Endpoints</h1>
        <ul>
            <li><a href="/admin/api/client_data/">Client Data Collector</a>
                <ul>
                    <li><a href="/admin/api/client_data/analytics">analytics (GET/POST)</a></li>
                    <li><a href="/admin/api/client_data/upload">upload (POST)</a></li>
                </ul>
            </li>
        </ul>
    </body>
    </html>
    """
    return HttpResponse(html)


urlpatterns = [
    path("api/", include("api.urls")),
    path("where_is_eksisozluk/", include("where_is_eksisozluk.urls")),
    path('admin/', admin.site.urls),
    # Admin API section - browsable API endpoints
    path('admin/api/', admin_api_index, name='admin_api_index'),
    path('admin/api/client_data/', include('client_data_collector.urls')),
]
