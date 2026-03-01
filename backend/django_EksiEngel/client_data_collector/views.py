from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate, login
import json
from django.forms.models import model_to_dict

from .models import ClientData,BanSource,BanMode,LogLevel
from .models import ClientAnalytic,ClickType
from api.authentication import SharedAPIKeyAuthentication
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework.permissions import IsAdminUser


def check_auth(request):
    """Check authentication using API key, session, or basic auth"""
    # Check for API key
    api_key = request.META.get('HTTP_X_API_KEY')
    if api_key == getattr(settings, 'SHARED_API_KEY', None):
        return True, None
    
    # Check session authentication (browser logged in)
    if request.user.is_authenticated and request.user.is_active:
        return True, None
    
    # Check Basic Auth header
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Basic '):
        import base64
        try:
            encoded = auth_header[6:]
            decoded = base64.b64decode(encoded).decode('utf-8')
            username, password = decoded.split(':', 1)
            user = authenticate(username=username, password=password)
            if user is not None and user.is_active:
                # Set the user on the request
                request.user = user
                return True, None
        except Exception:
            pass
    
    # Not authenticated - return 401 with Basic Auth challenge
    response = HttpResponse('Unauthorized', status=401)
    response['WWW-Authenticate'] = 'Basic realm="EksiEngel"'
    return False, response


def index(request):
    return HttpResponse("Hello, world. I'm client data collector.")

@csrf_exempt
def upload(request):
    # Check authentication
    authenticated, error_response = check_auth(request)
    if not authenticated:
        return error_response
    
    if request.method == 'POST':
        data = None
        if(request.POST):
            # form data
            data = request.POST
        elif(request.body):
            # raw json data
            try:
                data = json.loads(request.body) 
            except:
                return HttpResponse('An Error Occured', status=400)
        else:
            return HttpResponse('Empty Request', status=400)
        try:
            # create a row in ClientData table
            ClientData.objects.create(
                date = timezone.now(),
                user_agent = data.get("user_agent"),
                client_name = data.get("client_name"),
                ban_source = BanSource.objects.get(ban_source = data.get("ban_source")),
                ban_mode = BanMode.objects.get(ban_mode = data.get("ban_mode")),
                fav_entry_id = data.get("fav_entry_id"),
                fav_title_id = data.get("fav_title_id"),
                fav_title_name = data.get("fav_title_name"),
                fav_author_id = data.get("fav_author_id"),
                fav_author_name = data.get("fav_author_name"),
                author_name_list = data.get("author_name_list"),
                author_id_list = data.get("author_id_list"),
                author_list_size = data.get("author_list_size"),
                total_action = data.get("total_action"),
                successful_action = data.get("successful_action"),
                is_early_stopped = data.get("is_early_stopped"),
                log_level = LogLevel.objects.get(log_level = data.get("log_level")),
                log = data.get("log")
            )
            return HttpResponse('OK', status=200)
        except Exception as e:
            return HttpResponse(e, status=400)
    else:
        return HttpResponse('Method Not Allowed', status=405)
        
@csrf_exempt
def analytics(request):
    # Check authentication
    authenticated, error_response = check_auth(request)
    if not authenticated:
        return error_response
    
    if request.method == 'GET':
        # Return simple analytics overview
        total_clients = ClientData.objects.count()
        total_analytics = ClientAnalytic.objects.count()
        html = f"""
        <html>
        <head><title>Client Data Analytics</title></head>
        <body>
            <h1>Client Data Collector Analytics</h1>
            <p>Total ClientData records: {total_clients}</p>
            <p>Total ClientAnalytic records: {total_analytics}</p>
            <p>Authenticated as: {request.user.username if request.user.is_authenticated else 'N/A'}</p>
        </body>
        </html>
        """
        return HttpResponse(html)
    
    if request.method == 'POST':
        data = None
        if(request.POST):
            # form data
            data = request.POST
        elif(request.body):
            # raw json data
            try:
                data = json.loads(request.body) 
            except:
                return HttpResponse('An Error Occured', status=400)
        else:
            return HttpResponse('Empty Request', status=400)
        try:
            # create a row in ClientAnalytic table
            click_type_value = data.get("click_type")
            click_type_obj, _ = ClickType.objects.get_or_create(
                click_type=click_type_value if click_type_value else "UNKNOWN"
            )
            ClientAnalytic.objects.create(
                date=timezone.now(),
                user_agent=data.get("user_agent", "unknown"),
                client_name=data.get("client_name", "unknown"),
                client_uid=data.get("client_uid", 0),
                click_type=click_type_obj,
            )
            return HttpResponse('OK', status=200)
        except Exception as e:
            return HttpResponse(e, status=400)
    else:
        return HttpResponse('Method Not Allowed', status=405)

@csrf_exempt    
def upload_v2(request):
    if request.method == 'POST':
        data = None
        if(request.POST):
            # form data
            data = request.POST
        elif(request.body):
            # raw json data
            try:
                data = json.loads(request.body) 
            except:
                return HttpResponse('An Error Occured', status=400)
        else:
            return HttpResponse('Empty Request', status=400)
        try:
            # create a row in ClientData table
            ClientData.objects.create(**data)
            return HttpResponse('OK', status=200)
        except Exception as e:
            print(e)
            return HttpResponse(e, status=400)
    else:
        return HttpResponse('Method Not Allowed', status=405)








