# Job processing refactor

The refactor is intentionally incremental. The extension should remain usable
after every step, and structural moves should be kept separate from behavior
changes whenever possible.

## Migration checklist

- [x] Replace `processHandler` positional parameters with an explicit `JobRequest`.
- [x] Queue explicit job records instead of decorated functions.
- [x] Add a `JobManager` around the existing process handler.
- [ ] Add one `AbortController` and terminal result per active job.
- [ ] Propagate cancellation through fetches, pagination, and cooldown delays.
- [ ] Move telemetry outside the critical job lifecycle.
- [ ] Extract the shared relation execution and retry loop.
- [ ] Extract source collectors, beginning with `SINGLE` and `LIST`.
- [ ] Add an authoritative job-state snapshot for the notification UI.
- [ ] Remove `ProgramController` and the legacy queue after migration.
- [ ] Persist minimal state and handle service-worker interruptions.

## Current step

`JobManager` now creates job records, submits them to the existing `AutoQueue`,
and exposes the waiting count, notification projection, running state, and
queue clearing through one application-facing interface. `background.js`
uses this facade instead of manipulating the queue directly after composition.
`ProgramController` still reads the legacy queue during cancellation; moving
that behavior belongs to the next cancellation step.
