# EksiEngelPlus Telemetry Guide

Welcome to the comprehensive EksiEngelPlus Telemetry Guide. This document explains every section of your telemetry server at https://eksiengelplus.duzgun.org and helps you understand the data being collected.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Browser](#api-browser)
3. [Admin Panel Sections](#admin-panel-sections)
   - [EksiSozlukUser](#eksisözlükuser)
   - [Action](#action)
   - [ActionConfig](#actionconfig)
   - [Lookup Tables (Enums)](#lookup-tables-enums)
   - [Client Data Collector](#client-data-collector)
4. [Understanding Action Statistics](#understanding-action-statistics)
5. [API Endpoints for Statistics](#api-endpoints-for-statistics)
6. [How to Create Custom Stats](#how-to-create-custom-stats)

---

## Architecture Overview

The EksiEngelPlus telemetry system consists of two main Django apps:

```
Chrome Extension  ──►  api app (Action Data)
        │
        └──►  client_data_collector app (Usage Analytics)
```

| Component | Purpose |
|-----------|---------|
| **api** | Stores detailed action data (blocks, mutes, operations) |
| **client_data_collector** | Stores client usage analytics (clicks, feature usage) |

---

### API Browser

**URL:** https://eksiengelplus.duzgun.org/admin/api/

Browse all API endpoints through a simple web interface. This provides easy access to:
- Client Data Collector endpoints (analytics, upload)
- All data tables

#### Authentication
Access requires one of:
- **X-API-Key header**: For programmatic access
- **Browser login**: Enter Django admin credentials when prompted

Example with curl:
```bash
# View analytics in browser
curl -u username:password https://eksiengelplus.duzgun.org/admin/api/client_data/analytics

# Or with API key
curl -H "X-API-Key: your-api-key" https://eksiengelplus.duzgun.org/admin/api/client_data/analytics
```

---

## Admin Panel Sections

### Access URL
```
https://eksiengelplus.duzgun.org/admin/
```

---

### EksiSozlukUser

**URL:** https://eksiengelplus.duzgun.org/admin/api/eksisozlukuser/

This table tracks all Ekşi Sözlük users that have been involved in operations (either as the user performing the action or as a target).

| Field | Description | Example |
|-------|-------------|---------|
| **eksisozluk_name** | The username on Ekşi Sözlük | "johndoe" |
| **eksisozluk_id** | Unique Ekşi Sözlük user ID | 1234567 |
| **is_eksiengel_user** | True if this user has used EksiEngelPlus extension | True/False |
| **first_activity_date** | When this user first used EksiEngelPlus | 2024-01-15 10:30:00 |
| **last_activity_date** | Last time this user used EksiEngelPlus | 2024-03-01 14:22:00 |
| **last_activity_user_agent** | Browser/User-Agent string from last activity | "Mozilla/5.0..." |
| **last_activity_version** | Extension version used | "3.2.1" |

#### How to Interpret
- **is_eksiengel_user = True**: This is a user who has installed and used the EksiEngelPlus extension
- **is_eksiengel_user = False**: This is a user who has been blocked/muted by other EksiEngelPlus users (target of operations)

---

### Action

**URL:** https://eksiengelplus.duzgun.org/admin/api/action/

This is the core table that records every operation performed by EksiEngelPlus users.

| Field | Description | Example |
|-------|-------------|---------|
| **id** | Unique action identifier | 42 |
| **eksi_engel_user** | The user who performed the action | FK to EksiSozlukUser |
| **date** | When the action was performed | 2024-03-01 14:30:00 |
| **version** | Extension version used | "3.2.1" |
| **user_agent** | Browser identifier | "Mozilla/5.0..." |
| **ban_source** | Where the target list came from | See Lookup Tables below |
| **ban_mode** | Type of action performed | BAN, MUTE, FAV_BAN, etc. |
| **author_list** | Users in the target list (ManyToMany) | List of EksiSozlukUser IDs |
| **author_list_size** | Total users in target list | 150 |
| **planned_action** | How many users were planned to be processed | 150 |
| **performed_action** | How many users were actually attempted | 145 |
| **successful_action** | How many operations succeeded | 140 |
| **is_early_stopped** | If user paused/stopped the operation early | True/False |
| **log_level** | Verbosity level of logging | ERROR, WARNING, INFO |
| **log** | Detailed operation log | (large text field) |

#### Optional Fields (depend on operation type)

| Field | Description | When Used |
|-------|-------------|-----------|
| **target_type** | SINGLE, TITLE, FAV, FOLLOW | Type of operation |
| **click_source** | ENTRY_MENU, AUTHOR_MENU, etc. | Where the action was triggered |
| **fav_title** | The title (entry) related to FAV operations | FAV_BAN mode |
| **fav_entry** | The specific entry ID | FAV_BAN mode |
| **fav_author** | The author of favorited entry | FAV_BAN mode |
| **time_specifier** | TODAY, WEEK, MONTH, YEAR | TITLE_BAN mode |
| **date_criteria** | Date filter rule used | Date-based bulk operations |
| **bulk_action** | Type of bulk action | Date-based bulk operations |

#### Action Statistics Explained

```
successful_action / performed_action / planned_action
```

- **planned_action**: Total users in your blocklist when you started
- **performed_action**: Users the extension actually tried to process (may be less if you paused early)
- **successful_action**: Users where the block/mute was successfully applied

**Example:**
```
140 / 145 / 150
```
This means: Out of 150 users in the list, the extension tried to process 145 (you stopped early after 145), and 140 operations succeeded.

---

### ActionConfig

**URL:** https://eksiengelplus.duzgun.org/admin/api/actionconfig/

This table stores the configuration settings used during each action. Each Action has one ActionConfig.

| Field | Description | Type |
|-------|-------------|------|
| **action** | Reference to the Action | FK |
| **eksi_sozluk_url** | Ekşi Sözlük URL when action was performed | String |
| **send_data** | Whether telemetry is enabled | Boolean |
| **enable_noob_ban** | Block new accounts (noob filter) | Boolean |
| **enable_mute** | Enable muting functionality | Boolean |
| **enable_title_ban** | Enable title blocking | Boolean |
| **enable_anaylsis_before_operations** | Run analysis before blocking | Boolean |
| **enable_only_required_actions** | Only perform necessary actions | Boolean |
| **enable_protect_followed_users** | Don't block followed users | Boolean |
| **ban_premium_icons** | Block premium icon users | Boolean |

#### How to Interpret Config Values

These settings reflect the user's configuration at the time they performed the action. This helps you understand:
- Which features are most popular
- How users configure their blocking strategy
- Correlation between settings and success rates

---

### Lookup Tables (Enums)

These are reference tables that store the allowed values for various fields:

| Table | URL | Values |
|-------|-----|--------|
| **BanSource** | /admin/api/bansource/ | How the target list was obtained |
| **BanMode** | /admin/api/banmode/ | Type of action (BAN, MUTE, etc.) |
| **TargetType** | /admin/api/targettype/ | SINGLE, TITLE, FAV, FOLLOW |
| **ClickSource** | /admin/api/clicksource/ | Where user clicked to trigger |
| **LogLevel** | /admin/api/loglevel/ | DEBUG, INFO, WARNING, ERROR |
| **TimeSpecifier** | /admin/api/timespecifier/ | TODAY, WEEK, MONTH, YEAR |

#### Common Values

**BanMode:**
- `BAN` - Block the user
- `MUTE` - Mute the user
- `FAV_BAN` - Block users who favorited a specific entry
- `FOLLOW_BAN` - Block followers/following

**TargetType:**
- `SINGLE` - Block a single user
- `TITLE` - Block users from a title (entry page)
- `FAV` - Block based on favorited entries
- `FOLLOW` - Block based on follow relationships

**ClickSource:**
- `ENTRY_MENU` - Clicked from entry menu
- `AUTHOR_MENU` - Clicked from author menu

---

### Client Data Collector

This is a separate app that tracks client usage patterns (different from action data).

#### ClientData

**URL:** https://eksiengelplus.duzgun.org/admin/api/client_data/clientdata/

Similar to Action but stores raw client data submissions. Tracks:
- Total actions, successful actions
- Author lists processed
- Operation logs
- Configuration used

#### ClientAnalytic

**URL:** https://eksiengelplus.duzgun.org/admin/api/client_data/clientanalytic/

Tracks button clicks and feature usage:

| Field | Description |
|-------|-------------|
| **date** | When the click occurred |
| **user_agent** | Browser identifier |
| **client_name** | User's Ekşi Sözlük username |
| **client_uid** | User's Ekşi Sözlük ID |
| **click_type** | What was clicked (e.g., "BLOCK", "MUTE", "SETTINGS") |

This helps you understand:
- Which features are most used
- User engagement patterns
- Peak usage times

---

## Understanding Action Statistics

### Key Metrics to Track

1. **Success Rate**
   ```
   (successful_action / performed_action) * 100
   ```
   - Above 90%: Excellent - extension is working well
   - 70-90%: Good - some users may have already been blocked
   - Below 70%: Investigate - possible site changes or rate limiting

2. **Early Stop Rate**
   ```
   Count(is_early_stopped = True) / Total Actions
   ```
   - High rate may indicate:
     - Users don't understand pause/resume
     - Operations take too long
     - Users get satisfied with partial results

3. **Feature Usage**
   - Compare BanMode distributions (BAN vs MUTE vs FAV_BAN)
   - Identify most popular blocking strategies

4. **User Engagement**
   - Track unique EksiSozlukUser with is_eksiengel_user = True
   - Monitor last_activity_date to see active users

---

## API Endpoints for Statistics

Your server provides several API endpoints for generating statistics:

### All endpoints require admin authentication

| Endpoint | Description |
|----------|-------------|
| `/api/action/` | Submit new action data (POST) |
| `/api/user_stat/` | Get all users with their ban statistics |
| `/api/most_banned/` | List users blocked most often (count includes duplicates) |
| `/api/most_banned_unique/` | List users blocked by most unique users |
| `/api/failed_actions/` | List last 10 failed operations |
| `/api/total_action/` | Daily action counts |
| `/api/total_action_html/` | Visual chart of daily actions |

### Example: Getting Most Blocked Users

```bash
# Get users who have been blocked the most (by unique blockers)
curl -u admin_username:admin_password \
  https://eksiengelplus.duzgun.org/api/most_banned_unique/

# Response:
[
  {"eksisozluk_name": "trolluser123", "eksisozluk_id": 9876543, "banned_by_unique_count": 156},
  {"eksisozluk_name": "spamuser", "eksisozluk_id": 1234567, "banned_by_unique_count": 89},
  ...
]
```

### Example: Daily Activity Chart

Visit: https://eksiengelplus.duzgun.org/api/total_action_html/

This renders a visual chart showing actions per day.

---

## How to Create Custom Stats

### Using Django Admin

1. Go to https://eksiengelplus.duzgun.org/admin/
2. Navigate to the relevant model (e.g., Action)
3. Use filters to create custom views:
   - Filter by date range
   - Filter by ban_mode
   - Filter by eksi_engel_user
4. Use "Export" to download CSV

### Using the API with Custom Queries

You can create custom statistics by querying the API directly:

#### Example: Most Active Users (Users who block the most)

```python
# In Django shell
from api.models import Action, EksiSozlukUser
from django.db.models import Count

# Users who have performed the most actions
most_active = EksiSozlukUser.objects.filter(
    is_eksiengel_user=True
).annotate(
    action_count=Count('eksi_engel_user_in_action')
).order_by('-action_count')[:10]

for user in most_active:
    print(f"{user.eksisozluk_name}: {user.action_count} actions")
```

#### Example: Success Rate by Ban Mode

```python
from api.models import Action
from django.db.models import Avg, F

# Average success rate by ban mode
success_rates = Action.objects.annotate(
    success_rate=100 * F('successful_action') * 1.0 / F('performed_action')
).values('ban_mode__ban_mode').annotate(
    avg_success=Avg('success_rate')
)

for rate in success_rates:
    print(f"{rate['ban_mode__ban_mode']}: {rate['avg_success']:.1f}%")
```

#### Example: Users Who Block the Most Unique People

```python
from api.models import EksiSozlukUser
from django.db.models import Count, Q

# Top blockers - users who have blocked the most unique users
top_blockers = EksiSozlukUser.objects.filter(
    is_eksiengel_user=True
).annotate(
    unique_blocked=Count(
        'author_list_in_action__author_list',
        distinct=True,
        filter=Q(author_list_in_action__ban_mode__ban_mode='BAN')
    )
).order_by('-unique_blocked')[:20]

for user in top_blockers:
    print(f"{user.eksisozluk_name}: {user.unique_blocked} unique users blocked")
```

#### Example: Most Blocked Users (Who gets blocked the most)

```python
from api.models import EksiSozlukUser
from django.db.models import Count, Q

# Users who have been blocked the most times
most_blocked = EksiSozlukUser.objects.annotate(
    blocked_count=Count(
        'author_list_in_action',
        filter=Q(author_list_in_action__ban_mode__ban_mode='BAN')
    )
).filter(blocked_count__gt=0).order_by('-blocked_count')[:20]

for user in most_blocked:
    print(f"{user.eksisozluk_name}: blocked {user.blocked_count} times")
```

#### Example: Creating Custom Admin Views

Add to `api/admin.py`:

```python
from django.contrib import admin
from django.db.models import Count, F
from .models import Action

class ActionAdmin(admin.ModelAdmin):
    list_filter = ('ban_mode', 'ban_source', 'is_early_stopped', 'date')
    search_fields = ('eksi_engel_user__eksisozluk_name',)
    readonly_fields = ('date',)
    
    # Add custom columns
    list_display = ('id', 'eksi_engel_user', 'ban_mode', 'successful_action', 
                    'performed_action', 'planned_action', 'is_early_stopped', 'date')
    
    # Add success rate calculation
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        qs = qs.annotate(
            success_rate=100 * F('successful_action') * 1.0 / F('performed_action')
        )
        return qs
    
    success_rate.short_description = 'Success %'

# Update the registration
admin.site.register(Action, ActionAdmin)
```

### Using the Built-in Statistics Endpoint

The `/api/user_stat/` endpoint provides comprehensive per-user statistics:

```json
{
  "eksisozluk_name": "johndoe",
  "eksisozluk_id": 1234567,
  "action_for_ban_count": 45,
  "ban_count": 150,
  "ban_unique_count": 120,
  "banned_by_count": 5,
  "banned_by_unique_count": 3
}
```

**Field Meanings:**
- `action_for_ban_count`: How many times this user used EksiEngel to ban others
- `ban_count`: Total authors this user has blocked (including duplicates)
- `ban_unique_count`: Unique authors this user has blocked
- `banned_by_count`: How many times this user has been blocked
- `banned_by_unique_count`: By how many unique users this user has been blocked

---

## Quick Reference

### Common Questions

| Question | Answer |
|----------|--------|
| Why is performed_action less than planned_action? | User stopped the operation early (is_early_stopped=True) |
| Why is successful_action less than performed_action? | Some users were already blocked/muted, or rate limiting occurred |
| What does is_early_stopped=True mean? | User clicked pause/stop before completing all operations |
| How to see who blocks the most? | Use `/api/most_banned_unique/` endpoint |
| How to see who is blocked the most? | Use `/api/most_banned/` endpoint |
| How to see daily activity? | Visit `/api/total_action_html/` |

### Data Retention

- Action data is retained indefinitely
- User activity dates help identify inactive users
- Consider archiving old data for performance

---

## Troubleshooting

### No Data Appearing

1. **Check API Key**: Ensure extension has correct API key in `config.js`
2. **Check Network**: Extension must be able to reach your server
3. **Check Logs**: Look at Action log field for errors

### Data Looks Wrong

1. **Test Success Rate**: Should be > 70% typically
2. **Check Configuration**: ActionConfig shows user settings
3. **Review Early Stop**: High early stop rate may indicate issues

---

*Document Version: 1.0*  
*Last Updated: 2026-03-01*
