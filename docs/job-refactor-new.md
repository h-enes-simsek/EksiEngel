# Job processing refactor — revised implementation plan

## Purpose of this document

This document replaces the pending direction in `docs/job-refactor.md`. The
earlier plan was useful for introducing jobs, cancellation, and terminal
results, but the next proposed extraction (`performRelationAction` and its retry
logic) does not currently provide enough value by itself.

The revised goal is to finish the job lifecycle and UI architecture without
turning the extension into an unnecessarily complicated framework. A future
developer should be able to use this document as the implementation brief even
without the conversation that produced it.

The refactor must remain incremental. The unpacked extension should remain
usable after every commit, and behavior changes should not be hidden inside
large structural moves.

## Decisions already made

These decisions are intentional constraints, not open questions for this
refactor.

### Accepted relation-execution limitation

`RelationHandler.performAction()` may apply several targets for one author. If
an earlier target succeeds and a later target is rate-limited or cancelled, the
outer retry can repeat an already-applied target and the result cannot describe
the partial side effect precisely.

This limitation is accepted for now. Do not introduce per-target commands,
per-target checkpoints, or a new relation-planning framework in this refactor.
Keep the current one-retry behavior unless a separate future task explicitly
changes it.

Consequently, extracting `performRelationAction` or creating a generic relation
executor is no longer a required next step. The small signal-binding helper in
`background.js` can remain local.

### Trusted internal job callers

The extension controls the popup, author-list page, content script, and the
values they send. A broad runtime-message validation framework is not a goal.
Message code may be adjusted when required by the new job and UI contracts, but
do not add sender policy, schema libraries, or source-specific validation merely
for architectural purity.

### UI update rule

There are two intentionally different UI paths:

1. While a job is running, code reports counter changes and meaningful business
   phases explicitly. Examples include checking access, checking login,
   collecting authors, analysing relations, executing actions, and waiting in
   cooldown.
2. When a job terminates, the UI output must come from the returned `JobResult`.
   The process runner must not independently send a success, cancellation, or
   error completion that can disagree with the result.

In short:

```text
running state  -> explicit phase/progress reports -> UI snapshot updates
terminal state -> returned JobResult              -> completed UI output
```

### Existing product choices that remain unchanged

- Telemetry behavior and privacy choices are outside this refactor. Do not
  change telemetry defaults, payloads, consent, or policy text.
- `jsdom.js` remains in use.
- The existing content-script observers remain in use.
- Entry menus and metadata may continue to be paired by their current index
  logic.
- Existing `innerHTML` rendering may remain.
- Existing injected `<li>`/anchor controls may remain.
- Fake handlers may remain imported by the production service worker.
- The `tabs` permission has already been removed. No further tabs-permission
  task is needed.
- Closing the tracked notification tab currently requests early cancellation.
  Preserve that behavior during this refactor unless a separate product
  decision changes it.

### Approved cleanup

- Remove unused imports, unused variables, and dead/no-op analytics paths.
- Shrink `web_accessible_resources` to resources actually required by the
  content script, after verifying that extension pages still work.

## Current baseline

The following work from the first refactor is valuable and should be preserved:

- `processHandler` receives an explicit `JobRequest` through a job record.
- Queue entries contain job records instead of decorated functions.
- `JobManager` wraps the existing serial queue.
- One `AbortController` belongs to each active execution.
- The active signal reaches relation requests, scraping requests, pagination,
  action loops, the access check, and cooldown delays.
- Every normal process exit creates an immutable `JobResult` with an
  authoritative `finishReason`.
- Telemetry captures an immutable snapshot and is submitted without blocking
  the next queued job.
- `EksiScrapingHandler` has a tested error and cancellation contract.

The architecture is still transitional:

- `AutoQueue` owns waiting callbacks and serial execution.
- `JobManager` owns the active `AbortController`.
- `ProgramController` owns the early-stop flag and notification-tab ID.
- `processHandler` owns counters, finish-reason selection, most UI calls, and
  queue-clearing behavior.
- The notification page owns its last received state only in the DOM.
- Returned job completions and `JobResult`s are not retained or projected by
  the application.

The main objective is to replace those split responsibilities with one job
lifecycle owner and one authoritative UI snapshot.

## Target architecture

The desired flow is deliberately small:

```text
popup / content script / author-list page
                  |
                  | enqueue or cancel request
                  v
             background.js
        Chrome listeners + composition only
                  |
                  v
              JobManager
 queue + active execution + cancellation + results + snapshot
                  |
                  | job + signal + progress reporter
                  v
              JobRunner
 current access/login/collection/analysis/relation workflow
                  |
          +-------+--------+
          |                |
   phase/progress       JobResult
          |                |
          +-------+--------+
                  v
        authoritative job snapshot
                  |
                  v
          notification page renderer
```

`background.js` remains responsible for wiring Chrome APIs to the application,
but it should not remain the owner of all job business state.

## Core data contracts

The exact filenames can change if necessary, but the contracts below should
remain explicit and serializable.

### Job phase

Add a small `JobPhase` enum. It exists to tell the UI where the active job is,
not to model every line of the runner.

Recommended initial phases:

