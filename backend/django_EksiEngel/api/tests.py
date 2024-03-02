from django.test import TestCase
import json

#TODO: I need to write tests for ban_count calculations and missing fields such as fav_author

user1 = {'eksisozluk_name': 'active_user_1', 'eksisozluk_id': 1}
user2 = {'eksisozluk_name': 'passive_user_2', 'eksisozluk_id': 2}
user3 = {'eksisozluk_name': 'passive_user_3', 'eksisozluk_id': 3}
user4 = {'eksisozluk_name': 'passive_user_4', 'eksisozluk_id': 4}
title1 = {'eksisozluk_name': 'title_1', 'eksisozluk_id': 1}
title2 = {'eksisozluk_name': 'title_2', 'eksisozluk_id': 2}
entry1 = {'eksisozluk_id': 1, 'eksisozluk_title': title1}   

collectActionDataViewDataString = '''
{
  "action": {
    "eksi_engel_user": {
      "eksisozluk_name": "active_user_1",
      "eksisozluk_id": 1
    }, 
    "author_list": [ 
      { 
        "eksisozluk_name": "passive_user_2",
        "eksisozluk_id": 2
      },
      { 
        "eksisozluk_name": "passive_user_3",
        "eksisozluk_id": 3
      }
    ],
    "version": "v1.1",
    "user_agent" : "Mozilla 5.0",
    "ban_source" : 1,
    "ban_mode" : 1,
    "author_list_size" : 2,
    "planned_action" : 1,
    "performed_action" : 1,
    "successful_action" : 1,
    "is_early_stopped" : 0,
    "log_level" : 1,
    "log" : "['INF deneme','ERR hata']",
    "target_type": 1,
    "click_source": 1,
    "time_specifier": 2,
    "fav_entry" : {
      "eksisozluk_id": 5,
      "eksisozluk_title": {
        "eksisozluk_name": "title_1",
        "eksisozluk_id": 1
      }
    },
    "fav_title": {
      "eksisozluk_name": "title_2",
      "eksisozluk_id": 2
    },
    "fav_author" : { 
        "eksisozluk_name": "passive_user_4",
        "eksisozluk_id": 4
    }
  },    
  "action_config": {
      "eksi_sozluk_url": "test.com",
      "send_data": true,
      "send_client_name": false,
      "enable_noob_ban": true,
      "enable_mute": false,
      "enable_title_ban": false,
      "enable_anaylsis_before_operations": false,
      "enable_only_required_actions": false,
      "enable_protect_followed_users": false,
      "ban_premium_icons": false
  }
}
'''

collectActionDataViewDataJSON = json.loads(collectActionDataViewDataString)
collectActionDataViewDataJSON["action"]["fav_author"] = {"test":123}
print(collectActionDataViewDataJSON["action"])