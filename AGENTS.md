# AGENTS.md

## Project Overview
Chrome extension for mass blocking on Ekşi Sözlük with Django backend for analytics.

## Structure
- `frontend/app/` - Chrome extension (Manifest V3): content scripts, background service worker, popup
- `backend/django_EksiEngel/` - Django REST API: `/api/`, `/client_data_collector/`, `/where_is_eksisozluk/`

## Commands
- **Backend**: `cd backend/django_EksiEngel && python manage.py runserver`
- **Load extension**: Load `frontend/app/` as unpacked in `chrome://extensions` (Developer mode)

## Code Style
- **JS**: ES6+ modules, async/await, Chrome Extension APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`)
- **Naming**: camelCase for functions/variables, descriptive names (e.g., `EksiEngel_sendMessage`)
- **Backend**: Django 4.1, Django REST Framework, PostgreSQL (`psycopg2`)
- **No external JS frameworks** - vanilla JavaScript for DOM manipulation

## Key Files
- `frontend/app/assets/js/script.js` - Content script injected into Ekşi Sözlük
- `frontend/app/assets/js/background.js` - Service worker orchestrating blocking actions
- `frontend/app/manifest.json` - Extension configuration
- notification.html is the main status and action buttons page.
- popup.html is the main extension config page that shares some functionalitiy with notification.html.

## Important
popup.html is shares some functionalitiy with notification.html. When changing a button function in one page, always first check if it also impacts the other.

## Date-Based User Filtering (New Feature)

### Overview
Implemented comprehensive date-based filtering system to filter users by account registration date before blocking operations.

### Key Components

**Core Infrastructure:**
- `enums.js` - Added `DateFilterCriteria` (NEWER_THAN, OLDER_THAN, BEFORE_DATE, AFTER_DATE) and `DateFilterAction` (BLOCK, SKIP, PROTECT)
- `config.js` - Added `enableDateFilter` and `dateFilterRules` configuration
- `utils.js` - Added `applyDateFilters()`, `parseRegistrationDate()`, `isDateInRange()` functions
- `scrapingHandler.js` - Added `scrapeRegistrationDate()` method

**Caching System:**
- `storageHandler.js` - 30-day TTL cache for registration dates with methods:
  - `saveRegistrationDate()`, `saveRegistrationDatesBatch()`
  - `getRegistrationDate()`, `getRegistrationDatesBatch()`
  - `cleanupRegistrationDateCache()`, `getRegistrationDateCacheStats()`

**Pipeline Integration:**
- `background.js` - Integrated date filtering into FAV, FOLLOW, and TITLE operations
- Added `fetchRegistrationDates()`, `applyDateFiltersToRelations()`, `logDateFilterResults()`

**UI Implementation:**
- `notification.html` - "Tarih Bazlı İşlemler" section with master toggle and bulk action form
- `faq.html` - "📅 Tarih Filtresi" section with rules list, add/edit form, and cache statistics
- `notification.js` - Master toggle handling and bulk action functions
- `faq.js` - Rule management and cache functions
- `customNotification.css` - Added styles for toggle switches, forms, rule lists

### Default Behavior
- **Date Filter Rule**: Block accounts newer than 10 years (3650 days) - applied during blocking operations (FAV, FOLLOW, TITLE)
- **Date Bulk Action**: Unmute accounts older than 10 years (3650 days) from muted users list - for bulk operations
- Feature is disabled by default (opt-in)
- Caching minimizes performance impact on repeated operations

### Files Modified
- `enums.js`, `config.js`, `scrapingHandler.js`, `utils.js`
- `storageHandler.js`, `background.js`, `notification.html`, `notification.js`, `faq.html`, `faq.js`, `customNotification.css`

### Usage
1. Open notification.html (Ana İşlemler page)
2. Find "📅 Tarih Bazlı İşlemler" section
3. Enable the toggle to enable date filtering
4. Configure filter rules in the Settings page (faq.html) - click "Ayarlar" link
5. Use "Tarih Bazlı Toplu İşlem" for bulk operations (default: unmute accounts > 10 years)
6. Rules are automatically applied to FAV, FOLLOW, and TITLE blocking operations

---

## Recent Updates

### Commit 1: Simplified Date Filter Actions
**Purpose:** Clarify and simplify the date filter action terminology

**Changes:**
- Date filter now only supports ENGELLE (Block) action
- Removed KORU (Protect) option - date filter is specifically for blocking users by date criteria
- Use date-based bulk actions for unblock/unmute operations instead

**Rationale:** The date filter is specifically designed to block users matching date criteria. For unblocking or unmuting users by date, use the "Tarih Bazlı Toplu İşlem" section.

**Files Modified:**
- `enums.js`, `config.js`, `utils.js`, `notification.html`, `notification.js`, `background.js`

### Commit 2: Date-Based Bulk Actions
**Purpose:** Enable direct bulk operations on users filtered by registration date

**New Feature: "Tarih Bazlı Toplu İşlem" (Date-Based Bulk Action)**

**Capabilities:**
- **Source Options:**
  - Blocked users list
  - Muted users list  
  - Author list (from authorListPage)
  
- **Date Criteria:**
  - NEWER_THAN: Account age less than X (newer accounts)
  - OLDER_THAN: Account age greater than X (older accounts)
  - BEFORE_DATE: Registered before specific date
  - AFTER_DATE: Registered after specific date
  
- **Actions:**
  - ENGELLE (Block)
  - SESSIZE_AL (Mute)
  - ENGEL_KALDIR (Unblock)
  - SESSIZDEN_CIKAR (Unmute)
  - TAKIP_ET (Follow)

**UI Components:**
- New section in "Tarih Filtresi" tab
- Source selection dropdown
- Date criteria selector with dynamic input (days/months/years or date picker)
- Action selection dropdown
- Start button to execute the bulk operation
- Preferences persistence (last used settings saved)

**Implementation:**
- `startDateBasedBulkAction()` in programController.js
- Fetches registration dates from cache or scrapes them
- Filters users by date criteria
- Performs selected action on all matching users
- Progress tracking with early stop support

**Files Modified:**
- `enums.js` - Added DateBulkAction, DateBulkSource, BanSource.DATE_BASED_BULK
- `notification.html` - Added bulk action UI section
- `customNotification.css` - Added styles for bulk action components
- `notification.js` - Added UI handlers for bulk action form
- `background.js` - Added message handler for startDateBasedBulkAction
- `programController.js` - Added startDateBasedBulkAction() implementation

**Technical Notes:**
- Leverages existing registration date caching system
- Uses existing relationHandler for performing actions
- Follows same patterns as other bulk operations (migrateBlockedToMuted, etc.)
- Early stop functionality works same as other operations

### Commit 3: Pause Button Stuck Fix
**Purpose:** Fix the pause button getting stuck with "İşlem duraklatılıyor..." message when trying to pause operations that don't support checkpoint-based pausing

**Root Cause:**
The `getCurrentOperation()` method in `programController.js` was returning resumable operations directly without the `canPause` property. The notification.js code checks `if (currentOp.canPause === false)` to determine if pausing is supported, but since the property was `undefined`, the check failed (`undefined !== false`), causing the pause button to proceed with pausing an operation that doesn't actually support checkpoint-based pausing.

**Bug Flow:**
1. User clicks pause button during DATE_BASED_BULK operation
2. `getCurrentOperation()` returns resumable operation WITHOUT `canPause` property
3. Check `currentOp.canPause === false` fails because `undefined !== false`
4. Pause proceeds to `pauseCurrentOperation()` which calls `requestPause()`
5. UI shows "Duraklatılıyor..." but operation never reaches checkpoint
6. Button gets stuck in pausing state

**Fix Applied:**
Modified `getCurrentOperation()` in `programController.js` to:
- Check if the resumable operation type is one of the non-pausable operations: `['DATE_BASED_BULK', 'MIGRATE_BLOCKED_TO_MUTED', 'BLOCK_MUTED_USERS', 'BLOCK_TITLES']`
- Return the operation with `canPause: false` and appropriate warning message for non-pausable operations
- Return the operation with `canPause: true` for operations that do support pausing

**Files Modified:**
- `programController.js` - Updated `getCurrentOperation()` method to add `canPause` property to resumable operations

**Result:**
The UI now properly detects when an operation doesn't support pausing and shows the warning message: "Bu işlem türü duraklatmayı desteklemiyor. Erken durdurmayı kullanın." (This operation type doesn't support pausing. Use early stop instead.) instead of getting stuck with "İşlem duraklatılıyor..."

### Commit 4: Pause/Resume Functionality Fixes (2026-02-13)
**Purpose:** Fix the pause/resume functionality for date-based bulk actions

**Issues Fixed:**
1. **Message Format Mismatch** - `resumableOperation.js` sent messages in a format that `buttonStateManager.js` couldn't parse, causing `undefined` state values
2. **Finally Blocks Completing Paused Operations** - The `finally` blocks unconditionally called `completeOperation()` even when the operation was paused, causing immediate transition from PAUSED to COMPLETED

**Root Cause Analysis:**
The debug log showed:
```
INF [resumableOp] Operation paused at checkpoint FETCH_USERS
INF [resumableOp] Operation completed (wasPaused: true)  ← Should NOT happen!
ButtonStateManager: Operation state changed from undefined to undefined
```

**Fixes Applied:**

1. **resumableOperation.js** - Updated `_notifyUIStateChanged()` to send proper message format:
   - Now sends both `newState`/`operationData` (for buttonStateManager) and `operation` (for backward compatibility)
   - Maps operation states to UI states (RUNNING → ACTIVE, PAUSED → PAUSED, etc.)

2. **buttonStateManager.js** - Updated `setupMessageListeners()` to handle both new and legacy message formats

3. **programController.js** - Fixed `finally` blocks in four operations to check if operation is paused before completing:
   ```javascript
   const currentOp = resumableOperationRegistry.getCurrentOperation();
   if (!currentOp || currentOp.state !== OperationState.PAUSED) {
     resumableOperationRegistry.completeOperation();
   }
   ```

4. **notification.js** - Added `showPausedOperationBanner()` for auto-resume UI on page load

5. **customNotification.css** - Added styles for paused operation banner

**Operations Fixed:**
- `startDateBasedBulkAction()` - Date-based bulk actions
- `migrateBlockedToMuted()` - Migration from blocked to muted
- `blockMutedUsers()` - Blocking muted users
- `blockTitlesOfBlockedMuted()` - Blocking titles

**Files Modified:**
- `resumableOperation.js`, `buttonStateManager.js`, `programController.js`, `notification.js`, `customNotification.css`

**Result:**
- Pause button activates during operations
- After pause, resume button becomes clickable
- Operation state properly transitions to PAUSED and stays there
- Resume continues from checkpoint
- Page reload shows banner for one-click resume

### Commit 5: Bug Fixes and Code Cleanup
**Purpose:** Fix bugs and remove obsolete code

**Bug Fixes:**
- `log.js`: Removed redundant assignment in resetData()
- `storageHandler.js`: Added missing getActiveOperation() method
- `notification.js`: Fixed duplicate cleanupPauseOperation() declaration

**Dead Code Removal:**
- `background.js`: Removed unused getEstimatedUserCount()
- `queue.js`: Removed unused estimateDuration()
- `enums.js`: Removed unused TaskMetadata export
- `programController.js`: Removed unreachable legacy operation checks

**Files Modified:**
- `log.js`, `storageHandler.js`, `notification.js`, `background.js`, `queue.js`, `enums.js`, `programController.js`, `utils.js`, `commHandler.js`

### Commit 6: Turkish Error Messages
**Purpose:** Translate user-facing error messages to Turkish

**Changes:**
- All user-facing error messages now display in Turkish for consistency with the rest of the UI

**Files Modified:**
- Multiple files containing user-facing error messages

### Commit 7: Early Stop State Fix
**Purpose:** Fix status message and button states after early stop

**Changes:**
- Update statusText in FINISH handler to show 'İşlem kullanıcı tarafından durduruldu.' when early stop completes
- Reset all control buttons (pause, resume, early stop) to disabled state after operation finishes
- Previously early stop button was incorrectly enabled after operation finished

**Files Modified:**
- `notification.js`

### Commit 8: Remove Preview Button
**Purpose:** Remove unused Önizleme (Preview) button from date-based bulk operations

**Changes:**
- Removed preview button and preview div from notification.html
- Removed handleBulkPreview() and updateBulkPreviewVisibility() functions from notification.js
- Removed preview-related CSS styles from customNotification.css
- Total: 102 lines removed

**Files Modified:**
- `notification.html`, `notification.js`, `customNotification.css`

### Commit 9: Move Storage Management to FAQ Page
**Purpose:** Consolidate settings and data management UI in a single location (faq.html)

**Changes:**
- Moved "Veri Yönetimi ve Depolama" section from notification.html to faq.html
- Storage usage display now shows in faq.html under a new "Veri Yönetimi ve Depolama" heading
- "Saklanan Verileri Temizle" button moved to faq.html
- Removed redundant `updateStorageUsageDisplay()` and `handleClearStoredData()` from notification.js
- Added these functions to faq.js with storageHandler import
- Removed clearStoredData button tracking from buttonStateManager.js (no longer needed in notification.html context)

**Rationale:**
- faq.html already contains the main "Ayarlar" (Settings) section with configuration switches
- Consolidating storage management with other settings provides better UX
- notification.html focuses on operation status and bulk actions

**Files Modified:**
- `faq.html` - Added storage management section
- `faq.js` - Added storageHandler import, updateStorageUsageDisplay(), handleClearStoredData()
- `notification.html` - Removed Settings section
- `notification.js` - Removed storage-related functions
- `buttonStateManager.js` - Removed clearStoredData button tracking

### Commit 10: UI/UX Refactoring (2026-02-14)
**Purpose:** Improve user experience with reorganized layout and intuitive controls

**Major Changes:**

1. **Single Page Layout**
   - Removed tab navigation - all content on single page
   - Flattened structure for better accessibility

2. **Section Reorganization**
   - New order: Status → Listeler → Engelleme → Tarih İşlemleri → Ek İşlemler → Tüm Engelleri Kaldır → İşlem Geçmişi
   - Renamed "Taşıma İşlemleri (Beta)" to "Ek İşlemler"
   - Renamed "İşlem Kuyruğu" to "İşlem Geçmişi"

3. **Combined Date Operations**
   - Merged "Tarih Filtresi" tab into main page
   - Toggle expands/collapses date filter content
   - Clear descriptions for filter rules vs bulk actions
   - Removed single-option "Eylem" dropdown (hardcoded to ENGELLE)

4. **New Feature: Tüm Sessizleri Kaldır**
   - Added button to unmute all muted users
   - Paired with "Tüm Engelleri Kaldır" in new section

5. **Dark Mode Support**
   - Manual toggle in faq.html (Görünüm section)
   - CSS variables for theme switching
   - Persists across all pages via localStorage

6. **Updated Defaults**
   - Date Filter: Block accounts NEWER_THAN 3650 days (10 years)
   - Date Bulk: Unmute accounts OLDER_THAN 3650 days from muted list

7. **Collapsible Queue Section**
   - İşlem Geçmişi now collapsible with saved state
   - Reduces visual clutter when not needed

**Files Modified:**
- `notification.html`, `notification.js`, `customNotification.css`
- `faq.html`, `faq.js`
- `background.js`, `programController.js`, `enums.js`, `config.js`

**UI Improvements:**
- Bullet-point descriptions for date operations
- Help text under sub-sections
- Consistent spacing and visual hierarchy
- Better button grouping by function type

### Commit 11: UI Compacting (2026-02-15)
**Purpose:** Make the notification.html interface more compact while preserving all functionality

**Changes:**

1. **Status Card - Ultra Compact**
   - Stats converted to inline badges (⚡0 ✅0 ⏱️0) on single row
   - Yazar Listesi button merged into control buttons row
   - Progress bar reduced to 16px height
   - Control buttons use icon-only style (⏸️ ▶️ 🛑)

2. **Listeler Section**
   - Titles shortened ("Sessiz Kullanıcılar" → "Sessiz")
   - Buttons reduced to letters (Y=Yenile, C=CSV)
   - Count badge shows "..." instead of "Yükleniyor..."

3. **Tarih İşlemleri Section**
   - Title shortened from "Tarih Bazlı İşlemleri"
   - Description inline with bullet separators
   - Forms use 2-column compact grid layout
   - Cache stats inline format
   - Days input box increased to 85px for 4-digit numbers

4. **İşlemler Section (Merged)**
   - Combined "Ek İşlemler" + "Tüm Engelleri Kaldır" into single section
   - 3-column button grid with abbreviated text
   - Buttons: "Engelli → Sessiz", "Sessiz → Engelli", etc.

5. **Queue/İşlem Geçmişi**
   - Default collapsed state
   - Table headers reduced to emoji-only
   - Max-height reduced to 150px

6. **Global Changes**
   - Font sizes restored to original readable values (12px base)
   - Vertical spacing increased 20% proportionally
   - Help button restored to original size
   - CSS reduced from 2094 to ~1050 lines

**Files Modified:**
- `notification.html` - 443 → 334 lines
- `customNotification.css` - 2094 → ~1050 lines
- `notification.js` - Minor change for collapsible default

**Result:**
- All content visible without scrolling on typical screens
- Date operations expanded state fits properly
- All functionality preserved
- Cleaner, more professional appearance

### Commit 12: Move Date Filter Rules & Cache to Settings Page (2026-02-15)
**Purpose:** Improve GUI organization by moving date filter configuration to the settings page

**Changes:**

1. **Moved from notification.html to faq.html:**
   - "🎯 Filtre Kuralları" section (rules list + add/edit form)
   - "💾 Önbellek" section (cache stats + clear button)

2. **Kept in notification.html:**
   - Master enable/disable toggle (in notification.html) for date filter
   - "🚀 Toplu İşlem" bulk action form (unchanged)
   - All other sections unchanged

3. **faq.html Redesign:**
   - Imported customNotification.css for consistent styling
   - Added "📅 Tarih Filtresi" section between "Ayarlar" and "Görünüm"
   - Card-based layout matching notification.html style
   - Dark mode support preserved

4. **JavaScript Refactoring:**
   - Removed ~430 lines of rule/cache functions from notification.js
   - Added all rule/cache functions to faq.js
   - notification.js retains: master toggle handling, bulk action functions
   - Added link from notification.html to faq.html for rules configuration

**New Structure:**
```
notification.html (Operations Page):
├── 📊 İşlem Durumu
├── 📊 Listeler
├── 📅 Tarih Bazlı İşlemler
│   ├── Master toggle (enable/disable)
│   └── 🚀 Toplu İşlem (bulk actions)
├── ⚡ İşlemler
└── 📋 İşlem Geçmişi

faq.html (Settings Page):
├── Ayarlar (existing toggles)
├── 📅 Tarih Filtresi ← NEW SECTION
│   ├── 🎯 Filtre Kuralları ← MOVED
│   └── 💾 Önbellek ← MOVED
├── Görünüm (dark mode)
├── Veri Yönetimi
└── Kullanım Kılavuzu
```

**Files Modified:**
- `faq.html` - Added date filter rules + cache sections, imported customNotification.css
- `faq.js` - Added rule management and cache functions
- `notification.html` - Removed rules and cache sections, added link to settings
- `notification.js` - Removed rule/cache functions, simplified to master toggle only

**Rationale:**
- Configuration options belong in settings page (faq.html)
- Operation-focused UI stays in notification.html
- Separates concerns: configure rules in settings, execute operations in main page
- Cleaner, more intuitive GUI organization
