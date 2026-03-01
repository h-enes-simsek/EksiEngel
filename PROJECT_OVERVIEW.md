# EksiEngelPlus Project Overview

## Summary

The project "EksiEngelPlus" is a Chrome browser extension designed to facilitate mass blocking/unblocking of users on Ekşi Sözlük. It provides comprehensive blocking options including individual users, their titles, users who favorited specific entries, followers of specific users, and advanced migration features between blocked/muted states.

## Repository Structure

```
EksiEngel/
├── frontend/
│   ├── app/                          # Chrome Extension (Manifest V3)
│   │   ├── manifest.json             # Extension configuration
│   │   └── assets/
│   │       ├── js/                   # JavaScript Modules (10,059 lines total)
│   │       │   ├── programController.js    # 2129 lines - Complex operation controller
│   │       │   ├── notification.js         # 1655 lines - UI controller for notification page
│   │       │   ├── background.js           # 1109 lines - Service worker orchestrator
│   │       │   ├── scrapingHandler.js      # 1077 lines - Web scraping and data extraction
│   │       │   ├── storageHandler.js       #  907 lines - Chrome storage abstraction
│   │       │   ├── script.js               #  776 lines - Content script with MutationObserver
│   │       │   ├── faq.js                  #  565 lines - Settings page controller
│   │       │   ├── resumableOperation.js   #  448 lines - Pause/resume operation support
│   │       │   ├── notificationHandler.js  #  384 lines - Real-time status management
│   │       │   ├── buttonStateManager.js   #  355 lines - UI button state management
│   │       │   ├── queue.js                #  244 lines - Auto-executing task queue
│   │       │   ├── utils.js                #  230 lines - Utility functions
│   │       │   ├── relationHandler.js      #  191 lines - Ekşi Sözlük API communication
│   │       │   ├── commHandler.js          #  144 lines - Backend API communication
│   │       │   ├── enums.js                #   88 lines - Centralized constants
│   │       │   ├── urlHandler.js           #   78 lines - Site accessibility validation
│   │       │   ├── config.js               #   74 lines - Configuration management
│   │       │   ├── authorListPage.js       #   42 lines - Author list page controller
│   │       │   ├── log.js                  #   37 lines - Logging system
│   │       │   ├── popup.js                #   25 lines - Popup UI controller
│   │       │   ├── welcome.js              #   11 lines - Welcome page controller
│   │       │   └── jsdom.js                # Large vendor file - DOM utilities
│   │       ├── html/                 # HTML Pages (1,021 lines total)
│   │       │   ├── faq.html                # 431 lines - Settings and documentation
│   │       │   ├── notification.html       # 287 lines - Main operations page
│   │       │   ├── documentation.html      # 145 lines - Extended documentation
│   │       │   ├── welcome.html            #  79 lines - Onboarding interface
│   │       │   ├── authorListPage.html     #  56 lines - User list management
│   │       │   └── popup.html              #  23 lines - Extension popup
│   │       ├── css/                 # Stylesheets (1,888 lines total)
│   │       │   ├── customNotification.css  # 1123 lines - Notification page styles
│   │       │   ├── switchButtons.css       #  521 lines - Toggle switch components
│   │       │   ├── buttons.css             #   87 lines - Button component styles
│   │       │   ├── tooltip.css             #   84 lines - Tooltip styles
│   │       │   ├── customPopup.css         #   57 lines - Popup styles
│   │       │   └── footer.css              #   16 lines - Footer styles
│   │       └── img/                 # Extension icons and images
│   │           ├── eksiengel16.png         # Extension icon (16x16)
│   │           ├── eksiengel32.png         # Extension icon (32x32)
│   │           ├── eksiengel48.png         # Extension icon (48x48)
│   │           ├── eksiengel128.png        # Extension icon (128x128)
│   │           ├── semsiye.png             # UI image
│   │           ├── authorMenu.png          # Screenshot
│   │           ├── entryMenu.png           # Screenshot
│   │           └── *.svg                   # Various icons
│   └── publish/                      # Chrome Web Store assets
│       ├── ss/                       # Screenshots
│       ├── promo/                    # Promotional images
│       └── README.md
├── backend/
│   └── django_EksiEngel/            # Django REST API Server
│       ├── manage.py                # Django management script
│       ├── requirements.txt         # Python dependencies
│       ├── django_EksiEngel/        # Core Django project
│       │   ├── settings.py          # Django settings
│       │   ├── urls.py              # Main URL routing
│       │   ├── wsgi.py              # WSGI deployment
│       │   └── asgi.py              # ASGI deployment
│       ├── api/                     # Action Analytics API
│       │   ├── models.py            # Data models
│       │   ├── views.py             # API endpoints
│       │   ├── urls.py              # URL patterns
│       │   ├── serializers.py       # DRF serializers
│       │   └── fixtures/            # Initial data
│       ├── client_data_collector/   # Client Analytics API
│       │   ├── models.py            # Analytics models
│       │   ├── views.py             # Data collection endpoints
│       │   ├── urls.py              # URL patterns
│       │   └── fixtures/            # Enum definitions
│       └── where_is_eksisozluk/     # URL Status Monitoring
│           ├── models.py            # Status models
│           ├── views.py             # Status endpoints
│           └── urls.py              # URL patterns
├── docs/                            # Documentation Website
│   ├── index.html                   # Documentation homepage
│   ├── privacypolicy.html           # Privacy policy
│   ├── releaseNotes.html            # Release notes
│   ├── changelog.json               # Version history
│   ├── ss/                          # Screenshots
│   └── feature_plans/               # Feature planning docs
├── context_portal/                  # Context Database (development)
│   ├── alembic/                     # Database migrations
│   ├── context.db                   # SQLite database
│   └── conport_vector_data/         # Vector data storage
├── AGENTS.md                        # AI assistant instructions
├── PROJECT_OVERVIEW.md              # This file
├── README.md                        # Project readme
└── LICENSE.txt                      # MIT License
```

