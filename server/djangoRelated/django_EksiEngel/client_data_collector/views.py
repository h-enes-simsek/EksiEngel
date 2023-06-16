from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import json
from django.forms.models import model_to_dict

from .models import ClientData,BanSource,BanMode,LogLevel
from .models import ClientAnalytic,ClickType

def index(request):
    return HttpResponse("Hello, world. I'm client data collector.")

@csrf_exempt
def upload(request):
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
            ClientAnalytic.objects.create(
                date = timezone.now(),
                user_agent = data.get("user_agent"),
                client_name = data.get("client_name"),
                client_uid = data.get("client_uid"),
                click_type = ClickType.objects.get(click_type = data.get("click_type")),
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








