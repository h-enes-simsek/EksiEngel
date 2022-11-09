from django.contrib import admin
from .models import BanSource, BanMode, LogLevel, ClientData

admin.site.register(BanSource)
admin.site.register(BanMode)
admin.site.register(LogLevel)
admin.site.register(ClientData)