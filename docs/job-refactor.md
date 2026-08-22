# Job processing refactor

The refactor is intentionally incremental. The extension should remain usable
after every step, and structural moves should be kept separate from behavior
changes whenever possible.

## Migration checklist

- [x] Replace `processHandler` positional parameters with an explicit `JobRequest`.
- [x] Queue explicit job records instead of decorated functions.
- [x] Add a `JobManager` around the existing process handler.
- [ ] Add one `AbortController` and terminal result per active job. *(deferred)*
- [ ] Propagate cancellation through fetches, pagination, and cooldown delays. *(deferred)*
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
best-effort until service-worker persistence is implemented. The two
cancellation steps are intentionally deferred.
