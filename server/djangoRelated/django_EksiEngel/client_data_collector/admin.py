from django.contrib import admin
from .models import BanSource, BanMode, LogLevel, ClientData, ClientAnalytic, ClickType

admin.site.register(ClientData)
admin.site.register(ClientAnalytic)

admin.site.register(BanSource)
admin.site.register(BanMode)
admin.site.register(LogLevel)
admin.site.register(ClickType)