```js
const JobPhase = {
  QUEUED: "QUEUED",
  PREPARING: "PREPARING",
  CHECKING_ACCESS: "CHECKING_ACCESS",
  CHECKING_LOGIN: "CHECKING_LOGIN",
  COLLECTING_AUTHORS: "COLLECTING_AUTHORS",
  COLLECTING_FAVORITERS: "COLLECTING_FAVORITERS",
  COLLECTING_FOLLOWERS: "COLLECTING_FOLLOWERS",
  COLLECTING_EXISTING_RELATIONS: "COLLECTING_EXISTING_RELATIONS",
  COLLECTING_TITLE_AUTHORS: "COLLECTING_TITLE_AUTHORS",
  ANALYSING_PROTECTED_USERS: "ANALYSING_PROTECTED_USERS",
  ANALYSING_REQUIRED_ACTIONS: "ANALYSING_REQUIRED_ACTIONS",
  EXECUTING_RELATIONS: "EXECUTING_RELATIONS",
  COOLDOWN: "COOLDOWN",
  CANCELLING: "CANCELLING"
};
```

Do not put Turkish UI strings in the enum. `notification.js` or a presentation
mapping should translate phases into the existing user-facing messages.

### Job progress

Use the existing counter meanings during this refactor:

```js
{
  successfulAction,
  performedAction,
  plannedAction
}
```

Changing the meaning from author-level actions to per-target HTTP operations is
out of scope. Every time one of these values changes, the runner must publish a
new complete progress object.

### Active job state

The manager needs a private/persisted execution record containing the complete
accepted input:

```js
{
  id,
  request,
  settings,
  createdAt
}
```

That complete record is used by the runner and recovery code. It should not be
sent wholesale to the notification UI because the UI does not need author lists
or complete settings.

The manager's public active-job state should contain only serializable display
data:

```js
{
  job: {
    id,
    banSource,
    banMode,
    createdAt
  },
  phase,
  progress,
  cooldownEndsAt,
  cancelRequested
}
```

`AbortController`, promises, handlers, and functions must remain private runtime
objects and must never appear in any snapshot. Full request/settings values may
appear only in the private persisted execution state, not in the public UI
snapshot.

`cooldownEndsAt` should be an ISO timestamp or `null`. The worker can still
publish visible countdown changes while it is alive, but persistence should not
need one storage write per second. The page can derive seconds remaining from
the end time.

### Waiting and completed job summaries

The notification page needs only job identity and display fields, not complete
scraped author data.

```js
// waiting
{
  id,
  banSource,
  banMode,
  createdAt
}

// completed
{
  job: {
    id,
    banSource,
    banMode,
    createdAt
  },
  result: JobResult
}
```

Keep completed history bounded. An initial limit of 50 results is sufficient
unless product requirements say otherwise.

### Authoritative snapshot

The public presentation snapshot is:

```js
{
  revision,
  activeJob,
  waitingJobs,
  completedJobs
}
```

Rules:

- `revision` increases after every externally visible state transition.
- Snapshot objects should be detached from internal arrays and treated as
  immutable by consumers.
- The UI renders a whole snapshot rather than reconstructing truth from several
  unrelated notification messages.
- A snapshot must remain valid after serialization through a Chrome runtime
  message or `chrome.storage`.

This public snapshot is the notification UI contract. Phase 4 adds a separate
private recovery checkpoint containing full accepted requests/settings for
active and waiting jobs. Never broadcast that private checkpoint as UI state.

## Active-job reporting contract

The runner may continue to own local counters for now. To keep this refactor
simple, it does not need a new domain state framework. Instead, `JobManager`
supplies a small reporter bound to the active job:

```js
{
  reportPhase(phase, details),
  reportProgress({successfulAction, performedAction, plannedAction}),
  reportCooldown({remainingSeconds, cooldownEndsAt})
}
```

The reporter checks that the report belongs to the current active execution,
updates manager state, increments the revision, persists when appropriate, and
publishes the new snapshot.

Required manual report locations include:

- before the Ekşi Sözlük access check;
- before the login/current-account check;
- before each source-specific collection operation;
- before protection and only-required-action analysis;
- immediately after `plannedAction` is assigned or changed;
- immediately after `recordRelationResult()` changes counters;
- when cooldown starts, changes visibly, and ends;
- when cancellation is requested.

Do not report terminal success or failure through this interface. Terminal
state comes from `JobResult` only.

## Terminal-result contract

The runner must return one `JobResult` for every handled execution path.

The following rule is central:

> `JobManager` receives the result, commits it to completed state, publishes the
> resulting snapshot, settles the job completion, and only then starts the next
> waiting job.

The runner should stop calling terminal methods such as:

- `finishSuccess()`;
- `finishErrorEarlyStop()`;
- source-specific `finishError...()` methods.

During migration, those calls can remain until their equivalent result mapping
exists, but the final state must have one terminal presenter that maps
`finishReason` to UI text.

The terminal presenter must cover every `ProcessFinishReason`, including
`UNEXPECTED_ERROR`. It should always display the real counters from the result.

`SUCCESS` continues to mean that the runner completed its workflow. If
`successfulAction`, `performedAction`, and `plannedAction` differ, the UI should
show the counters rather than inventing a more precise relation outcome that
the current handler cannot provide.

