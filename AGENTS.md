# AGENTS.md

## Project Overview
Chrome extension for mass blocking on Ekşi Sözlük with Django backend for analytics.

## Repository Structure

```
EksiEngel/
├── frontend/app/                    # Chrome Extension (Manifest V3)
│   ├── manifest.json               # Extension configuration
│   └── assets/
│       ├── js/                     # JavaScript modules
│       │   ├── programController.js    # 2129 lines - Operation controller
│       │   ├── notification.js         # 1655 lines - Operations page UI
│       │   ├── background.js           # 1109 lines - Service worker
│       │   ├── scrapingHandler.js      # 1077 lines - Web scraping
│       │   ├── storageHandler.js       #  907 lines - Storage management
│       │   ├── script.js               #  776 lines - Content script
│       │   ├── faq.js                  #  565 lines - Settings page UI
│       │   ├── resumableOperation.js   #  448 lines - Pause/resume
│       │   ├── notificationHandler.js  #  384 lines - Status updates
│       │   ├── buttonStateManager.js   #  355 lines - Button states
│       │   ├── queue.js                #  244 lines - Task queue
│       │   ├── utils.js                #  230 lines - Utilities
│       │   ├── relationHandler.js      #  191 lines - API communication
│       │   ├── commHandler.js          #  144 lines - Backend API
│       │   ├── enums.js                #   88 lines - Constants
│       │   ├── urlHandler.js           #   78 lines - URL validation
│       │   ├── config.js               #   74 lines - Configuration
│       │   ├── authorListPage.js       #   42 lines - Author list
│       │   ├── log.js                  #   37 lines - Logging
│       │   ├── popup.js                #   25 lines - Popup UI
│       │   └── welcome.js              #   11 lines - Welcome page
│       ├── html/                   # HTML pages
│       │   ├── faq.html                # 431 lines - Settings page
│       │   ├── notification.html       # 287 lines - Operations page
│       │   ├── documentation.html      # 145 lines - Documentation
│       │   ├── welcome.html            #  79 lines - Onboarding
│       │   ├── authorListPage.html     #  56 lines - Author list
│       │   └── popup.html              #  23 lines - Extension popup
│       ├── css/                    # Stylesheets
│       │   ├── customNotification.css  # 1123 lines - Main styles
│       │   ├── switchButtons.css       #  521 lines - Toggle switches
│       │   ├── buttons.css             #   87 lines - Buttons
│       │   ├── tooltip.css             #   84 lines - Tooltips
│       │   ├── customPopup.css         #   57 lines - Popup styles
│       │   └── footer.css              #   16 lines - Footer
│       └── img/                    # Images and icons
├── backend/django_EksiEngel/        # Django REST API
│   ├── api/                        # Action analytics
│   ├── client_data_collector/      # Client analytics
│   └── where_is_eksisozluk/        # URL monitoring
├── docs/                           # Documentation website
├── context_portal/                 # Development database
├── AGENTS.md                       # This file
└── PROJECT_OVERVIEW.md             # Detailed architecture
```

## Commands
- **Backend**: `cd backend/django_EksiEngel && python manage.py runserver`
- **Load extension**: Load `frontend/app/` as unpacked in `chrome://extensions` (Developer mode)

