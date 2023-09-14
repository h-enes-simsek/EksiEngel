from django.db import models

class BanSource(models.Model):
    ban_source = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.ban_source
    
class BanMode(models.Model):
    ban_mode = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.ban_mode
    
class TargetType(models.Model):
    target_type = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.target_type
    
class ClickSource(models.Model):
    click_source = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.click_source
    
class LogLevel(models.Model):
    log_level = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.log_level
        
class ClickType(models.Model):
    click_type = models.CharField(max_length=100, blank=False)
    def __str__(self):
        return self.click_type

class Config(models.Model):
    eksi_sozluk_url = models.CharField(max_length=100, blank=False)
    send_data = models.BooleanField()
    send_client_name = models.BooleanField()
    enable_noob_ban = models.BooleanField()
    enable_mute = models.BooleanField()
    enable_title_ban = models.BooleanField()
    enable_anaylsis_before_operations = models.BooleanField()
    enable_only_required_actions = models.BooleanField()
    enable_protect_followed_users = models.BooleanField()
    ban_premium_icons = models.BooleanField()

class ClientData(models.Model):
    date = models.DateTimeField(auto_now_add=True, blank=True)
    version = models.CharField(max_length=16, blank=False, null=True)
    user_agent = models.CharField(max_length=1024, blank=False)
    client_name = models.CharField(max_length=96, blank=False)
    ban_source = models.ForeignKey(BanSource, on_delete=models.PROTECT, blank=False)
    ban_mode = models.ForeignKey(BanMode, on_delete=models.PROTECT, blank=False)
    author_name_list = models.CharField(max_length=100000, blank=False)
    author_id_list = models.CharField(max_length=100000, blank=False)
    author_list_size = models.IntegerField(blank=False)
    total_action = models.IntegerField(blank=False)
    successful_action = models.IntegerField(blank=False)
    is_early_stopped = models.IntegerField(blank=False)
    log_level = models.ForeignKey(LogLevel, on_delete=models.PROTECT)
    log = models.CharField(max_length=1000000, blank=False)
    
    # SINGLE
    target_type = models.ForeignKey(TargetType, on_delete=models.PROTECT, blank=False, null=True)

    # SINGLE + FAV + FOLLOW
    click_source = models.ForeignKey(ClickSource, on_delete=models.PROTECT, blank=False, null=True)
    fav_entry_id = models.BigIntegerField(blank=False, default=0) 
    fav_title_id = models.BigIntegerField(blank=False, default=0)
    fav_title_name = models.CharField(max_length=128, blank=False)
    fav_author_id = models.BigIntegerField(blank=False, default=0)
    fav_author_name = models.CharField(max_length=96, blank=False)

    def __str__(self):
        return f"{self.date.strftime('%Y-%m-%d %H:%M:%S')} {self.client_name} {self.ban_source} {self.successful_action}/{self.total_action}/{self.author_list_size} {self.is_early_stopped}"
        
class ClientAnalytic(models.Model):
    date = models.DateTimeField(blank=False)
    user_agent = models.CharField(max_length=1024, blank=False)
    client_name = models.CharField(max_length=96)
    client_uid = models.BigIntegerField() 
    click_type = models.ForeignKey(ClickType, on_delete=models.PROTECT)
    def __str__(self):
        return str(self.date) + " " + str(self.client_name) + " " + str(self.click_type)