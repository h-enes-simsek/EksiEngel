# Job processing refactor

The refactor is intentionally incremental. The extension should remain usable
after every step, and structural moves should be kept separate from behavior
changes whenever possible.

## Migration checklist

- [x] Replace `processHandler` positional parameters with an explicit `JobRequest`.
- [x] Queue explicit job records instead of decorated functions.
- [x] Add a `JobManager` around the existing process handler.
- [ ] Add one `AbortController` and terminal result per active job. *(controller added; terminal job result deferred)*
- [ ] Propagate cancellation through fetches, pagination, and cooldown delays. *(relation and scraping fetches plus scraping pagination added; cooldown delays deferred)*
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
being added incrementally: each active process now owns an `AbortController`,
and relation actions report whether they were performed and whether they
succeeded. Relation and scraping requests use the controller, and the new
scraping handler propagates cancellation through bounded pagination. Terminal
job results and abortable cooldown delays are deferred.
