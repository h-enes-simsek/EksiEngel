from django.contrib import admin
from django.urls import include, path
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.conf import settings
from api.views import MostBannedUsersView, MostBannedUsersUniqueView, EksiSozlukUserStatView, FailedActionsView, TotalActionView, TotalActionHTMLView


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
            h2 { color: #555; margin-top: 30px; }
            .note { color: #666; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <h1>Available API Endpoints</h1>
        
        <h2>Statistics API (requires admin login)</h2>
        <ul>
            <li><a href="/admin/api/most_banned/">most_banned</a> - List users blocked most often (with duplicates)</li>
            <li><a href="/admin/api/most_banned_unique/">most_banned_unique</a> - List users blocked by most unique users</li>
            <li><a href="/admin/api/user_stat/">user_stat</a> - Get all users with their ban statistics</li>
            <li><a href="/admin/api/failed_actions/">failed_actions</a> - List last 10 failed operations</li>
            <li><a href="/admin/api/total_action/">total_action</a> - Daily action counts (JSON)</li>
            <li><a href="/admin/api/total_action_html/">total_action_html</a> - Visual chart of daily actions</li>
        </ul>
        <p class="note">Note: These endpoints also work without /admin/ prefix at /api/...</p>
        
        <h2>Client Data Collector API</h2>
        <ul>
            <li><a href="/admin/api/client_data/">Client Data Collector API</a>
                <ul>
                    <li><a href="/admin/api/client_data/analytics">analytics (GET/POST)</a></li>
                    <li><a href="/admin/api/client_data/upload">upload (POST)</a></li>
                </ul>
            </li>
            <li><a href="/admin/client_data_collector/">Client Data Collector (Django Admin)</a></li>
        </ul>
    </body>
    </html>
    """
    return HttpResponse(html)


def privacy_page(request):
    """Serve the privacy policy page."""
    return render(request, 'privacy/index.html')


def landing_page(request):
    """Serve the landing page at root URL."""
    return render(request, 'landing/index.html')


urlpatterns = [
    # Privacy policy page
    path('privacy/', privacy_page, name='privacy'),
    # Landing page at root
    path('', landing_page, name='landing'),
    path("api/", include("api.urls")),
    path("where_is_eksisozluk/", include("where_is_eksisozluk.urls")),
    # Admin API section - MUST come BEFORE admin.site.urls
    path('admin/api/', admin_api_index, name='admin_api_index'),
    path('admin/api/client_data/', include('client_data_collector.urls')),
    path('admin/api/client_data_collector/', lambda request: redirect('/admin/client_data_collector/')),
    # Statistics API under /admin/api/ (same as /api/ but browseable)
    path('admin/api/most_banned/', MostBannedUsersView.as_view(), name='most_banned_admin'),
    path('admin/api/most_banned_unique/', MostBannedUsersUniqueView.as_view(), name='most_banned_unique_admin'),
    path('admin/api/user_stat/', EksiSozlukUserStatView.as_view(), name='user_stat_admin'),
    path('admin/api/failed_actions/', FailedActionsView.as_view(), name='failed_actions_admin'),
    path('admin/api/total_action/', TotalActionView.as_view(), name='total_action_admin'),
    path('admin/api/total_action_html/', TotalActionHTMLView, name='total_action_html_admin'),
    # Generic admin - must be last
    path('admin/', admin.site.urls),
]