As a safety net, if the runner throws instead of returning a result,
`JobManager` should convert the exception into an `UNEXPECTED_ERROR` result for
that job. No accepted job should disappear because its completion promise was
ignored.

## Detailed implementation phases

### Phase 1 — Stabilize storage inputs and configuration

This phase fixes agreed correctness problems without changing privacy behavior.

#### 1.1 Correct Chrome storage error handling

Replace checks of `chrome.runtime.error` with either:

- promise-based `await chrome.storage...` plus `try/catch`; or
- callback-based `chrome.runtime.lastError` handling.

Apply this to at least:

- `config.js`;
- `utils.getUserList()` if it remains in use;
- `authorListPage.js`.

Do not silently convert a storage error into “no data.” Missing data and failed
storage access are different outcomes.

**Implementation status: completed.**

- `config.js` now uses the promise-based storage API. A missing configuration
  still returns `false`, while read and write failures reject. `handleConfig()`
  also awaits the initial default-config write so that its failure propagates.
- `utils.getUserList()` initially distinguished missing data from storage read
  failures, then was removed once task 1.2 made the accepted LIST request the
  sole operative input.
- `authorListPage.js` now shows saved feedback only after the storage write
  resolves. A rejected write is logged and reported to the user with an alert.
- The content script's duplicate configuration reader was updated as well, so
  it no longer treats storage failures as a missing configuration.
- Focused storage tests cover missing keys, rejected reads and writes, default
  configuration writes, and author-list failure feedback. The complete
  frontend test suite passed with 120 tests after this change.

#### 1.2 Make LIST submission atomic

When the user clicks ban or unban on `authorListPage.html`:

1. Read the textarea value.
2. Save it for user convenience.
3. Await storage success.
4. Include that same value, or its cleaned author array, in the job request.
5. Enqueue only after those steps succeed.

The job must not later reload its operative input from the shared `userList`
storage key. A queued job must execute the list that existed when it was
accepted, even if the user edits and submits another list afterward.

Recommended request addition:

```js
{
  banSource: BanSource.LIST,
  banMode,
  authorListText
}
```

The existing cleaning logic can remain in the runner initially. This is an
input snapshot change, not a request-validation project.

**Implementation status: completed.**

- `authorListPage.js` now captures the textarea once, awaits the convenience
  storage write, and sends that same text in the LIST job request only after
  the write succeeds.
- `JobRequest` now carries `authorListText`, and LIST execution splits and
  cleans that captured value instead of rereading the shared `userList` key.
- Focused tests verify save-before-enqueue ordering, failed-save behavior, and
  distinct snapshots for consecutive LIST submissions. The complete frontend
  test suite passed with 121 tests after removal of the obsolete storage-reader
  tests.

#### 1.3 Snapshot settings for each accepted job

Ensure configuration is loaded before accepting the job, then copy the settings
needed by execution into the job record. An active or waiting job should not
change behavior because the FAQ/settings page was edited later.

The snapshot can be stored beside `request`:

```js
{
  id,
  request,
  settings,
  createdAt
}
```

Handlers should use that snapshot during the job instead of repeatedly reading
the mutable exported `config` object where practical.

**Implementation status: completed.**

- The background message adapter now awaits configuration loading before it
  accepts and enqueues a valid job request. Configuration read failures are
  returned to the caller and do not create a job.
- Every job record now contains a detached, deeply frozen, serializable
  settings snapshot. Jobs accepted before and after a settings edit therefore
  retain distinct execution settings.
- The runner uses `job.settings` for feature decisions, access and relation
  URLs, scraper construction, log inclusion, telemetry consent and telemetry
  destination. It no longer reloads or reads mutable configuration while a job
  is running.
- Runtime messages now use explicit types for job enqueue, cancellation, and
  notification updates. The service worker owns command routing, and listeners
  ignore unrelated message types instead of competing to respond.
- Focused tests cover snapshot isolation, snapshot-aware access, relation and
  telemetry requests, message envelopes, and unrelated-message handling. The
  complete frontend test suite passed with 135 tests after this change.

#### 1.4 Replace update-time storage clearing

Do not call `chrome.storage.local.clear()` on every extension update. Introduce
a small settings version and merge stored values over current defaults.

This work is for configuration compatibility and preserving user state. It must
not change telemetry defaults, consent, payload construction, or privacy copy.

**Implementation status: deliberately skipped for now.**

- Phase 1 is being finalized with tasks 1.1-1.3 complete. Task 1.4 is deferred
  by an explicit project decision and is not a blocker for starting Phase 2.
- The current update-time `chrome.storage.local.clear()` behavior therefore
  remains in place as a known limitation. Configuration migration, preservation
  of unrelated local storage, and the corresponding tests should be completed
  in a separate future task before this item is marked complete.

#### Phase 1 acceptance criteria

**Phase status: finalized, with task 1.4 deliberately deferred as documented
above.** The acceptance criteria for this phase-finalization decision cover
tasks 1.1-1.3:

- A LIST job cannot start before its textarea value is saved.
- Two queued LIST jobs can carry different author lists.
- Storage failures are visible and prevent false success feedback.
- A queued job uses the settings captured when it was accepted.

