from django.contrib import admin
from .models import BanSource, BanMode, TargetType, ClickSource, LogLevel, TimeSpecifier
from .models import EksiSozlukUser, Action, ActionConfig, EksiSozlukTitle, EksiSozlukEntry

admin.site.register(EksiSozlukUser)
admin.site.register(EksiSozlukTitle)
admin.site.register(EksiSozlukEntry)
admin.site.register(ActionConfig)

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
class TimeSpecifierAdmin(admin.ModelAdmin):
    list_display = ('pk', '__str__',)

admin.site.register(BanSource, BanSourceAdmin)
admin.site.register(BanMode, BanModeAdmin)
admin.site.register(TargetType, TargetTypeAdmin)
admin.site.register(ClickSource, ClickSourceAdmin)
admin.site.register(LogLevel, LogLevelAdmin)
admin.site.register(TimeSpecifier, TimeSpecifierAdmin)

# author_list field in Action will be filtered so, 
# only relevant EksiSozlukUser(s) will be shown in an Action record
# instead of all EksiSozlukUser(s)
class ActionAdmin(admin.ModelAdmin):
    def get_object(self, request, object_id, s):
        # Hook obj for use in formfield_for_manytomany
        self.obj = super(ActionAdmin, self).get_object(request, object_id)
        return self.obj
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "author_list":
            kwargs["queryset"] = EksiSozlukUser.objects.filter(author_list_in_action=self.obj)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

admin.site.register(Action, ActionAdmin)