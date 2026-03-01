from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
import json

from .models import ClientData, BanSource, BanMode, LogLevel
from .models import ClientAnalytic, ClickType
from api.authentication import SharedAPIKeyAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Disable CSRF check for session authentication"""
    def enforce_csrf(self, request):
        return  # To not perform the csrf check


def index(request):
    return HttpResponse("Hello, world. I'm client data collector.")


@csrf_exempt
@api_view(['POST'])
@authentication_classes([SharedAPIKeyAuthentication, CsrfExemptSessionAuthentication, BasicAuthentication])
@permission_classes([AllowAny])
def upload(request):
    if request.method == 'POST':
        data = None
        if request.POST:
            data = request.POST
        elif request.body:
            try:
                data = json.loads(request.body)
            except:
                return Response('An Error Occurred', status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response('Empty Request', status=status.HTTP_400_BAD_REQUEST)

        try:
            ClientData.objects.create(
                date=timezone.now(),
                user_agent=data.get("user_agent"),
                client_name=data.get("client_name"),
                ban_source=BanSource.objects.get(ban_source=data.get("ban_source")),
                ban_mode=BanMode.objects.get(ban_mode=data.get("ban_mode")),
                fav_entry_id=data.get("fav_entry_id"),
                fav_title_id=data.get("fav_title_id"),
                fav_title_name=data.get("fav_title_name"),
                fav_author_id=data.get("fav_author_id"),
                fav_author_name=data.get("fav_author_name"),
                author_name_list=data.get("author_name_list"),
                author_id_list=data.get("author_id_list"),
                author_list_size=data.get("author_list_size"),
                total_action=data.get("total_action"),
                successful_action=data.get("successful_action"),
                is_early_stopped=data.get("is_early_stopped"),
                log_level=LogLevel.objects.get(log_level=data.get("log_level")),
                log=data.get("log")
            )
            return Response('OK', status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response('Method Not Allowed', status=status.HTTP_405_METHOD_NOT_ALLOWED)


@csrf_exempt
@api_view(['GET', 'POST'])
@authentication_classes([SharedAPIKeyAuthentication, CsrfExemptSessionAuthentication, BasicAuthentication])
@permission_classes([AllowAny])
def analytics(request):
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
        data = request.data
        try:
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
            return Response('OK', status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(str(e), status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response('Method Not Allowed', status=status.HTTP_405_METHOD_NOT_ALLOWED)