Preserving unrelated local storage during extension updates remains the
deferred acceptance criterion for task 1.4, not a completed Phase 1 guarantee.

### Phase 2 — Make `JobManager` the lifecycle owner

#### 2.1 Absorb or safely replace `AutoQueue`

`JobManager` should own the waiting array and serial pump directly, or own an
internal queue abstraction that can settle drained entries correctly.

Required invariant:

> Every successful `enqueue()` is matched by exactly one terminal settlement.

Removing a waiting job must create a cancellation `JobResult` and resolve its
completion. Never discard stored `resolve` or `reject` callbacks by replacing an
array.

**Implementation status: completed.**

- `JobManager` now owns its waiting entries and serial pump directly. Starting
  a job removes it from the waiting array, establishes the single active
  execution, and starts the next FIFO entry only after the current entry has
  settled.
- Each accepted entry retains its own guarded completion callbacks.
  `clearWaiting()` atomically drains only waiting entries, creates an immutable
  zero-counter `CANCELLED` `JobResult` for each one, resolves every completion,
  and returns the created results. Repeated drains cannot settle an entry
  again.
- Production code no longer imports or runs the `processQueue` singleton.
  Until the remaining Phase 2 cancellation cutover removes
  `ProgramController`, that controller reads lifecycle state from `JobManager`
  and routes active cancellation to it.
- Focused tests cover FIFO/single-active execution, result identity, safe
  waiting-job drainage, continued execution after a runner rejection,
  idempotent active abort, and the transitional notification-tab cancellation
  adapter. The complete frontend test suite passed with 141 tests.

#### 2.2 Retain terminal records

When execution returns:

1. Save the result in bounded completed history with the job summary.
2. Clear the active runtime execution.
3. Publish the new snapshot.
4. Settle the completion promise.
5. Start the next job.

The application must no longer create `JobResult`s that nobody observes.

**Implementation status: completed.**

- `JobManager` now retains completed records containing the public job summary
  and its exact returned `JobResult`. History is bounded to 50 records by
  default, with the oldest records removed first.
- A finished execution is committed in the required order: its record is
  retained, private active runtime state is cleared, a new revisioned snapshot
  is published, its completion is resolved, and only then can the FIFO pump
  start the next waiting job. A pump guard preserves that ordering even if a
  snapshot publisher enqueues another job re-entrantly.
- If the runner throws, the manager creates, retains, publishes, and resolves an
  `UNEXPECTED_ERROR` result with zero counters and the thrown error message.
  Runner failures therefore no longer reject into an unobserved completion or
  make an accepted job disappear.
- Waiting-job cancellation results created by `clearWaiting()` are also added
  to completed history before their completions resolve.
- `getSnapshot()` now returns the authoritative `{revision, activeJob,
  waitingJobs, completedJobs}` shape. The active state begins in `PREPARING`
  with zeroed progress; snapshots are deeply frozen, detached from manager
  arrays, serializable, and exclude full requests, settings, abort controllers,
  promises, and callbacks. The optional snapshot publisher is ready for the UI
  cutover in Phase 3.
- Focused tests cover terminal ordering and result identity, re-entrant enqueue,
  increasing revisions, cancellation retention, unexpected runner failures,
  bounded history, and snapshot privacy/immutability. The complete frontend
  test suite passed with 145 tests.

#### 2.3 Add explicit cancellation operations

Keep the meanings straightforward:

```js
cancelActive(reason)
cancelAll(reason)
```

`cancelAll()` must:

- mark cancellation requested in active UI state;
- abort the active controller once;
- drain all waiting jobs;
- create zero-counter `CANCELLED` results for jobs that never started;
- settle every drained job;
- publish one consistent snapshot.

The active runner returns its own cancellation result with its real counters.

**Implementation status: completed.**

- `cancelActive()` now makes cancellation visible by changing the active phase
  to `CANCELLING`, clearing any cooldown deadline, setting
  `cancelRequested`, publishing the resulting snapshot, and aborting the
  active controller at most once. It does not affect waiting jobs.
- `cancelAll()` performs the active cancellation transition and drains every
  waiting entry as one manager operation. Waiting jobs receive immutable,
  zero-counter `CANCELLED` results and settle only after one combined snapshot
  contains the cancelling active job, empty waiting queue, and completed
  waiting-job records.
- The active execution is not given a synthetic manager result. Its runner
  still returns the authoritative cancellation result, including counters
  accumulated before the abort.
- Repeated cancellation requests are idempotent when there is no remaining
  state to change. Focused tests cover the visible active transition, one-time
  abort behavior, preservation of waiting jobs for `cancelActive()`, atomic
  all-job cancellation, waiting completion settlement, and active counter
  retention. The complete frontend test suite passed with 146 tests.

#### 2.4 Introduce progress and phase reporting

Create the active reporter described earlier and replace direct
`notificationHandler.notifyOngoing()` and `notifyCooldown()` calls gradually.

Do not move relation execution into a new executor during this phase.

**Implementation status: completed.**

- `JobManager` now supplies each active execution with a frozen reporter bound
  to that exact execution. Phase, complete progress, and cooldown reports
  update the public active state, increment the revision, and publish a new
  detached snapshot. Reports from completed/replaced executions and reports
  received after cancellation are ignored.
