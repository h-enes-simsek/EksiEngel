from django.db import models

class BanSource(models.Model):
    ban_source = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.ban_source
    
class BanMode(models.Model):
    ban_mode = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.ban_mode
    
class TargetType(models.Model):
    target_type = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.target_type
    
class ClickSource(models.Model):
    click_source = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.click_source
    
class LogLevel(models.Model):
    log_level = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.log_level
        
class ClickType(models.Model):
    click_type = models.CharField(max_length=100, blank=False, null=False)
    def __str__(self):
        return self.click_type
        
class TimeSpecifier(models.Model):
    time_specifier = models.CharField(max_length=10, blank=False, null=False)
    def __str__(self):
        return self.time_specifier
        
class EksiSozlukTitle(models.Model):
    eksisozluk_name = models.CharField(max_length=96, blank=False, null=False)
    eksisozluk_id = models.IntegerField(blank=False, null=False)
    def __str__(self):
        return f"{self.eksisozluk_id} {self.eksisozluk_name}"
        
class EksiSozlukEntry(models.Model):
    eksisozluk_title = models.ForeignKey(EksiSozlukTitle, on_delete=models.PROTECT, blank=False, null=False)
    eksisozluk_id = models.IntegerField(blank=False, null=False)
    def __str__(self):
        return f"{self.eksisozluk_id} {self.eksisozluk_title}"
        
class EksiSozlukUser(models.Model):
    eksisozluk_name = models.CharField(max_length=96, blank=False, null=False)
    eksisozluk_id = models.IntegerField(blank=False, null=False)
    is_eksiengel_user = models.BooleanField(blank=False, null=False)
    first_activity_date = models.DateTimeField(blank=True, null=True)
    last_activity_date = models.DateTimeField(blank=True, null=True)
    last_activity_user_agent = models.CharField(max_length=1024, blank=True, null=True)
    last_activity_version = models.CharField(max_length=16, blank=True, null=True)
    def __str__(self):
        return f"{self.eksisozluk_id} {self.eksisozluk_name} {self.is_eksiengel_user}"
    
class Action(models.Model):
    eksi_engel_user = models.ForeignKey(EksiSozlukUser, on_delete=models.CASCADE, related_name="eksi_engel_user_in_action", blank=False, null=False)
    date = models.DateTimeField(auto_now_add=True, blank=True, null=False)
    version = models.CharField(max_length=16, blank=False, null=False)
    user_agent = models.CharField(max_length=1024, blank=False, null=False)
    ban_source = models.ForeignKey(BanSource, on_delete=models.PROTECT, blank=False, null=False)
    ban_mode = models.ForeignKey(BanMode, on_delete=models.PROTECT, blank=False, null=False)
    author_list = models.ManyToManyField(EksiSozlukUser, related_name="author_list_in_action", blank=False)
    author_list_size = models.IntegerField(blank=False, null=False) 
    planned_action = models.IntegerField(blank=False, null=False) 
    performed_action = models.IntegerField(blank=False, null=False)
    successful_action = models.IntegerField(blank=False, null=False)
    is_early_stopped = models.BooleanField(blank=False, null=False)
    log_level = models.ForeignKey(LogLevel, on_delete=models.PROTECT, blank=False, null=False)
    log = models.CharField(max_length=1000000, blank=True, null=True)
    
    # SINGLE
    target_type = models.ForeignKey(TargetType, on_delete=models.PROTECT, blank=True, null=True)

    # SINGLE + FAV + FOLLOW
    click_source = models.ForeignKey(ClickSource, on_delete=models.PROTECT, blank=True, null=True)
    
    # FAV
    fav_title = models.ForeignKey(EksiSozlukTitle, on_delete=models.PROTECT, blank=True, null=True)
    fav_entry = models.ForeignKey(EksiSozlukEntry, on_delete=models.PROTECT, blank=True, null=True) 
    fav_author = models.ForeignKey(EksiSozlukUser, on_delete=models.CASCADE, related_name="fav_author_in_action", blank=True, null=True)
    
    # TITLE
    time_specifier = models.ForeignKey(TimeSpecifier, on_delete=models.PROTECT, blank=True, null=True)
    #title = models.ForeignKey(EksiSozlukTitle, on_delete=models.PROTECT, blank=True, null=True)

    def __str__(self):
        return f"{self.id} {self.date.strftime('%Y-%m-%d %H:%M:%S')} {self.eksi_engel_user.eksisozluk_name} {self.ban_source} {self.successful_action}/{self.performed_action}/{self.planned_action} {self.is_early_stopped}"
        
class ActionConfig(models.Model):
    action = models.OneToOneField(Action, related_name='action_config', on_delete=models.CASCADE, blank=False, null=False)
    eksi_sozluk_url = models.CharField(max_length=100, blank=True, null=True)
    send_data = models.BooleanField(blank=True, null=True)
    enable_noob_ban = models.BooleanField(blank=True, null=True)
    enable_mute = models.BooleanField(blank=True, null=True)
    enable_title_ban = models.BooleanField(blank=True, null=True)
    enable_anaylsis_before_operations = models.BooleanField(blank=True, null=True)
    enable_only_required_actions = models.BooleanField(blank=True, null=True)
    enable_protect_followed_users = models.BooleanField(blank=True, null=True)
    ban_premium_icons = models.BooleanField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.action}"