## Frontend Architecture (Chrome Extension)

### Main UI Components

| Page | Location | Purpose |
|------|----------|---------|
| **Popup** | `assets/html/popup.html` + `assets/js/popup.js` | Main extension configuration menu |
| **Notification** | `assets/html/notification.html` + `assets/js/notification.js` | Real-time progress tracking, operations UI |
| **FAQ/Settings** | `assets/html/faq.html` + `assets/js/faq.js` | Settings, date filter rules, documentation |
| **Author List** | `assets/html/authorListPage.html` + `assets/js/authorListPage.js` | User list management |
| **Welcome** | `assets/html/welcome.html` + `assets/js/welcome.js` | Initial setup and onboarding |

### Core Processing Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| **programController.js** | 2129 | High-level operation controller for complex workflows |
| **background.js** | 1109 | Service worker orchestrator, message handling |
| **scrapingHandler.js** | 1077 | Web scraping for user data, followers, favorites |
| **storageHandler.js** | 907 | Chrome storage management, caching |
| **script.js** | 776 | Content script with MutationObserver |
| **resumableOperation.js** | 448 | Pause/resume functionality for operations |
| **notificationHandler.js** | 384 | Real-time status updates |
| **buttonStateManager.js** | 355 | UI button state management |
| **queue.js** | 244 | Auto-executing task queue system |
| **utils.js** | 230 | Helper functions, date filtering |
| **relationHandler.js** | 191 | Direct Ekşi Sözlük API communication |

### Support Services

| Module | Purpose |
|--------|---------|
| **commHandler.js** | Backend API communication for analytics |
| **config.js** | Persistent configuration with 15+ options |
| **urlHandler.js** | Site accessibility validation |
| **enums.js** | Centralized constants (ActionTypes, Modes, Sources) |
| **log.js** | Logging system with levels |

## Backend Architecture (Django)

### Django Applications

| App | Path | Purpose |
|-----|------|---------|
| **api** | `/api/` | Action analytics, blocked user statistics |
| **client_data_collector** | `/admin/api/client_data/` | Client-side analytics, usage patterns |
| **where_is_eksisozluk** | `/where_is_eksisozluk/` | URL status monitoring |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/action/` | Log blocking/unblocking actions |
| `/api/where_is_eksisozluk/` | Get current Ekşi Sözlük URL |
| `/admin/api/client_data/analytics` | UI interaction analytics (GET/POST) |
| `/admin/api/client_data/upload` | Configuration and usage data (POST) |

## Key Features

* **Comprehensive User Blocking:**
  * Individual user blocking from entries, profiles, or lists
  * Mass blocking users who favorited specific entries
  * Mass blocking followers of specific users
  * Title-based blocking (block all titles by specific users)

* **Date-Based User Filtering:**
  * Filter users by account registration date before blocking
  * Protect legacy accounts (use bulk action with ENGEL_KALDIR for older accounts)
  * Block newly created accounts (configurable threshold)
  * Custom filter rules with ENGELLE (Block) action
  * 30-day TTL caching for registration dates to optimize performance

* **Date-Based Bulk Actions:**
  * Source options: Blocked users list, Muted users list, or Author list
  * Date criteria: Account age (newer/older than) or specific dates (before/after)
  * Actions: Block, Mute, Unblock, Unmute, or Follow matching users

* **Advanced Migration System:**
  * Migrate blocked users to muted status (and vice versa)
  * Block all muted users in bulk
  * Block titles of blocked/muted users
  * Unblock all users and remove all mutes

* **Operation Control System:**
  * Checkpoint-based pause/resume for supported operations
  * Operation state tracking (RUNNING, PAUSING, PAUSED, STOPPING, STOPPED, COMPLETED)
  * Intelligent pause support detection
  * Early stop capability with cleanup

## Development Notes

- **Manifest Version:** 3 (latest Chrome extension standard)
- **Module System:** ES6+ modules with import/export
- **Async/Await:** Extensive use throughout for promise handling
- **Chrome APIs:** tabs, storage, notifications, runtime messaging
- **Database:** PostgreSQL with Django ORM
- **Backend:** Django 4.1 with Django REST Framework
- **No External Frameworks:** Vanilla JavaScript for DOM manipulation
- **Internationalization:** Turkish language interface with English code comments

## Commands

- **Backend:** `cd backend/django_EksiEngel && python manage.py runserver`
- **Load extension:** Load `frontend/app/` as unpacked in `chrome://extensions` (Developer mode)