- Reporter inputs are checked at the lifecycle boundary: phases must be
  `JobPhase` values, every progress report must contain three non-negative
  integer counters, and cooldown reports require a non-negative whole-second
  value plus an ISO deadline or `null`.
- The existing runner now reports access and login checks, every source-specific
  collection path, followed-user and existing-relation collection, both
  analysis phases, and relation execution. Each `plannedAction` assignment and
  each counter-changing relation result publishes a complete progress object.
- Cooldown reporting publishes one stable `cooldownEndsAt` timestamp when the
  wait starts, publishes visible ticks while the worker remains active, and
  clears the deadline when the wait ends. Cancellation keeps the manager-owned
  `CANCELLING` state from being overwritten by a late cooldown or phase report.
- Legacy ongoing and cooldown UI messages are temporarily emitted from the
  centralized reporting helpers so the unpacked extension remains usable
  before Phase 3 replaces the notification event protocol. Relation execution
  and its one-retry behavior were not moved or redesigned.
- Focused tests cover reporter publication and revisions, payload validation,
  cooldown transitions, stale-report rejection, and cancellation precedence.
  The complete frontend test suite passed with 149 tests.

#### 2.5 Cut over cancellation and remove the transitional owners

Removing `AutoQueue` while leaving `ProgramController.isActive` connected to the
old `processQueue` would break cancellation. Therefore the ownership cutover
must be completed as one coherent phase:

1. Move the early-stop runtime listener into the background Chrome adapter.
2. Route an accepted early-stop request to `jobManager.cancelAll()`.
3. Keep notification-tab identity in the background/UI adapter and route closing
   the tracked tab to the same `cancelAll()` operation.
4. Replace `programController.earlyStop` checks with the active abort signal and
   authoritative finish reason.
5. Derive the telemetry `earlyStopped` field from the cancellation result rather
   than a resettable global flag.
6. Delete `programController.js`, `queue.js`, and their imports/resource entries.

This is the correct removal point for `ProgramController`: after JobManager has
the replacement cancellation/lifecycle behavior and its tests, but before UI
persistence or `JobRunner` extraction. Do not retain a temporary controller
adapter that mirrors manager state.

**Implementation status: completed.**

- The background runtime-message adapter now routes `CANCEL_ALL_JOBS` directly
  to `jobManager.cancelAll()`. It captures the waiting summaries only for the
  temporary legacy notification adapter; lifecycle drainage, cancellation
  results, completion settlement, and the active abort remain manager-owned.
- Notification-tab identity now lives in `background.js`. Closing any unrelated
  tab is ignored; closing the tracked notification tab clears its identity and
  routes through the same `cancelAll()` operation with an explicit reason.
- The runner no longer reads, resets, or otherwise depends on a global
  early-stop flag. It selects cancellation from its active abort signal, creates
  its authoritative `JobResult` before terminal cleanup, and bases terminal
  branching and telemetry's `earlyStopped` value on that result's
  `finishReason`.
- Delayed queue clearing was removed from the runner. Waiting jobs are now
  cancelled and settled synchronously by the manager when the cancellation
  request is accepted, while the active runner returns its own result with the
  counters accumulated before cancellation.
- `programController.js`, `queue.js`, the transitional controller tests, and
  both web-accessible-resource entries were removed. Repository checks confirm
  that frontend production and test code contain no remaining references to
  `ProgramController`, `AutoQueue`, or `processQueue`.
- New background-adapter tests cover explicit cancellation, waiting-job
  drainage, exact tab identity matching, and tab-close cancellation. The
  complete frontend test suite passed with 149 tests.

#### Phase 2 acceptance criteria

- FIFO execution is preserved.
- Only one job is active.
- Every accepted job settles exactly once.
- Cancelling waiting jobs produces actual terminal results.
- Active cancellation retains completed counters.
- Unexpected runner exceptions become observable terminal results.
- `JobManager.getSnapshot()` fully describes active, waiting, and completed
  jobs.
- Cancellation no longer depends on `ProgramController` or a global early-stop
  flag.
- Neither `programController.js` nor `queue.js` is imported, loaded, or exposed.

### Phase 3 — Render the notification UI from job state

#### 3.1 Hydrate on page load

When `notification.js` loads, it must request the current job snapshot. It must
not depend on having observed messages that were sent while the tab was still
loading.

The existing runtime message shapes can be edited as necessary. A large generic
message-validation framework is not required.

**Implementation status: completed.**

- `GET_JOB_SNAPSHOT` is now an explicit runtime-message type. The background
  adapter handles it synchronously and returns the authoritative detached
  snapshot from `JobManager.getSnapshot()` without changing lifecycle state.
- On `DOMContentLoaded`, the notification page requests and retains that
  snapshot before relying on later updates. A failed or malformed response is
  logged instead of becoming an unhandled rejection.
- Focused routing tests cover both the page-load request and a background
  response containing the active job's current phase and counters. Rendering
  the retained snapshot and publishing subsequent state changes remain scoped
  to tasks 3.2-3.4.

#### 3.2 Publish complete state changes

After a phase, progress, queue, cancellation, or terminal change, publish the
new snapshot or publish a “state changed” hint followed by a snapshot request.
Sending the full snapshot is initially simpler and is acceptable at the current
queue sizes.

