from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings

class SharedAPIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_API_KEY')
        if not api_key:
            raise AuthenticationFailed('X-API-Key header required')
        if api_key != getattr(settings, 'SHARED_API_KEY', None):
            raise AuthenticationFailed('Invalid API key')
        return (None, api_key)
