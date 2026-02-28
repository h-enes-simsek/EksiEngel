# AGENTS.md - Developer Guide for EksiEngel

## Project Overview
Chrome extension for mass blocking on Ekşi Sözlük with Django backend for analytics.

```
EksiEngel/
├── frontend/app/                    # Chrome Extension (Manifest V3)
│   ├── manifest.json               # Extension configuration
│   └── assets/
│       ├── js/                     # JavaScript modules (ES6+)
│       ├── html/                    # Extension pages
│       ├── css/                     # Stylesheets
│       └── img/                     # Icons and images
├── backend/django_EksiEngel/        # Django REST API
│   ├── api/                        # Action analytics
│   ├── client_data_collector/      # Client analytics
│   └── where_is_eksisozluk/        # URL monitoring
├── context_portal/                 # Development database
└── PROJECT_OVERVIEW.md             # Detailed architecture
```

---

## Commands

### Frontend (Chrome Extension)
No build system required - load directly as unpacked extension.

```bash
# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select frontend/app/ directory
```

### Backend (Django)

```bash
# Install dependencies
cd backend/django_EksiEngel
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver

# Run tests (all test files)
python manage.py test

# Run specific test file
python manage.py test api.tests

# Run specific test class
python manage.py test api.tests.ActionModelTest

# Run specific test method
python manage.py test api.tests.ActionModelTest.test_ban_count_calculation
```

### Linting

```bash
# JavaScript (ESLint - if installed)
npx eslint frontend/app/assets/js/*.js

# Python (flake8)
flake8 backend/django_EksiEngel/api/
flake8 backend/django_EksiEngel/ --exclude=migrations

# Python (pylint)
pylint backend/django_EksiEngel/api/models.py
```

---

## Code Style Guidelines

### JavaScript (Frontend)

**Imports & Exports:**
- Use ES6 module syntax: `import { foo } from './module.js';`
- Use named exports for utilities/enums: `export const Foo = { ... };`
- Use relative imports with `.js` extension

**Naming Conventions:**
- Functions/variables: `camelCase` (e.g., `getConfig()`, `isActive`)
- Constants/enums: `UPPER_SNAKE_CASE` for values, `PascalCase` for keys
- Classes: `PascalCase`
- Event handlers: `handleEventName` (e.g., `handleClick`)
- Message prefixes: `EksiEngel_` for cross-module messages

**Formatting:**
- Use 2 spaces for indentation
- Maximum line length: 120 characters
- Use semicolons
- Prefer async/await over raw promises
- Use template literals for string interpolation

**Error Handling:**
- Always use try/catch for async operations
- Log errors with `log.error()` before throwing
- Provide user-friendly Turkish error messages
- Always call `finishSuccess()` or `finishError*()` to complete queue tasks

**Types (JSDoc-style where helpful):**
```javascript
/**
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
async function getUserData(username) { ... }
```

### Python (Backend)

**Django Conventions:**
- Use Django's built-in test framework
- Test classes: `TestCase` suffix (e.g., `ActionModelTest`)
- Test methods: `test_<description>` prefix
- Use `self.assertEqual()`, `self.assertTrue()`, etc.

**Style:**
- Follow PEP 8
- Use 4 spaces for indentation
- Use f-strings for string formatting
- Use `from django.db import models`

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/app/assets/js/script.js` | Content script injected into Ekşi Sözlük |
| `frontend/app/assets/js/background.js` | Service worker, message orchestrator |
| `frontend/app/assets/js/programController.js` | Complex operation controller |
| `frontend/app/assets/js/notification.js` | Operations page UI |
| `frontend/app/assets/js/faq.js` | Settings page UI |
| `frontend/app/assets/js/enums.js` | Centralized constants |
| `frontend/app/assets/js/queue.js` | Task queue system |
| `frontend/app/assets/js/resumableOperation.js` | Pause/resume support |
| `frontend/app/manifest.json` | Extension configuration |

---

## Page Roles

| Page | File | Purpose |
|------|------|---------|
| **popup.html** | `popup.js` | Extension popup (quick access) |
| **notification.html** | `notification.js` | Main operations page |
| **faq.html** | `faq.js` | Settings page (toggles, date filter rules) |
| **authorListPage.html** | `authorListPage.js` | User list management |

---

## Important

- **popup.html** shares functionality with notification.html. Check both when modifying button functions.
- Date filter rules are configured in faq.html; master toggle is in notification.html
- Queue tasks must call `finishSuccess()` or `finishError*()` to complete properly
- All operations should support pause/resume via `resumableOperationRegistry`
- Use `log.info/warn/error()` for logging, never use `console.log` in production
- User-facing messages must be in Turkish
- Update context and documentation and commit the change **AFTER** me confirming to you that the change is working as intended.

---

## Date-Based User Filtering

**Key Components:**
- `enums.js` - `DateFilterCriteria`, `DateFilterAction`, `DateBulkAction`
- `config.js` - `enableDateFilter`, `dateFilterRules`
- `utils.js` - `applyDateFilters()`, `parseRegistrationDate()`
- `storageHandler.js` - Registration date caching (30-day TTL)

**Pipeline:**
- `background.js` - Date filter integration
- `programController.js` - `startDateBasedBulkAction()`
- UI: notification.html (master toggle + bulk form), faq.html (rules)

**Default:** Block accounts NEWER_THAN 3650 days (10 years)