Use the snapshot revision to avoid rendering an older update after a newer one.

**Implementation status: completed.**

- The production `JobManager` publisher now sends a complete `JOB_SNAPSHOT`
  message after every visible state commit. This covers queue, active phase,
  progress, cooldown, cancellation and terminal transitions through the
  manager's existing centralized commit path.
- Snapshot delivery is best-effort because the notification page may not exist
  yet; page-load hydration remains the recovery path for a missed publication.
- The notification page accepts only snapshots with a revision newer than its
  retained state. The same rule applies to both live publications and the
  page-load response, so a delayed hydration response cannot replace a newer
  live update.
- Focused tests cover complete production publications, monotonically
  increasing revisions, stale/duplicate rejection and the hydration race.
  Rendering accepted snapshots remains task 3.3.

#### 3.3 Use one renderer

Create a single `renderJobState(snapshot)` path that updates:

- current status text from `activeJob.phase`;
- successful, performed, and planned counters;
- progress-bar percentage;
- cooldown display;
- early-stop enabled/disabled state;
- waiting jobs table;
- completed jobs table.

The renderer may continue using the existing DOM structure and `innerHTML`.
Changing its HTML/accessibility strategy is not part of this refactor.

**Implementation status: completed.**

- `notification.js` now has one `renderJobState(snapshot)` path used by both
  page-load hydration and newer live snapshots. Snapshots received before the
  DOM is ready are retained and rendered after `DOMContentLoaded`.
- The renderer maps every `JobPhase` to user-facing Turkish status text,
  updates all three counters and the bounded progress percentage, derives the
  visible cooldown from `cooldownEndsAt`, and disables early stop when there is
  no cancellable active job.
- Waiting and completed tables are cleared and rebuilt from their snapshot
  arrays on every accepted revision. Completed rows currently show the
  authoritative `finishReason` value; task 3.4 replaces that value with the
  complete terminal presentation mapping.
- Legacy `JOB_NOTIFICATION` events no longer mutate the page, preventing old
  imperative messages from disagreeing with snapshot state. Their remaining
  background emitters can be removed as terminal presentation is completed.
- Focused UI-state tests cover hydration rendering, active/cooldown progress,
  waiting and completed rows, no-active reset behavior, early-stop state and
  every phase-to-text mapping.

#### 3.4 Derive terminal rows from results

Completed rows must be generated from `completedJobs[].result`, never from a
separate imperative finish call. Map every known finish reason to the existing
Turkish status/error text.

Re-rendering the same snapshot must not duplicate a completed row. Rebuilding
the bounded completed table from the snapshot is simpler than append-only DOM
state.

**Implementation status: completed.**

- The notification presenter now maps every `ProcessFinishReason` to terminal
  Turkish status and error text. `UNEXPECTED_ERROR` includes the result's
  captured error message in its completed row.
- When there is no active job, the latest completed `JobResult` supplies the
  page status. Completed rows use `result.completedAt` and always display the
  result's real successful, performed and planned counters.
- Completed rows are rebuilt from `snapshot.completedJobs` on every accepted
  revision. Replaying the same bounded history therefore cannot append or
  duplicate rows.
- The runner and cancellation adapter no longer call terminal
  `notificationHandler` methods. Those methods were removed, leaving terminal
  UI output exclusively owned by the result committed through `JobManager`.
- Focused tests cover every finish-reason mapping, preservation of real
  counters, unexpected-error presentation, active-state clearing and
  duplicate-free rebuilding.

#### 3.5 Preserve business-phase visibility

Keep the useful messages that exist today, but drive them through phase state.
The UI should still tell users when the program is:

- checking access;
- checking login;
- scraping the selected source;
- scraping followed or existing relations;
- applying analysis rules;
- executing relations;
- waiting for rate-limit cooldown;
- cancelling.

**Implementation status: completed.**

- The runner now reports all running UI state exclusively through its
  manager-bound phase, progress and cooldown reporter. Its remaining legacy
  `notificationHandler` import and calls were removed.
- Access, login, each selected-source collection, existing-relation
  collection, both analysis stages, relation execution and cooldown still
  report their explicit `JobPhase` values. Cancellation remains the
  manager-owned `CANCELLING` transition.
- The notification renderer has a user-facing Turkish mapping for every
  `JobPhase`, including a source-aware message for collecting relations during
  `UNDOBANALL`.
- Focused background tests verify that the production snapshot sequence
  exposes preparing, access, login, execution and cancellation phases. UI
  tests cover the complete phase enum, while the existing reporter tests cover
  phase, progress and cooldown snapshot publication.

#### Phase 3 acceptance criteria

**Phase status: completed.**

- Opening or reloading the notification page shows the current state.
- The page does not miss initial progress after `tabs.create()`.
- Every counter change is visible.
- Every meaningful business phase is visible.
- Every terminal reason creates one correct completed row.
- `UNEXPECTED_ERROR` no longer leaves the page looking active.
- Queue and completed history are derived from one snapshot.

### Phase 4 — Add service-worker interruption handling

This phase follows the snapshot because the snapshot defines what must be
stored.

#### 4.1 Persist minimal serializable state