## Code Style
- **JS**: ES6+ modules, async/await, Chrome Extension APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`)
- **Naming**: camelCase for functions/variables, descriptive names (e.g., `EksiEngel_sendMessage`)
- **Backend**: Django 4.1, Django REST Framework, PostgreSQL (`psycopg2`)
- **No external JS frameworks** - vanilla JavaScript for DOM manipulation

## Key Files
| File | Purpose |
|------|---------|
| `frontend/app/assets/js/script.js` | Content script injected into Ekşi Sözlük |
| `frontend/app/assets/js/background.js` | Service worker orchestrating blocking actions |
| `frontend/app/assets/js/programController.js` | Complex operation controller (migrations, bulk actions) |
| `frontend/app/assets/js/notification.js` | Operations page UI controller |
| `frontend/app/assets/js/faq.js` | Settings page UI controller |
| `frontend/app/manifest.json` | Extension configuration |

## Page Roles
| Page | File | Purpose |
|------|------|---------|
| **popup.html** | `assets/html/popup.html` + `assets/js/popup.js` | Extension popup (quick access) |
| **notification.html** | `assets/html/notification.html` + `assets/js/notification.js` | Main operations page (status, actions, lists) |
| **faq.html** | `assets/html/faq.html` + `assets/js/faq.js` | Settings page (toggles, date filter rules, storage) |
| **authorListPage.html** | `assets/html/authorListPage.html` + `assets/js/authorListPage.js` | User list management |

## Important
- popup.html shares some functionality with notification.html. When changing a button function in one page, always first check if it also impacts the other.
- Date filter configuration (rules, cache) is in faq.html (Settings page)
- Date filter master toggle and bulk actions are in notification.html (Operations page)

## Date-Based User Filtering

### Overview
Comprehensive date-based filtering system to filter users by account registration date before blocking operations.

### Key Components

**Core Infrastructure:**
- `enums.js` - `DateFilterCriteria` (NEWER_THAN, OLDER_THAN, BEFORE_DATE, AFTER_DATE) and `DateFilterAction` (ENGELLE)
- `config.js` - `enableDateFilter` and `dateFilterRules` configuration
- `utils.js` - `applyDateFilters()`, `parseRegistrationDate()`, `isDateInRange()` functions
- `scrapingHandler.js` - `scrapeRegistrationDate()` method

**Caching System (storageHandler.js):**
- 30-day TTL cache for registration dates
- Methods: `saveRegistrationDate()`, `getRegistrationDate()`, `getRegistrationDatesBatch()`, `cleanupRegistrationDateCache()`, `getRegistrationDateCacheStats()`

**Pipeline Integration:**
- `background.js` - Integrated into FAV, FOLLOW, and TITLE operations
- `programController.js` - `startDateBasedBulkAction()` for bulk operations

**UI:**
- `notification.html` - Master toggle + bulk action form
- `faq.html` - Rules list, add/edit form, cache statistics
- `customNotification.css` - Toggle switches, forms, rule lists

### Default Behavior
- **Date Filter Rule**: Block accounts NEWER_THAN 10 years (3650 days)
- **Date Bulk Action**: Unmute accounts OLDER_THAN 10 years from muted list
- Feature disabled by default (opt-in)

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
├── ⚡ İşlemler
├── 📅 Tarih Bazlı İşlemler
│   ├── Master toggle (enable/disable)
│   └── 🚀 Toplu İşlem (bulk actions)
├── 📊 Listeler
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

### Commit 13: Reorder UI Sections (2026-02-15)
**Purpose:** Improve UI flow by reorganizing sections in notification.html

**Changes:**
- Reordered sections to prioritize frequently-used actions
- New order: İşlem Durumu → İşlemler → Tarih Bazlı İşlemler → Listeler → İşlem Geçmişi

**Rationale:**
- İşlemler (Actions) moved up for quick access to common bulk operations
- Tarih Bazlı İşlemler placed after İşlemler as it's also action-focused
- Listeler (Lists) moved down as it's primarily for viewing/exporting data
- İşlem Geçmişi (History) remains at bottom as reference information

**Files Modified:**
- `notification.html` - Reordered section elements
- `AGENTS.md` - Updated documentation

**Updated Structure:**
```
notification.html (Operations Page):
├── 📊 İşlem Durumu
├── ⚡ İşlemler
├── 📅 Tarih Bazlı İşlemler
│   ├── Master toggle (enable/disable)
│   └── 🚀 Toplu İşlem (bulk actions)
├── 📊 Listeler
└── 📋 İşlem Geçmişi
```

### Commit 14: Status Message Row Layout (2026-02-15)
**Purpose:** Improve UI clarity by moving progress bar status message to a separate row under the title

**Changes:**
- Moved status indicator ("Beklemede.", etc.) from card-header to a new dedicated row
- Status message now appears centered below "İşlem Durumu" title
- Added new `.status-indicator-row` CSS class with subtle background
- Card header now only contains the section title

**Rationale:**
- Separates section title from status message for better visual hierarchy
- Status message gets more prominence in its own row
- Cleaner, more readable layout

**Files Modified:**
- `notification.html` - Restructured status card header
- `customNotification.css` - Added status-indicator-row styling

### Commit 15: Update Default Settings Selections (2026-02-15)
**Purpose:** Update default values for Ayarlar settings to more sensible defaults

**Changes:**

| Setting | Old Default | New Default |
|---------|-------------|-------------|
| Engelle veya sessize al | Engel | **Sessiz** |
| Başlıklarını da engelle | Açık | **Kapalı** |
| Çaylak yazarları da engelle | Kapalı | **Açık** |
| Takip ettiğim yazarları engelleme | Kapalı | **Açık** |
| Sadece gerekli işlemleri yap | Kapalı | Kapalı (unchanged) |
| Yeşil ve sarı tikleri gizle | Kapalı | Kapalı (unchanged) |
| Toplanan verileri gönder | Açık | Açık (unchanged) |

**Config Values Changed:**
- `enableMute`: false → true
- `enableTitleBan`: true → false
- `enableNoobBan`: false → true
- `enableProtectFollowedUsers`: false → true

**Files Modified:**
- `config.js` - Updated default values
- `faq.html` - Updated radio button checked attributes

**Rationale:**
- Sessiz (mute) is less aggressive than blocking
- Title banning disabled by default to avoid over-blocking
- Protecting followed users prevents accidental blocking of known authors
- Blocking çaylak (novice) users enabled by default

### Commit 16: Move Depolama Kullanımı Section (2026-02-15)
**Purpose:** Improve organization by grouping storage-related sections together

**Changes:**
- Moved "Depolama Kullanımı" section from after "Görünüm" to directly below "Önbellek"
- Converted to card-based styling matching Önbellek section
- Removed standalone "Veri Yönetimi ve Depolama" header
- Button and span IDs preserved for JS functionality

**New Section Order in Tarih Filtresi:**
```
📅 Tarih Filtresi
├── 🎯 Filtre Kuralları
├── 💾 Önbellek
└── 💾 Depolama Kullanımı  ← MOVED HERE
```

**Files Modified:**
- `faq.html` - Restructured storage section placement and styling

**Rationale:**
- Storage sections logically grouped with date filter cache
- Both deal with data persistence and clearing
- Cleaner, more organized UI

### Commit 17: Unify Section Styles (2026-02-15)
**Purpose:** Create consistent visual hierarchy with card-based layout

**Changes:**

1. **Ayarlar Section**
   - Wrapped in `.card` with `.card-header` and `.card-body`
   - Header: ⚙️ Ayarlar

2. **Tarih Filtresi Section**
   - Wrapped in `.card` with `.card-header` and `.card-body`
   - Sub-sections (Filtre Kuralları, Önbellek, Depolama) merged inside
   - Header: 📅 Tarih Filtresi

3. **Görünüm Section**
   - Wrapped in `.card` with `.card-header` and `.card-body`
   - Header: 🎨 Görünüm

4. **Kullanım Kılavuzu**
   - Unchanged (documentation content, different from settings)

**Files Modified:**
- `faq.html` - Restructured all sections with card layout

**Result:**
```
faq.html (Settings Page):
├── ⚙️ Ayarlar (card with switches)
├── 📅 Tarih Filtresi (card with sub-sections)
│   ├── 🎯 Filtre Kuralları
│   ├── 💾 Önbellek
│   └── 💾 Depolama Kullanımı
├── 🎨 Görünüm (card with theme toggle)
└── Kullanım Kılavuzu (documentation)
```

**Benefits:**
- Consistent visual hierarchy across all sections
- Better separation of settings vs documentation
- Dark mode support preserved for all cards

### Commit 18: Fix Queue Item Stuck in "Sıradaki İşlemler" (2026-02-15)
**Purpose:** Fix the top item in "⏳ Sıradaki İşlemler" table staying stuck until page refresh after task completion

**Root Cause:**
When a task finished, the `notificationHandler.finishSuccess()` and other finish methods sent a FINISH notification with `plannedProcesses: []` (empty array). In `notification.js`, the FINISH handler added the completed item to the "✅ Tamamlanan İşlemler" table, but the planned processes table update only ran if:
- `status === UPDATE_PLANNED_PROCESSES` (not true for FINISH)
- OR `plannedProcesses.length > 0` (false because it was empty)

Result: The completed item remained visible in "⏳ Sıradaki İşlemler" until page refresh.

**Fix Applied:**
In `notification.js`, when a FINISH notification with `completedProcess` is received:
1. Remove the first row from the planned processes table
2. Update the count badges

**Scenarios Handled:**
All task completion scenarios are now handled:
- ✅ Successful completion (`finishSuccess`)
- 🛑 User interrupted (`finishErrorEarlyStop`)
- ❌ Access error (`finishErrorAccess`)
- ❌ Login error (`finishErrorLogin`)
- ❌ Empty list error (`finishErrorNoAccount`)

**Files Modified:**
- `notification.js` - Added row removal and count update in FINISH handler

**Code Change:**
```javascript
// Remove completed item from planned processes table
const plannedTableBody = document.getElementById("plannedProcesses").getElementsByTagName('tbody')[0];
if (plannedTableBody && plannedTableBody.rows.length > 0) {
   plannedTableBody.deleteRow(0);
}
notificationHandler.updateTableCounts();
```
