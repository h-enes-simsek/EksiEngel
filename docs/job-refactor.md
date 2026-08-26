# Job processing refactor

The refactor is intentionally incremental. The extension should remain usable
after every step, and structural moves should be kept separate from behavior
changes whenever possible.

## Migration checklist

- [x] Replace `processHandler` positional parameters with an explicit `JobRequest`.
- [x] Queue explicit job records instead of decorated functions.
- [x] Add a `JobManager` around the existing process handler.
- [x] Add one `AbortController` and terminal result per active job.
- [x] Propagate cancellation through fetches, pagination, and cooldown delays.
- [x] Move telemetry outside the critical job lifecycle.
- [ ] Extract the shared relation execution and retry loop.
- [ ] Extract source collectors, beginning with `SINGLE` and `LIST`.
- [ ] Add an authoritative job-state snapshot for the notification UI.
- [ ] Remove `ProgramController` and the legacy queue after migration.
- [ ] Persist minimal state and handle service-worker interruptions.

## Current step

Completed jobs now capture an immutable telemetry snapshot before their local
state and logs are reset. Delivery is submitted through `JobTelemetryReporter`
without being awaited by the process handler, so a slow telemetry request no
longer prevents the queue from starting its next job. Delivery remains
best-effort until service-worker persistence is implemented. Cancellation is
being added incrementally: `JobManager` now creates one `AbortController` when
a queued job becomes active, passes its signal into process execution, and
clears the private active execution after settlement. `ProgramController`
temporarily remains as the Chrome-message bridge but delegates cancellation to
`JobManager`. Relation actions report whether they were performed and whether
they succeeded. Relation and scraping requests use the active job's signal, and
the scraping handler propagates cancellation through bounded pagination.
Every process exit now resolves the queue completion promise with an immutable
terminal result using one authoritative `finishReason`; cancellation and
unexpected errors have explicit reasons. Relation and scraping fetches,
pagination, action loops, and cooldown timers now share the active job's signal.