Use `chrome.storage.session` for job-session state that must survive service
worker shutdown and restart:

- revision;
- active job record and last reported state;
- waiting job records;
- bounded completed records.
- tracked notification-tab ID, while the ID-based adapter remains in use.

Never persist `AbortController`, promises, callbacks, service instances, or
functions.

Persist after important transitions:

- enqueue accepted;
- waiting job becomes active;
- phase changes;
- action counters change;
- cooldown starts or ends;
- cancellation is requested;
- terminal result is committed;
- waiting jobs are drained;
- the notification tab is created, identified by its page-load state request,
  or removed.

Store `cooldownEndsAt` instead of persisting every countdown tick.

#### 4.2 Rehydrate safely

At service-worker startup:

1. Load persisted state before accepting or starting new work.
2. Restore waiting jobs with their original IDs, requests, settings, and
   creation times.
3. If a persisted job was active, do not pretend that its old
   `AbortController` or promise still exists.
4. Mark that job with a new terminal finish reason such as `INTERRUPTED` using
   the last persisted counters.
5. Publish the recovered snapshot.
6. Continue waiting jobs only after interrupted-state handling has completed.
7. Validate a restored notification-tab ID with `chrome.tabs.get()` before
   reusing it; clear it when the tab no longer exists. The notification page's
   state request may refresh the tracked ID from `sender.tab.id`.

Do not automatically replay the interrupted active job. The accepted partial
relation semantics do not support precise mid-action recovery.

Browser-restart durability can be considered separately later. This phase is
primarily for service-worker restarts within the browser session.

#### Phase 4 acceptance criteria

- A worker restart does not silently erase the waiting queue or UI history.
- A previously active job becomes visibly `INTERRUPTED` rather than remaining
  falsely active.
- Waiting jobs can continue after rehydration.
- The notification page can reopen and render recovered state.
- A worker restart does not create a second notification tab merely because the
  original in-memory tab ID was lost.

### Phase 5 — Move the runner out of `background.js`

After lifecycle and UI behavior are stable, move `processHandler` into a
UI-neutral module such as `jobs/jobRunner.js`.

The runner should receive explicit dependencies:

```js
runJob(job, {
  signal,
  settings,
  scrapingHandler,
  relationHandler,
  telemetryReporter,
  reporter
})
```

The runner may retain the existing source `if/else` branches initially. This
move is about making `background.js` a composition root, not forcing collectors
or relation abstractions.

After the move, evaluate duplication again. Extract source-specific functions
or shared analysis only when doing so makes the runner materially easier to
understand. Do not create a generic collector/executor pipeline merely because
it appeared in the old plan.

#### Phase 5 acceptance criteria

- `background.js` constructs dependencies and registers Chrome listeners.
- Job business execution is testable without importing a Chrome service
  worker.
- The runner has no direct terminal UI calls.
- Existing relation execution and retry behavior remains unchanged.

### Phase 6 — Approved cleanup

This phase can be split into small independent commits.

#### 6.1 Remove dead analytics code

Current analytics calls lead to the no-op `sendAnalyticsData()` method. Remove
the no-op path end to end if it still has no implementation:

- calls in `popup.js`;
- install/update call in `background.js`;
- unused `commHandler` imports in UI modules;
- `CommHandler.sendAnalyticsData()`;
- `ClickType` values if nothing else references them.

Do not remove `commHandler.sendData()` or the job telemetry path.

#### 6.2 Remove unused imports and variables

Examples to verify rather than remove blindly:

- unused `getConfig` and `saveConfig` imports in `background.js`;
- unused imports in `faq.js`;
- unused tab variables whose values are never read;
- the unnecessary `notificationHandler.js` script import in
  `notification.html` if no page-side code needs it.

Use repository-wide reference searches before deleting exported symbols.

#### 6.3 Shrink `web_accessible_resources`

The content script currently appears to require only:

- `assets/img/eksiengel16.png`, because it inserts the icon into the host page;
- `assets/js/enums.js`, because `script.js` dynamically imports it through
  `chrome.runtime.getURL()`.

Extension-owned popup, FAQ, welcome, notification, and author-list pages do not
need to be web-accessible merely to load their own scripts and images.

Reduce the manifest list to the two required resources above, then manually
verify all extension pages and every injected content-script action. If another
resource proves necessary, add only that resource back with a short explanatory
comment in this document or the commit message.

The already-removed `tabs` permission is not part of this phase.

#### Phase 6 acceptance criteria

- No no-op analytics callers or unused related enum values remain.
- No known unused imports remain in touched modules.
- Content-script icons and enum loading still work.
- Popup, FAQ, welcome, notification, and author-list pages still load.
- Internal job, queue, controller, scraper, and UI modules are not unnecessarily
  listed as web-accessible resources.

## Testing strategy

The existing scraper tests must continue to pass. Add focused tests for the new
job behavior without requiring authenticated HTML fixtures.

### JobManager tests

- FIFO execution with one active job.
- Snapshot after enqueue, start, progress, and completion.
- Revision increases on externally visible changes.
- Completion resolves with the exact returned `JobResult`.
- Runner exception becomes `UNEXPECTED_ERROR`.
- `cancelActive()` aborts once and retains real active counters.
- `cancelAll()` settles every waiting job with `CANCELLED`.
- Completed history is bounded.
- A late report from an old execution cannot mutate a newer active job.

