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
- **Date Filter Rule**: Default rule pre-populated - Block accounts NEWER_THAN 10 years (3650 days)
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

### Commit 19: Default Date Filter Rule (2026-02-15)
**Purpose:** Ensure users have a default date filter rule pre-populated on first use

**Changes:**
- Modified `handleConfig()` in config.js to apply default date filter rules if empty or missing
- Default rule: Block accounts NEWER_THAN 3650 days (10 years)
- Applies to both new installations and existing users with empty rules

**Technical Details:**
- When config is loaded from storage, checks if `dateFilterRules` is empty or undefined
- If so, calls `createDefaultDateFilterRules()` and saves the updated config
- This ensures the default rule is always present unless user explicitly removes it

**Files Modified:**
- `config.js` - Updated `handleConfig()` to apply default rules

**Rationale:**
- Provides sensible defaults for new users
- Date filter feature is more discoverable with a pre-populated rule
- Users can still delete or modify the default rule

### Commit 20: Pause/Resume Support for List Refresh Operations (2026-02-15)
**Purpose:** Add pause, resume, and stop functionality to Listeler (Lists) bulk actions

**Changes:**

1. **programController.js - New Methods**
   - Added `refreshMutedList()` - Refreshes muted users list with registry registration
   - Added `refreshBlockedList()` - Refreshes blocked users list with registry registration
   - Both methods register with `resumableOperationRegistry` for checkpoint-based pause/resume
   - Use `pauseCheckCallback` to check for pause/stop requests during scraping
   - Handle paused state properly in finally block (don't complete if paused)

2. **programController.js - Resume Handlers**
   - Added `_resumeRefreshMutedList()` - Resume handler for muted list refresh
   - Added `_resumeRefreshBlockedList()` - Resume handler for blocked list refresh
   - Updated `resumeOperation()` switch case to dispatch to these handlers

3. **programController.js - Simplified getCurrentOperation()**
   - Removed legacy operation checks since all operations now use registry
   - All registered operations return `canPause: true`

4. **background.js - Updated Handlers**
   - Replaced inline handlers for `refreshMutedList` with call to `programController.refreshMutedList()`
   - Replaced inline handlers for `refreshBlockedList` with call to `programController.refreshBlockedList()`
   - Handlers now delegate to programController instead of implementing logic inline

**Operations Now Supporting Pause/Resume:**
| Operation | Checkpoints |
|-----------|-------------|
| `REFRESH_MUTED_LIST` | FETCH_PAGES |
| `REFRESH_BLOCKED_LIST` | FETCH_PAGES |
| `DATE_BASED_BULK` | FETCH_USERS, FETCH_DATES, FILTER_USERS, PERFORM_ACTIONS |
| `MIGRATE_BLOCKED_TO_MUTED` | FETCH_USERS, PROCESS_USERS |
| `BLOCK_MUTED_USERS` | FETCH_PAGES, PROCESS_USERS |
| `BLOCK_TITLES` | FETCH_USERS, PROCESS_USERS |

**Files Modified:**
- `programController.js` - Added refreshMutedList(), refreshBlockedList(), resume handlers
- `background.js` - Updated refreshMutedList and refreshBlockedList handlers

**Result:**
- Pause button now works during list refresh operations
- Resume continues from where the operation was paused
- Stop (early stop) terminates the operation immediately
- Consistent pause/resume behavior across all bulk operations

### Commit 21: Fix Pause/Resume for Bulk Actions (2026-02-15)
**Purpose:** Fix pause button not working on regular bulk actions (İşlemler section)

**Root Cause:**
1. Pause checks only happened every 10 users - too infrequent
2. Scraping functions were called without `pauseCheckCallback` - pause didn't work during user fetching phase
3. Page fetching loop in `blockMutedUsers()` didn't check for pause

**Changes:**

1. **migrateBlockedToMuted()**
   - Added `pauseCheckCallback` to `scrapeAllBlockedUsers()` call
   - Changed checkpoint frequency from every 10 users to every user
   - Added pause handling during blocked users fetch

2. **blockMutedUsers()**
   - Added pause check before each page fetch in the while loop
   - Changed checkpoint frequency from every 10 users to every user

3. **blockTitlesOfBlockedMuted()**
   - Added `pauseCheckCallback` to `scrapeAllBlockedUsers()` call
   - Changed checkpoint frequency from every 10 users to every user
   - Already had pause handling during blocked users fetch

4. **refreshMutedList() and refreshBlockedList()**
   - Fixed resume to pass checkpoint data so counter continues from paused position
   - Added `savedState` parameter to accept resume state
   - Converted checkpoint data to `initialState` for scraping functions

**Files Modified:**
- `programController.js` - Updated all bulk action methods with proper pause support

**Result:**
- Pause button now works immediately during all bulk actions
- Resume continues from exact position where it was paused
- Consistent pause/resume behavior across all operations

### Commit 22: Fix Pause Status Display and Resume Counter (2026-02-15)
**Purpose:** Fix status message being lost after pause and counter resetting to zero on resume

**Root Cause:**
1. Operation stats (progress count) were not passed to UI when paused
2. Progress callback was not called immediately on resume to show initial state
3. Field name mismatch: checkpoint data used `userCount` but UI checked for `totalCount`

**Changes:**

1. **programController.js - refreshMutedList()**
   - Added immediate progress update when resuming with `initialState.totalCount`
   - UI now shows correct count immediately after clicking resume

2. **programController.js - refreshBlockedList()**
   - Same fix for immediate progress update on resume

3. **resumableOperation.js - _notifyUIStateChanged()**
   - Added `stats` field to message including `op.stats` or `op.checkpointData`
   - UI can now display progress count when paused

4. **notification.js - updateUniversalControls()**
   - Added `stats` parameter to function signature
   - PAUSED state now shows progress count: `(Duraklatıldı - 150 kullanıcı)`
   - Checks both `totalCount` and `userCount` for compatibility

5. **notification.js - PAUSED state handler**
   - Passes `message.stats` or `op.checkpointData` to `updateUniversalControls()`

**Files Modified:**
- `programController.js`, `resumableOperation.js`, `notification.js`

**Result:**
- Status shows "Duraklatıldı - X kullanıcı" when paused
- Resume counter continues from where it was paused, not from zero
- Consistent progress display across all pause/resume operations

### Commit 23: Fix Stop Button Stuck When Paused (2026-02-15)
**Purpose:** Fix the stop button getting stuck when trying to stop a paused operation

**Root Cause:**
When stopping a paused operation:
1. `requestStop()` called `unregisterOperation()` which sent `operationStateChanged` with `null` operation
2. This caused `updateUniversalControls(null)` which disabled all buttons improperly
3. The UI got into a stuck state with no way to recover

**Changes:**

1. **resumableOperation.js - requestStop()**
   - When operation is PAUSED, now sets state to STOPPED first
   - Notifies UI of STOPPED state before unregistering
   - Unregisters operation without sending another null notification
   - UI sees proper STOPPED state instead of null

2. **notification.js - updateUniversalControls()**
   - Added STOPPED state case
   - All buttons properly disabled in STOPPED state
   - Shows "(Durduruldu)" status text
   - No more null operation state reaching UI

**Files Modified:**
- `resumableOperation.js`, `notification.js`

**Result:**
- Stop button works correctly when operation is paused
- UI shows proper "(Durduruldu)" status
- All buttons properly disabled after stop
- No stuck button states

### Commit 24: Fix Early Stop UI Not Updating (2026-02-15)
**Purpose:** Fix the stop button stuck on "Durduruluyor..." when stopping a paused operation

**Root Cause:**
The `handleEarlyStop()` function showed "Durduruluyor..." and relied on a 3-second timeout, but didn't listen for the `operationStateChanged` message that comes when the operation is actually stopped. The UI only updated after timeout or page refresh.

**Changes:**

1. **notification.js - handleEarlyStop()**
   - Added message listener before sending stop request
   - Listens for STOPPED state and updates UI immediately
   - Cleans up listener and timeout properly on success or error
   - Changed timeout from 3 seconds to 5 seconds as fallback
   - On timeout, re-syncs with background script for actual state
   - Properly removes listener in error handler

**Files Modified:**
- `notification.js`

**Result:**
- Stop button updates immediately when operation stops
- Shows "(Durduruldu)" status without page refresh
- Fallback timeout handles edge cases
- Consistent UI behavior for all stop scenarios

### Commit 25: Fix Stop Status Overwrite Bug (2026-02-15)
**Purpose:** Fix the stop status being overwritten after STOPPED message was already received

**Root Cause:**
When stopping a paused operation:
1. Message listener is added for STOPPED state
2. `sendEarlyStopWithRetry()` is called
3. During that call, background sends `operationStateChanged` with STOPPED state
4. Listener receives it and updates UI to STOPPED
5. But then `handleEarlyStop()` continues and sets `statusText.innerHTML = "Durduruluyor..."` which OVERWRITES the STOPPED status!

**Changes:**

1. **notification.js - handleEarlyStop()**
   - Added `stopHandled` flag to track if stop was already handled by message listener
   - Set `stopHandled = true` when STOPPED message is received
   - Wrapped status text updates in `if (!stopHandled)` check
   - Prevents overwriting status when STOPPED was already processed

**Files Modified:**
- `notification.js`

**Result:**
- Stop status shows correctly immediately after stopping
- No more "Durduruluyor..." overwriting the stopped state
- UI updates properly for both paused and running operations

### Commit 26: Fix Empty List Operations Stuck in Queue (2026-02-15)
**Purpose:** Fix tasks staying stuck in "⏳ Sıradaki İşlemler" when they find zero users to process

**Root Cause:**
When operations found no users to process, they called `notificationHandler.notify()` and returned early without calling `notificationHandler.finishSuccess()`. This meant:
1. No FINISH notification was sent to the UI
2. The task was not added to "✅ Tamamlanan İşlemler"
3. The task remained visible in "⏳ Sıradaki İşlemler" until page refresh

**Changes:**

All early return cases now properly call `finishSuccess()` with 0 results:

| Function | Condition | Fix |
|----------|-----------|-----|
| `startDateBasedBulkAction()` | Empty source list | Calls `finishSuccess(DATE_BASED_BULK, BAN, 0, 0, 0)` |
| `startDateBasedBulkAction()` | No matching users | Calls `finishSuccess(DATE_BASED_BULK, BAN, 0, 0, 0)` |
| `migrateBlockedToMuted()` | Empty blocked list | Calls `finishSuccess(MIGRATE_BLOCKED_TO_MUTED, BAN, 0, 0, 0)` |
| `blockTitlesOfBlockedMuted()` | No users to process | Calls `finishSuccess(BLOCKED_MUTED_TITLES, BAN, 0, 0, 0)` |
| `unmuteAllUsers()` | Empty muted list | Calls `finishSuccess(UNMUTEALL, UNDOBAN, 0, 0, 0)` |
| `unblockAllUserTitles()` | No blocked titles | Calls `finishSuccess(TITLE, UNDOBAN, 0, 0, 0)` |
| `_resumeDateBasedBulkAction()` | Empty userList on resume | Calls `finishSuccess(DATE_BASED_BULK, BAN, 0, 0, 0)` |
| `_resumeDateBasedBulkAction()` | No matching users on resume | Calls `finishSuccess(DATE_BASED_BULK, BAN, 0, 0, 0)` |

Each fix also:
- Sets the in-progress flag to false
- Calls `resumableOperationRegistry.completeOperation()` to properly clean up

**Files Modified:**
- `programController.js` - Updated 8 early return cases with proper finish handling

**Result:**
- Tasks with no users to process now properly complete and move to "✅ Tamamlanan İşlemler"
- Queue continues to next item correctly
- No more stuck items in "⏳ Sıradaki İşlemler"

### Commit 27: Fix All Error Cases Not Completing Tasks (2026-02-16)
**Purpose:** Fix all error handling cases that leave tasks stuck in "⏳ Sıradaki İşlemler"

**Root Cause:**
Multiple error handling paths used `notificationHandler.notify()` instead of `notificationHandler.finishSuccess()`, leaving tasks in the queue without proper completion.

**Changes:**

**1. Refresh Operations - Error Cases:**

| Function | Location | Fix |
|----------|----------|-----|
| `refreshMutedList()` | else case (scraping error) | `notify()` → `finishSuccess(REFRESH_MUTED_LIST)` |
| `refreshMutedList()` | catch block (unexpected error) | `notify()` → `finishSuccess(REFRESH_MUTED_LIST)` |
| `refreshBlockedList()` | else case (scraping error) | `notify()` → `finishSuccess(REFRESH_BLOCKED_LIST)` |
| `refreshBlockedList()` | catch block (unexpected error) | `notify()` → `finishSuccess(REFRESH_BLOCKED_LIST)` |

**2. Bulk Operations - Catch Blocks:**

| Function | Fix |
|----------|-----|
| `startDateBasedBulkAction()` catch | `notify()` → `finishSuccess(DATE_BASED_BULK, BAN)` |
| `migrateBlockedToMuted()` catch | `notify()` → `finishSuccess(MIGRATE_BLOCKED_TO_MUTED, BAN)` |
| `blockMutedUsers()` catch | `notify()` → `finishSuccess(BLOCK_MUTED_USERS, BAN)` |
| `blockTitlesOfBlockedMuted()` catch | `notify()` → `finishSuccess(BLOCKED_MUTED_TITLES, BAN)` |
| `startUnmuteAll()` catch | `notify()` → `finishSuccess(UNMUTEALL, UNDOBAN)` |
| `migrateBlockedTitlesToUnblocked()` catch | `notify()` → `finishSuccess(TITLE, UNDOBAN)` |

**Files Modified:**
- `programController.js` - Updated 10 error handling paths

**Result:**
- All error cases now properly complete tasks in the queue
- Stopping a refresh operation moves it to "✅ Tamamlanan İşlemler"
- Unexpected errors during operations no longer leave tasks stuck
- Consistent behavior across all operations

### Commit 28: Fix Stop Paused Operation Not Completing Task (2026-02-16)
**Purpose:** Fix tasks staying stuck in "⏳ Sıradaki İşlemler" when stopping a paused operation

**Root Cause:**
When `requestStop()` was called on a PAUSED operation, it:
1. Set state to STOPPED
2. Sent `operationStateChanged` message to UI
3. Unregistered the operation

But it didn't call `notificationHandler.finishErrorEarlyStop()` to send a FINISH notification, so the task remained in "⏳ Sıradaki İşlemler" instead of moving to "✅ Tamamlanan İşlemler".

**Changes:**

1. **Added imports to `resumableOperation.js`:**
   - `notificationHandler` from './notificationHandler.js'
   - `processQueue` from './queue.js'

2. **Updated PAUSED case in `requestStop()` method:**
   - Added `banSourceMap` to map operation types to `enums.BanSource` values
   - Added call to `notificationHandler.finishErrorEarlyStop(banSource, null, processQueue.currentItemMetadata)` before setting state to STOPPED

**Operation Type to BanSource Mapping:**
| Operation Type | BanSource |
|----------------|-----------|
| DATE_BASED_BULK | DATE_BASED_BULK |
| MIGRATE_BLOCKED_TO_MUTED | MIGRATE_BLOCKED_TO_MUTED |
| BLOCK_MUTED_USERS | BLOCK_MUTED_USERS |
| BLOCK_TITLES | BLOCKED_MUTED_TITLES |
| REFRESH_MUTED_LIST | REFRESH_MUTED_LIST |
| REFRESH_BLOCKED_LIST | REFRESH_BLOCKED_LIST |

**Files Modified:**
- `resumableOperation.js` - Added imports, updated `requestStop()` method

**Result:**
- Stopping a paused operation now properly completes the task in the queue
- Task moves from "⏳ Sıradaki İşlemler" to "✅ Tamamlanan İşlemler"
- Consistent behavior for all stop scenarios

### Commit 29: Fix Task Queueing During Active Operations (2026-02-16)
**Purpose:** Fix tasks not being added to the queue when there's an ongoing operation

**Root Cause Analysis:**
1. **Redundant condition in `background.js`:** The condition `!(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)` prevented tasks from being enqueued when an operation was running directly (not through the queue)
2. **Button state management in `buttonStateManager.js`:** Buttons were disabled when `operationState === 'ACTIVE'`, preventing users from clicking to add tasks to the queue

**Problem Flow:**
- When operation is RUNNING → `operationState = 'ACTIVE'` → buttons DISABLED → cannot add to queue
- When operation is PAUSED → `operationState = 'PAUSED'` → buttons ENABLED → can add to queue

**Changes:**

1. **background.js** - Removed redundant conditions from all bulk action handlers:
   - `startDateBasedBulkAction`: Removed `&& !(programController.isActive && processQueue.size === 0 && !processQueue.isRunning)`
   - `startMigration/startTitleMigration`: Simplified to only check `specificTaskInProgress`
   - `refreshMutedList`, `refreshBlockedList`, `blockMutedUsers`, `blockTitlesOfBlockedMuted`: Same simplification

2. **resumableOperation.js** - Added `hasPausedOperation()` method:
   ```javascript
   hasPausedOperation() {
     const op = this.getCurrentOperation();
     return op && op.state === OperationState.PAUSED;
   }
   ```

3. **programController.js** - Updated `isActive` getter to check for paused operations:
   ```javascript
   get isActive() {
     return processQueue.isRunning ||
            this._migrationInProgress ||
            this._isMutedListRefreshInProgress ||
            this._isBlockedListRefreshInProgress ||
            this._blockMutedUsersInProgress ||
            this._blockTitlesInProgress ||
            this._dateBasedBulkInProgress ||
            this._unmuteAllInProgress ||
            resumableOperationRegistry.hasPausedOperation();
   }
   ```

4. **buttonStateManager.js** - Enabled action buttons during active operations:
   - Removed `isOperationActive` and `isOperationCooldown` from disabled condition
   - Buttons now only disabled when `isProcessing` (same button's action in progress)
   - Updated tooltip to inform users about queueing behavior

**Files Modified:**
- `background.js` - Removed redundant queueing conditions
- `resumableOperation.js` - Added `hasPausedOperation()` method
- `programController.js` - Updated `isActive` getter
- `buttonStateManager.js` - Enabled buttons during active operations

**Expected Behavior After Fix:**
| Scenario | Button State | Action |
|----------|--------------|--------|
| No operation | Enabled | Task starts immediately |
| Operation running | Enabled | Task added to queue |
| Operation paused | Enabled | Task added to queue |
| Same button's task running | Disabled | Prevented by `isProcessing` |

**Safety:**
- `background.js` checks prevent duplicate tasks (e.g., `if (!programController.isMutedListRefreshInProgress)`)
- `queue.dequeue()` checks `programController.isActive` before processing next item
- Tasks wait in queue until current operation completes or paused operation is resumed and completed

### Commit 30: Auto-Continue Queue After Stop (2026-02-16)
**Purpose:** Fix the queue not automatically processing the next item after stopping an operation, and not auto-starting on page refresh

**Root Cause Analysis:**
1. **Queue not auto-starting on page refresh:** When `_initializePersistedQueue()` restored items from storage, it never called `dequeue()` to start processing
2. **Queue not continuing after stop:** When an operation was stopped (especially from PAUSED state), the queue's `dequeue()` was never triggered
3. **isActive blocking dequeue:** The `programController.isActive` getter included `hasPausedOperation()` but didn't exclude STOPPING/STOPPED states, preventing queue from starting

**Changes:**

1. **queue.js - Auto-start and trigger processing:**
   - Added auto-start after `_initializePersistedQueue()` restores items: 1 second delay then calls `dequeue()`
   - Added `triggerProcessing()` method for external trigger of queue processing
   - Updated `dequeue()` to check `hasPausedOperation()` more carefully

2. **resumableOperation.js - Trigger queue after stop:**
   - Added `processQueue` import
   - Added `_triggerQueueProcessing()` private method
   - Called `_triggerQueueProcessing()` after:
     - Operation stops at checkpoint (STOPPING → STOPPED)
     - Paused operation is stopped (PAUSED → STOPPED)
     - Operation completes

3. **programController.js - Clear flags on stop:**
   - Added `forceClearAllFlags()` method to clear all `_xxxInProgress` flags
   - Updated `stopCurrentOperation()` to:
     - Call `forceClearAllFlags()` before registry stop
     - Call `processQueue.triggerProcessing()` after successful stop
   - Updated `isActive` getter to exclude STOPPING/STOPPED states from active check

**Files Modified:**
- `queue.js` - Auto-start on restoration, `triggerProcessing()` method
- `resumableOperation.js` - `_triggerQueueProcessing()` method, import `processQueue`
- `programController.js` - `forceClearAllFlags()`, updated `stopCurrentOperation()`, updated `isActive`

**Result:**
- When multiple items are in queue and stop button is pressed, the next item automatically starts
- When page is refreshed with items in queue, processing auto-starts after 1 second
- Queue properly continues after operation completes or is stopped
- Consistent behavior for all stop scenarios (running → stop, paused → stop)

**Flow After Fix:**
1. User clicks stop on running operation
2. `programController.stopCurrentOperation()` called
3. `forceClearAllFlags()` clears all in-progress flags
4. `resumableOperationRegistry.requestStop()` called
5. Operation state → STOPPING/STOPPED
6. `_triggerQueueProcessing()` called
7. `processQueue.triggerProcessing()` called
8. Queue checks `programController.isActive` → false (flags cleared, no paused op)
9. `dequeue()` processes next item

### Commit 31: Complete Dark Mode Support (2026-02-16)
**Purpose:** Fix all remaining dark mode styling issues across all pages

**Issues Fixed:**

1. **Card Headers** - Section titles (like "📅 Tarih Bazlı İşlemler") had light gradient backgrounds in dark mode
2. **Toggle Switches** - "Açık" button text was unreadable (dark text on dark background)
3. **Hyperlinks** - Black text in dark mode
4. **welcome.html** - No dark mode support
5. **documentation.html** - No dark mode support
6. **authorListPage.html** - No dark mode theme loading
7. **faq.html** - Hardcoded black text, question mark icon not inverted
8. **Help Button** - Text had underline and wrong color in dark mode

**Changes:**

**customNotification.css:**
- Added dark mode styles for `.card-header` (dark gradient: #334155 → #475569)
- Added dark mode styles for `.table-header`, `.modern-table`, `.stat-mini`, `.rule-icon`
- Added dark mode hyperlink styles (blue: #60a5fa, hover: #93c5fd, visited: #a78bfa)
- Added dark mode help button styles (white text, no underline)

**switchButtons.css:**
- Added dark mode support for candy theme toggle switches
- Dark background (#1e293b), light text colors
- Proper slider border colors

**tooltip.css:**
- Added dark mode tooltip styles (#475569 background)

**faq.html:**
- Replaced hardcoded `color:black` inline styles with CSS classes
- Added `.faq-link` class (dark in light mode, blue in dark mode)
- Added `.faq-bold` class (black in light mode, light in dark mode)
- Added dark mode styles for h3, li, ol elements
- Added filter: invert(1) for question mark icon in dark mode
- Added dark mode button styles for theme toggle

**welcome.html:**
- Added customNotification.css import
- Added dark mode styles for body, content, links, headings
- Updated welcome.js to apply saved theme on load

**welcome.js:**
- Added `applyTheme()` function to load theme from localStorage

**authorListPage.js:**
- Added `applyTheme()` function to load theme from localStorage

**documentation.html:**
- Added customNotification.css import
- Added dark mode styles for body, grid items, headings
- Added inline script to apply saved theme on load

**Files Modified:**
- `customNotification.css` - Card headers, tables, stats, hyperlinks, help button
- `switchButtons.css` - Toggle switch dark mode styles
- `tooltip.css` - Tooltip dark mode styles
- `faq.html` - Link/bold classes, h3/li/ol dark styles, question mark invert
- `welcome.html` - Dark mode styles
- `welcome.js` - Theme loading
- `authorListPage.js` - Theme loading
- `documentation.html` - Dark mode styles

**Result:**
- All pages now properly support dark mode
- Card section headers have dark backgrounds in dark mode
- Toggle switch text is readable in dark mode
- All hyperlinks are visible in dark mode
- Help button text is white without underline
- Theme persists across all pages via localStorage

### Commit 32: Fix Task Queue Display Race Condition (2026-02-16)
**Purpose:** Fix tasks not appearing in "⏳ Sıradaki İşlemler" when triggered from title menu buttons

**Root Cause:**
The legacy message handler in `background.js` had a race condition where the task was enqueued (and immediately started processing via `dequeue()`) before the notification tab was ready. By the time `ensureNotificationTabExistsAndIsReady()` completed, the task had already been removed from the queue, so `updatePlannedProcessesList()` showed an empty queue.

**Affected Buttons:**
- "başlıktakileri engelle (son 24 saatte)" - Title menu dropdown
- "başlıktakileri engelle (tümü)" - Title menu dropdown
- Single user block/unblock - Entry menu, Profile
- "Favori edenleri engelle" - Entry menu
- "Takipçileri engelle" - Profile
- "Listeden engelle" - Author list

**Bug Flow:**
1. User clicks "başlıktakileri engelle (tümü)"
2. `processQueue.enqueue(wrapperProcessHandler)` - Item added and `dequeue()` starts async
3. `(async () => { await ensureNotificationTabExistsAndIsReady(); ... })()` - Slow async IIFE
4. Task finishes quickly (short list)
5. `dequeue()` removes item from queue
6. Notification tab finally ready, calls `updatePlannedProcessesList(processQueue.itemAttributes)`
7. Queue is now empty - item never appeared in UI

**Fix:**
Restructured the legacy message handler to match the working pattern used by other actions (`startMigration`, `refreshMutedList`, etc.):
- Await notification tab readiness BEFORE enqueueing
- Update UI immediately after enqueue (before `dequeue()` can run)
- Return `true` to keep message port open for async response

**Files Modified:**
- `background.js` - Restructured legacy message handler (lines 356-398)

**Result:**
- Tasks now appear in "⏳ Sıradaki İşlemler" immediately when triggered
- Task moves to "✅ Tamamlanan İşlemler" after completion
- Consistent queue behavior across all action types

### Commit 33: Fix Pause/Stop Buttons Disabled During Cooldown (2026-02-16)
**Purpose:** Fix pause and stop buttons being deactivated during cooldown for tasks like "başlıktakileri engelle (tümü)" or "başlıktakileri engelle (son 24 saatte)"

**Root Cause:**
1. Legacy TITLE operations run through `processQueue` but don't register with `resumableOperationRegistry`
2. `hasAnyRunningTasks` getter in `programController.js` did NOT include `processQueue.isRunning`, so the buttonStateManager couldn't detect running legacy operations
3. COOLDOWN notification handling in `notification.js` only updated status text but didn't ensure buttons remained enabled
4. Early stop button was disabled because `getRunningTasksState()` returned `{ hasRunningTasks: false }` for legacy operations

**Affected Operations:**
- "başlıktakileri engelle (son 24 saatte)" - Title menu dropdown
- "başlıktakileri engelle (tümü)" - Title menu dropdown
- Single user block/unblock - Entry menu, Profile
- "Favori edenleri engelle" - Entry menu
- "Takipçileri engelle" - Profile
- "Listeden engelle" - Author list

**Changes:**

1. **programController.js - hasAnyRunningTasks getter**
   - Added `processQueue.isRunning` to the getter
   - Legacy operations running through queue now detected as running tasks
   ```javascript
   get hasAnyRunningTasks() {
     return processQueue.isRunning ||
            this._migrationInProgress ||
            // ... other flags
   }
   ```

2. **notification.js - COOLDOWN handler**
   - Added code to ensure early stop button remains enabled during cooldown
   ```javascript
   const earlyStopBtn = document.getElementById("earlyStop");
   if (earlyStopBtn) earlyStopBtn.disabled = false;
   ```

**Files Modified:**
- `programController.js` - Updated `hasAnyRunningTasks` getter (line 127-136)
- `notification.js` - Added button enable in COOLDOWN handler (line 1079-1080)

**Result:**
- Pause and stop buttons now remain enabled during cooldown for all operations
- Users can stop operations even while waiting for API rate limit cooldown
- Legacy TITLE operations are properly detected as running tasks
