from rest_framework import serializers
from .models import Action, ActionConfig, EksiSozlukUser, EksiSozlukTitle, EksiSozlukEntry
from django.utils import timezone
from django.db.models import Count, Q
from django.contrib.auth.models import User

class MostBannedUsersUniqueSerializer(serializers.ModelSerializer):
    banned_by_unique_count = serializers.IntegerField()
    class Meta:
        model = EksiSozlukUser
        fields = ('eksisozluk_name', 
                  'eksisozluk_id', 
                  'banned_by_unique_count',)

class MostBannedUsersSerializer(serializers.ModelSerializer):
    banned_by_count = serializers.IntegerField()
    class Meta:
        model = EksiSozlukUser
        fields = ('eksisozluk_name', 
                  'eksisozluk_id', 
                  'banned_by_count',)

class EksiSozlukUserStatViewSerializer(serializers.ModelSerializer):
    action_for_ban_count = serializers.SerializerMethodField()
    ban_count = serializers.SerializerMethodField()
    ban_unique_count = serializers.SerializerMethodField()
    banned_by_count = serializers.SerializerMethodField()
    banned_by_unique_count = serializers.SerializerMethodField()
    class Meta:
        model = EksiSozlukUser
        fields = ('eksisozluk_name', 
                  'eksisozluk_id', 
                  'action_for_ban_count',
                  'ban_count', 
                  'ban_unique_count', 
                  'banned_by_count', 
                  'banned_by_unique_count')
             
    def get_action_for_ban_count(self, obj):
        # number of times the user has used the eksi engel
        filtered_obj = EksiSozlukUser.objects.filter(eksisozluk_id=obj.eksisozluk_id) 
        calculated_val = filtered_obj.aggregate(action_for_ban_count=Count('eksi_engel_user_in_action', distinct=False, filter=Q(eksi_engel_user_in_action__ban_mode__ban_mode="BAN")))
        return calculated_val["action_for_ban_count"]    
        
    def get_ban_count(self, obj):
        # total number of authors targeted by the user (authors not unique)
        filtered_obj = EksiSozlukUser.objects.all()    
        calculated_val = filtered_obj.aggregate(ban_count=Count('author_list_in_action__eksi_engel_user', distinct=False, filter=Q(author_list_in_action__ban_mode__ban_mode="BAN") & Q(author_list_in_action__eksi_engel_user__eksisozluk_id=obj.eksisozluk_id)))    
        return calculated_val["ban_count"]    
        
    def get_ban_unique_count(self, obj):
        # total number of authors targeted by the user (authors are unique)
        filtered_obj = EksiSozlukUser.objects.all()
        calculated_val = filtered_obj.aggregate(ban_unique_count=Count('author_list_in_action__author_list', distinct=True, filter=Q(author_list_in_action__ban_mode__ban_mode="BAN") & Q(author_list_in_action__eksi_engel_user__eksisozluk_id=obj.eksisozluk_id)))    
        return calculated_val["ban_unique_count"] 
        
    def get_banned_by_count(self, obj):
        # total number of ban on the user performed by other authors (authors not unique)
        filtered_obj = EksiSozlukUser.objects.filter(eksisozluk_id=obj.eksisozluk_id) 
        calculated_val = filtered_obj.aggregate(banned_by_count=Count('author_list_in_action__eksi_engel_user', distinct=False, filter=Q(author_list_in_action__ban_mode__ban_mode="BAN"))) 
        return calculated_val["banned_by_count"]     
        
    def get_banned_by_unique_count(self, obj):
        # total number of ban on the user performed by other authors (authors are unique)
        filtered_obj = EksiSozlukUser.objects.filter(eksisozluk_id=obj.eksisozluk_id) 
        calculated_val = filtered_obj.aggregate(banned_by_unique_count=Count('author_list_in_action__eksi_engel_user', distinct=True, filter=Q(author_list_in_action__ban_mode__ban_mode="BAN")))
        return calculated_val["banned_by_unique_count"] 

class WriteActionConfigSerializer(serializers.ModelSerializer):
    # ActionConfig has a foreign key to Action, but this key is not exist while collecting data from user
    # ActionConfig has a id, but this field is not exist while collecting data from user
    class Meta:
        model = ActionConfig
        exclude = ('id','action')
        
class WriteEksiSozlukTitleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EksiSozlukTitle
        exclude = ('id',)
        
    def create(self, validated_data):  
        eksisozluk_title = EksiSozlukTitle.objects.filter(**validated_data).first() # = filtered row OR None
        if not eksisozluk_title:
            # TODO: user must be unique with name and id, but constraint on model or serializer cause problems
            # https://stackoverflow.com/questions/38438167/unique-validation-on-nested-serializer-on-django-rest-framework
            # so it should be resolved by controlling manually
            eksisozluk_title = EksiSozlukTitle.objects.create(**validated_data)
            eksisozluk_title.save()
            
        return eksisozluk_title
        
class WriteEksiSozlukEntrySerializer(serializers.ModelSerializer):
    eksisozluk_title = WriteEksiSozlukTitleSerializer(many=False, read_only=False)
    class Meta:
        model = EksiSozlukEntry
        exclude = ('id',)        
    
    def create(self, validated_data):  
        eksisozluk_title_dict = validated_data.pop("eksisozluk_title")
        eksisozluk_title = EksiSozlukTitle.objects.filter(**eksisozluk_title_dict).first() # = filtered row OR None
        if not eksisozluk_title:
            # TODO: user must be unique with name and id, but constraint on model or serializer cause problems
            # https://stackoverflow.com/questions/38438167/unique-validation-on-nested-serializer-on-django-rest-framework
            # so it should be resolved by controlling manually
            eksisozluk_title = EksiSozlukTitle.objects.create(**eksisozluk_title_dict)
            eksisozluk_title.save()
            
        eksisozluk_entry = EksiSozlukEntry.objects.filter(**validated_data).first() # = filtered row OR None
        if not eksisozluk_entry:
            # TODO: user must be unique with name and id, but constraint on model or serializer cause problems
            # https://stackoverflow.com/questions/38438167/unique-validation-on-nested-serializer-on-django-rest-framework
            # so it should be resolved by controlling manually
            eksisozluk_entry = EksiSozlukEntry.objects.create(eksisozluk_title=eksisozluk_title, **validated_data)
            eksisozluk_entry.save()
            
        return eksisozluk_entry
        
        
        
class WriteFavAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = EksiSozlukUser
        fields = ('eksisozluk_name', 'eksisozluk_id')
        
    def create(self, validated_data):
        fav_author = EksiSozlukUser.objects.filter(**validated_data).first() # user = filtered user OR None
        if not fav_author:
            # create a user
            # TODO: user must be unique with name and id, but constraint on model or serializer cause problems
            # https://stackoverflow.com/questions/38438167/unique-validation-on-nested-serializer-on-django-rest-framework
            # so it should be resolved by controlling manually
            fav_author = EksiSozlukUser.objects.create(is_eksiengel_user=False,**validated_data)
            fav_author.save()
        return fav_author
        
class WriteEksiEngelUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = EksiSozlukUser
        fields = ('eksisozluk_name', 'eksisozluk_id')
        
    def create(self, validated_data):
        eksi_engel_user = EksiSozlukUser.objects.filter(**validated_data).first() # user = filtered user OR None
        if eksi_engel_user:
            # the user is exist so update the relevant fields
            eksi_engel_user.is_eksiengel_user = True
            eksi_engel_user.last_activity_date = timezone.now()
            eksi_engel_user.last_activity_user_agent = self.context.get('user_agent')
            eksi_engel_user.last_activity_version = self.context.get('version')
        else:
            # create a user
            # TODO: user must be unique with name and id, but constraint on model or serializer cause problems
            # https://stackoverflow.com/questions/38438167/unique-validation-on-nested-serializer-on-django-rest-framework
            # so it should be resolved by controlling manually
            eksi_engel_user = EksiSozlukUser.objects.create(
                is_eksiengel_user=True,
                first_activity_date=timezone.now(),
                last_activity_date=timezone.now(),
                last_activity_user_agent = self.context.get('user_agent'),
                last_activity_version = self.context.get('version'),
                **validated_data
            )
        eksi_engel_user.save()
        return eksi_engel_user
        
