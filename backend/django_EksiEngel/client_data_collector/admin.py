from django.contrib import admin
from .models import BanSource, BanMode, TargetType, ClickSource, LogLevel, ClientData, ClientAnalytic, ClickType, Config

admin.site.register(ClientData)
admin.site.register(ClientAnalytic)
admin.site.register(ClickType)

class BanSourceAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)
class BanModeAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)
class TargetTypeAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)
class ClickSourceAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)
class LogLevelAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)

admin.site.register(BanSource, BanSourceAdmin)
admin.site.register(BanMode, BanModeAdmin)
admin.site.register(TargetType, TargetTypeAdmin)
admin.site.register(ClickSource, ClickSourceAdmin)
admin.site.register(LogLevel, LogLevelAdmin)

admin.site.register(Config)