### Runner/reporting tests

- Each existing early-return reason produces a `JobResult`.
- `UNEXPECTED_ERROR` includes its message.
- Setting `plannedAction` reports progress immediately.
- Each counter change reports a complete progress object.
- Access, login, collection, analysis, execution, cooldown, and cancellation
  phases are reported at the expected points.
- The runner does not call terminal notification methods.
- Existing composite relation retry behavior is preserved.

### Storage and recovery tests

- LIST submission does not enqueue before storage succeeds.
- Two LIST requests keep distinct list snapshots.
- Stored configuration is merged with defaults (deferred with task 1.4).
- Update initialization does not clear unrelated keys (deferred with task 1.4).
- Snapshot serialization excludes runtime-only objects.
- Rehydration converts a prior active job to `INTERRUPTED`.
- Waiting jobs restore in FIFO order.

### UI-state tests

Prefer testing pure mapping/rendering helpers where practical:

- every `JobPhase` maps to expected status text;
- every `ProcessFinishReason` maps to expected completed output;
- a snapshot rebuild does not duplicate completed jobs;
- a lower revision is ignored after a higher revision;
- counter and progress-bar calculations use snapshot values;
- no-active-job state disables early stop.

### Manual Chrome verification

At the end of each phase, load the unpacked extension and verify:

1. SINGLE ban and unban.
2. LIST ban and unban.
3. FAV, FOLLOW, TITLE, and UNDOBANALL jobs.
4. Enqueueing several jobs while another job is active.
5. Cooldown display and cancellation during cooldown.
6. Cancelling an active job with waiting jobs behind it.
7. Closing the notification tab and confirming existing cancellation behavior.
8. Reloading the notification page during an active job.
9. An intentionally forced unexpected runner error.
10. Service-worker restart during an active job and with waiting jobs.
11. Popup, FAQ/settings, welcome, and author-list pages.
12. Injected Ekşi Sözlük menu actions and their icon.

## Recommended commit sequence

Keep commits narrow and keep the extension usable between them:

1. Add job-state types and JobManager characterization tests.
2. Correct storage errors and make LIST input an immutable request snapshot.
3. Add per-job settings snapshots.
4. Cut lifecycle ownership over to JobManager: internal FIFO, retained results,
   settled cancellation, background cancellation wiring, and removal of
   `ProgramController`/`AutoQueue`.
5. Add active phase/progress reporting and snapshots.
6. Make notification UI hydrate and render snapshots.
7. Move all terminal UI output to `JobResult` presentation.
8. Add session persistence and interrupted-job recovery.
9. Move the job runner out of `background.js`.
10. Remove dead analytics/unused code and shrink web-accessible resources.

The configuration migration from task 1.4 is deliberately deferred. When it
is resumed, implement and test it in its own narrow commit; it is not a
prerequisite for the Phase 2 lifecycle cutover in step 4.

A commit may be split further if its behavior is difficult to verify. Avoid
combining UI redesign, persistence, queue replacement, and runner extraction in
one change. The lifecycle cutover in commit 4 is intentionally cohesive because
leaving `ProgramController` connected to a replaced queue would temporarily
break cancellation.

## Explicitly out of scope

Future developers should not add these tasks to this refactor unless the owner
changes the scope:

- fixing composite multi-target partial relation semantics;
- replacing relation actions with per-target commands;
- changing the current retry count or policy;
- building a broad request-validation/security framework;
- changing telemetry consent, defaults, payloads, server behavior, or privacy
  documentation;
- replacing or reducing `jsdom.js`;
- redesigning content-script observers;
- changing entry-menu/metadata index pairing;
- replacing current `innerHTML` use;
- redesigning injected controls for accessibility;
- removing production imports of fake handlers;
- additional work on the already-removed `tabs` permission;
- a generic source collector or relation executor without a concrete need found
  after `JobRunner` extraction.

These may be valid future improvements. They are excluded here to keep the
current effort focused and finishable.

## Definition of refactor completion

This refactor is complete when all of the following are true:

- `JobManager` is the sole owner of active, waiting, cancelled, and completed
  job lifecycle.
- Every accepted job settles with exactly one `JobResult`.
- Waiting-job cancellation produces real results instead of discarded queue
  entries.
- Active UI counters update after every counter change.
- The UI reports meaningful business phases while work is active.
- All terminal UI output is derived from returned job results.
- The notification page can load or reload from an authoritative snapshot.
- Minimal job state survives service-worker interruption, and uncertain active
  work becomes visibly `INTERRUPTED` rather than being replayed silently.
- `ProgramController` and `AutoQueue` are removed.
- `background.js` primarily composes Chrome adapters and the job runner.
- LIST jobs execute the exact input captured when they were enqueued.
- Jobs execute with a settings snapshot rather than mutable mid-job settings.
- Update handling no longer clears all extension storage.
- Dead analytics/unused code is removed.
- `web_accessible_resources` contains only verified required resources.
- Existing scraper tests and the new lifecycle/UI-state tests pass.
- All existing user workflows listed in the manual verification section still
  work.