class WriteActionViewSerializer(serializers.ModelSerializer):
    # Action has some foreign key fields, but these fields might not exist in db while collecting data from user, we need to create them
    # also, some fields are optinal and that is why we need to handle them manually
    eksi_engel_user = WriteEksiEngelUserSerializer(many=False, read_only=False)
    author_list = WriteEksiEngelUserSerializer(many=True, read_only=False)
    fav_author = WriteFavAuthorSerializer(many=False, read_only=False, required=False, allow_null=True)
    fav_title = WriteEksiSozlukTitleSerializer(many=False, read_only=False, required=False, allow_null=True)
    fav_entry = WriteEksiSozlukEntrySerializer(many=False, read_only=False, required=False, allow_null=True)
        
    class Meta:
        model = Action
        exclude = ('id', 'date') # date is autogenerated, id will not be collected from the client
        
    def create(self, validated_data):
        # create the user if not exist, or update the existing user
        eksi_engel_user_dict = validated_data.pop('eksi_engel_user')
        eksi_engel_user_serializer = WriteEksiEngelUserSerializer(data=eksi_engel_user_dict, context=validated_data)
        eksi_engel_user_serializer.is_valid(raise_exception=True)
        eksi_engel_user = eksi_engel_user_serializer.save() # no need for validity check
        
        # control if the fav_author exists in incoming data
        fav_author_dict = validated_data.pop('fav_author', None) # pop or None
        fav_author = None
        if(fav_author_dict):
            # create the user (fav_author) if not exist, or update the existing user
            fav_author_serializer = WriteFavAuthorSerializer(data=fav_author_dict)
            fav_author_serializer.is_valid(raise_exception=True)
            fav_author = fav_author_serializer.save() # no need for validity check
            
        # control if the fav_title exists in incoming data
        fav_title_dict = validated_data.pop('fav_title', None) # pop or None
        fav_title = None
        if(fav_title_dict):
            # create the fav_title if not exist, or update the existing user
            fav_title_serializer = WriteEksiSozlukTitleSerializer(data=fav_title_dict)
            fav_title_serializer.is_valid(raise_exception=True)
            fav_title = fav_title_serializer.save() # no need for validity check
            
        # control if the fav_entry exists in incoming data
        fav_entry_dict = validated_data.pop('fav_entry', None) # pop or None
        fav_entry = None
        if(fav_entry_dict):
            # create the fav_entry if not exist, or update the existing user
            fav_entry_serializer = WriteEksiSozlukEntrySerializer(data=fav_entry_dict)
            fav_entry_serializer.is_valid(raise_exception=True)
            fav_entry = fav_entry_serializer.save() # no need for validity check
        
        
        author_list_dict = validated_data.pop('author_list')
        action = Action.objects.create(eksi_engel_user=eksi_engel_user, fav_author=fav_author, fav_title=fav_title, fav_entry=fav_entry, **validated_data)
        action.save()
        
        # create users in the author_list if necessary
        # TODO: this could somehow could be rewritten as bulk create and serializers
        for author_dict in author_list_dict:
            author = EksiSozlukUser.objects.filter(**author_dict).first()
            if not author:
                # create a new user, this user is not active user of eksi engel
                author = EksiSozlukUser.objects.create(is_eksiengel_user=False,**author_dict)
                author.save()
            # add created user into action
            action.author_list.add(author)
        action.save()
        
        return action
        
        
class CollectActionDataSerializer(serializers.Serializer):
    action = WriteActionViewSerializer(many=False, read_only=False)
    action_config = WriteActionConfigSerializer(many=False, read_only=False, required=False, allow_null=True)
        
    def create(self, validated_data):
        # access action        
        action_dict = validated_data.get('action')
        action_serializer = WriteActionViewSerializer(data=self.data["action"])
        action_serializer.is_valid(raise_exception=True)
        action = action_serializer.save() # no need for validity check
        
        # create the action_config
        action_config_dict = validated_data.get('action_config')
        action_config = None
        if action_config_dict:
            action_config = ActionConfig.objects.create(action=action, **action_config_dict)
            action_config.save()
        
        return {
            "action": action,
            "action_config": action_config
        }
        
class TotalActionViewSerializer(serializers.Serializer):
    day = serializers.DateTimeField(format="%Y-%m-%d")  # To represent the day
    total = serializers.IntegerField()  # To represent the count