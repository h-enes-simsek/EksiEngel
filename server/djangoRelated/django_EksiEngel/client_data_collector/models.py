from django.db import models

class BanSource(models.Model):
    ban_source = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.ban_source
    
class BanMode(models.Model):
    ban_mode = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.ban_mode
    
class LogLevel(models.Model):
    log_level = models.CharField(max_length=10, blank=False)
    def __str__(self):
        return self.log_level
        
class ClickType(models.Model):
    click_type = models.CharField(max_length=100, blank=False)
    def __str__(self):
        return self.click_type

class ClientData(models.Model):
    date = models.DateTimeField(blank=False)
    user_agent = models.CharField(max_length=1024, blank=False)
    client_name = models.CharField(max_length=96, blank=False)
    ban_source = models.ForeignKey(BanSource, on_delete=models.PROTECT, blank=False)
    ban_mode = models.ForeignKey(BanMode, on_delete=models.PROTECT, blank=False)
    fav_entry_id = models.BigIntegerField(blank=False) 
    fav_title_id = models.BigIntegerField(blank=False)
    fav_title_name = models.CharField(max_length=128, blank=False)
    fav_author_id = models.BigIntegerField(blank=False)
    fav_author_name = models.CharField(max_length=96, blank=False)
    author_name_list = models.CharField(max_length=100000, blank=False)
    author_id_list = models.CharField(max_length=100000, blank=False)
    author_list_size = models.IntegerField(blank=False)
    total_action = models.IntegerField(blank=False)
    successful_action = models.IntegerField(blank=False)
    is_early_stopped = models.IntegerField(blank=False)
    log_level = models.ForeignKey(LogLevel, on_delete=models.PROTECT)
    log = models.CharField(max_length=1000000, blank=False)
    def __str__(self):
        return str(self.date) + " " + self.client_name
        
class ClientAnalytic(models.Model):
    date = models.DateTimeField(blank=False)
    user_agent = models.CharField(max_length=1024, blank=False)
    client_name = models.CharField(max_length=96)
    client_uid = models.BigIntegerField() 
    click_type = models.ForeignKey(ClickType, on_delete=models.PROTECT)
    def __str__(self):
        return str(self.date) + " " + str(self.client_name) + " " + str(self.click_type)