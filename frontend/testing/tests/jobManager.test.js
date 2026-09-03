import {describe, expect, it, vi} from 'vitest';

import {JobPhase, ProcessFinishReason} from '../../app/assets/js/enums.js';
import {createJobResult} from '../../app/assets/js/jobs/job.js';
import {JobManager} from '../../app/assets/js/jobs/jobManager.js';

function deferred()
{
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) =>
  {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {promise, resolve, reject};
}

function request(sequence)
{
  return {
    banSource: `source-${sequence}`,
    banMode: `mode-${sequence}`
  };
}

function successResult(job)
{
  return createJobResult(job, {
    finishReason: ProcessFinishReason.SUCCESS
  });
}

describe('JobManager queue ownership', () =>
{
  it('publishes phase, complete progress, and cooldown reports for the active job', async () =>
  {
    const activeGate = deferred();
    const snapshots = [];
    let reporter;
    const manager = new JobManager({
      executeJob: (job, execution) =>
      {
        reporter = execution.reporter;
        return activeGate.promise;
      },
      publishSnapshot: snapshot => snapshots.push(snapshot)
    });
    const active = manager.enqueue(request(1), {});
    const revisionBeforeReports = manager.getSnapshot().revision;
    const cooldownEndsAt = new Date(Date.now() + 30_000).toISOString();

    expect(Object.isFrozen(reporter)).toBe(true);
    expect(reporter.reportPhase(JobPhase.CHECKING_ACCESS, {source: 'runner'})).toBe(true);
    expect(reporter.reportProgress({
      successfulAction: 1,
      performedAction: 2,
      plannedAction: 3
    })).toBe(true);
    expect(reporter.reportCooldown({remainingSeconds: 30, cooldownEndsAt})).toBe(true);
    expect(reporter.reportCooldown({remainingSeconds: 0, cooldownEndsAt: null})).toBe(true);

    expect(snapshots.slice(-4).map(snapshot => snapshot.revision)).toEqual([
      revisionBeforeReports + 1,
      revisionBeforeReports + 2,
      revisionBeforeReports + 3,
      revisionBeforeReports + 4
    ]);
    expect(snapshots.at(-4).activeJob.phase).toBe(JobPhase.CHECKING_ACCESS);
    expect(snapshots.at(-3).activeJob.progress).toEqual({
      successfulAction: 1,
      performedAction: 2,
      plannedAction: 3
    });
    expect(snapshots.at(-2).activeJob).toMatchObject({
      phase: JobPhase.COOLDOWN,
      cooldownEndsAt
    });
    expect(snapshots.at(-1).activeJob).toMatchObject({
      phase: JobPhase.EXECUTING_RELATIONS,
      cooldownEndsAt: null
    });

    const activeResult = successResult(active.job);
    activeGate.resolve(activeResult);
    await active.completion;
  });

  it('validates complete reporter payloads', async () =>
  {
    const activeGate = deferred();
    let reporter;
    const manager = new JobManager({
      executeJob: (job, execution) =>
      {
        reporter = execution.reporter;
        return activeGate.promise;
      }
    });
    const active = manager.enqueue(request(1), {});

    expect(() => reporter.reportPhase('UNKNOWN')).toThrow(TypeError);
    expect(() => reporter.reportPhase(JobPhase.CHECKING_LOGIN, 'details'))
      .toThrow(TypeError);
    expect(() => reporter.reportProgress({
      successfulAction: 0,
      performedAction: 0
    })).toThrow(TypeError);
    expect(() => reporter.reportProgress({
      successfulAction: 0,
      performedAction: -1,
      plannedAction: 1
    })).toThrow(TypeError);
    expect(() => reporter.reportCooldown({
      remainingSeconds: 10,
      cooldownEndsAt: 'not-a-date'
    })).toThrow(TypeError);

    activeGate.resolve(successResult(active.job));
    await active.completion;
  });

  it('ignores stale and post-cancellation reporter updates', async () =>
  {
    const firstGate = deferred();
    const secondGate = deferred();
    const reporters = [];
    const manager = new JobManager({
      executeJob: (job, {reporter}) =>
      {
        reporters.push(reporter);
        return reporters.length === 1 ? firstGate.promise : secondGate.promise;
      }
    });
    const first = manager.enqueue(request(1), {});
    const second = manager.enqueue(request(2), {});

    expect(reporters[0].reportPhase(JobPhase.CHECKING_ACCESS)).toBe(true);
    firstGate.resolve(successResult(first.job));
    await first.completion;

    const revisionBeforeStaleReport = manager.getSnapshot().revision;
    expect(reporters[0].reportProgress({
      successfulAction: 9,
      performedAction: 9,
      plannedAction: 9
    })).toBe(false);
    expect(manager.getSnapshot().revision).toBe(revisionBeforeStaleReport);

    expect(manager.cancelActive('stop')).toBe(true);
    const cancellingSnapshot = manager.getSnapshot();
    expect(reporters[1].reportPhase(JobPhase.CHECKING_LOGIN)).toBe(false);
    expect(reporters[1].reportCooldown({
      remainingSeconds: 5,
      cooldownEndsAt: new Date(Date.now() + 5_000).toISOString()
    })).toBe(false);
    expect(manager.getSnapshot()).toEqual(cancellingSnapshot);

    secondGate.resolve(createJobResult(second.job, {
      finishReason: ProcessFinishReason.CANCELLED
    }));
    await second.completion;
  });

  it('runs accepted jobs one at a time in FIFO order', async () =>
  {
    const gates = new Map();
    const started = [];
    const executeJob = vi.fn(job =>
    {
      const gate = deferred();
      gates.set(job.id, gate);
      started.push(job.id);
      return gate.promise;
    });
    const manager = new JobManager({executeJob});

    const first = manager.enqueue(request(1), {});
    const second = manager.enqueue(request(2), {});
    const third = manager.enqueue(request(3), {});

    expect(started).toEqual([first.job.id]);
    expect(manager.activeJob).toBe(first.job);
    expect(manager.waitingCount).toBe(2);
    expect(manager.waitingJobAttributes).toEqual([
      {
        banSource: second.job.request.banSource,
        banMode: second.job.request.banMode,
        creationDateInStr: second.job.creationDateInStr
      },
      {
        banSource: third.job.request.banSource,
        banMode: third.job.request.banMode,
        creationDateInStr: third.job.creationDateInStr
      }
    ]);

    const firstResult = successResult(first.job);
    gates.get(first.job.id).resolve(firstResult);
    await expect(first.completion).resolves.toBe(firstResult);

    expect(started).toEqual([first.job.id, second.job.id]);
    expect(manager.activeJob).toBe(second.job);
    expect(manager.waitingCount).toBe(1);

    const secondResult = successResult(second.job);
    gates.get(second.job.id).resolve(secondResult);
    await expect(second.completion).resolves.toBe(secondResult);

    expect(started).toEqual([first.job.id, second.job.id, third.job.id]);
    expect(manager.activeJob).toBe(third.job);

    const thirdResult = successResult(third.job);
    gates.get(third.job.id).resolve(thirdResult);
    await expect(third.completion).resolves.toBe(thirdResult);

    expect(manager.isRunning).toBe(false);
    expect(manager.activeJob).toBeNull();
    expect(manager.waitingCount).toBe(0);
  });

  it('resolves every drained waiting job with one cancellation result', async () =>
  {
    const activeGate = deferred();
    const executeJob = vi.fn(() => activeGate.promise);
    const manager = new JobManager({executeJob});

    const active = manager.enqueue(request(1), {});
    const waiting1 = manager.enqueue(request(2), {});
    const waiting2 = manager.enqueue(request(3), {});

    const drainedResults = manager.clearWaiting();

    expect(drainedResults).toHaveLength(2);
    expect(manager.clearWaiting()).toEqual([]);
    expect(manager.waitingCount).toBe(0);
    expect(executeJob).toHaveBeenCalledTimes(1);

    const [waiting1Result, waiting2Result] = await Promise.all([
      waiting1.completion,
      waiting2.completion
    ]);

    expect(waiting1Result).toBe(drainedResults[0]);
    expect(waiting2Result).toBe(drainedResults[1]);
    expect(waiting1Result).toMatchObject({
      jobId: waiting1.job.id,
      finishReason: ProcessFinishReason.CANCELLED,
      successfulAction: 0,
      performedAction: 0,
      plannedAction: 0,
      errorMessage: null
    });
    expect(waiting2Result).toMatchObject({
      jobId: waiting2.job.id,
      finishReason: ProcessFinishReason.CANCELLED,
      successfulAction: 0,
      performedAction: 0,
      plannedAction: 0,
      errorMessage: null
    });
    expect(Object.isFrozen(waiting1Result)).toBe(true);
    expect(Object.isFrozen(waiting2Result)).toBe(true);
    expect(manager.getSnapshot()).toMatchObject({
      activeJob: {
        job: {id: active.job.id}
      },
      waitingJobs: [],
      completedJobs: [
        {
          job: {id: waiting1.job.id},
          result: {finishReason: ProcessFinishReason.CANCELLED}
        },
        {
          job: {id: waiting2.job.id},
          result: {finishReason: ProcessFinishReason.CANCELLED}
        }
      ]
    });

    const activeResult = successResult(active.job);
    activeGate.resolve(activeResult);
    await expect(active.completion).resolves.toBe(activeResult);

    expect(executeJob).toHaveBeenCalledTimes(1);
  });

  it('converts a failed execution to UNEXPECTED_ERROR and continues', async () =>
  {
    const failure = new Error('runner failed');
    const executeJob = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(job => successResult(job));
    const manager = new JobManager({executeJob});

    const first = manager.enqueue(request(1), {});
    const second = manager.enqueue(request(2), {});

    await expect(first.completion).resolves.toMatchObject({
      jobId: first.job.id,
      finishReason: ProcessFinishReason.UNEXPECTED_ERROR,
      successfulAction: 0,
      performedAction: 0,
      plannedAction: 0,
      errorMessage: failure.message
    });
    await expect(second.completion).resolves.toMatchObject({
      jobId: second.job.id,
      finishReason: ProcessFinishReason.SUCCESS
    });
    expect(executeJob.mock.calls.map(([job]) => job.id)).toEqual([
      first.job.id,
      second.job.id
    ]);
    expect(manager.isRunning).toBe(false);
  });

  it('marks and aborts the active execution once without draining waiting jobs', async () =>
  {
    const activeGate = deferred();
    const snapshots = [];
    let activeSignal;
    const manager = new JobManager({
      executeJob: vi.fn((job, {signal}) =>
      {
        activeSignal = signal;
        return activeGate.promise;
      }),
      publishSnapshot: snapshot => snapshots.push(snapshot)
    });
    const active = manager.enqueue(request(1), {});
    const waiting = manager.enqueue(request(2), {});
    const snapshotCountBeforeCancellation = snapshots.length;

    expect(manager.cancelActive('requested')).toBe(true);
    expect(manager.cancelActive('requested again')).toBe(false);
    expect(snapshots).toHaveLength(snapshotCountBeforeCancellation + 1);
    expect(snapshots.at(-1)).toMatchObject({
      activeJob: {
        job: {id: active.job.id},
        phase: JobPhase.CANCELLING,
        cooldownEndsAt: null,
        cancelRequested: true
      },
      waitingJobs: [{id: waiting.job.id}]
    });
    expect(activeSignal.aborted).toBe(true);
    expect(activeSignal.reason).toBe('requested');
    expect(manager.waitingCount).toBe(1);

    manager.clearWaiting();
    await waiting.completion;
    const activeResult = createJobResult(active.job, {
      finishReason: ProcessFinishReason.CANCELLED
    });
    activeGate.resolve(activeResult);
    await expect(active.completion).resolves.toBe(activeResult);
  });

  it('cancels active and waiting jobs through one consistent snapshot', async () =>
  {
    const activeGate = deferred();
    const snapshots = [];
    let activeSignal;
    const manager = new JobManager({
      executeJob: vi.fn((job, {signal}) =>
      {
        activeSignal = signal;
        return activeGate.promise;
      }),
      publishSnapshot: snapshot => snapshots.push(snapshot)
    });
    const active = manager.enqueue(request(1), {});
    const waiting1 = manager.enqueue(request(2), {});
    const waiting2 = manager.enqueue(request(3), {});
    const snapshotCountBeforeCancellation = snapshots.length;

    expect(manager.cancelAll('cancel everything')).toBe(true);
    expect(manager.cancelAll('cancel again')).toBe(false);

    expect(snapshots).toHaveLength(snapshotCountBeforeCancellation + 1);
    expect(activeSignal.aborted).toBe(true);
    expect(activeSignal.reason).toBe('cancel everything');
    expect(snapshots.at(-1)).toMatchObject({
      activeJob: {
        job: {id: active.job.id},
        phase: JobPhase.CANCELLING,
        progress: {
          successfulAction: 0,
          performedAction: 0,
          plannedAction: 0
        },
        cooldownEndsAt: null,
        cancelRequested: true
      },
      waitingJobs: [],
      completedJobs: [
        {
          job: {id: waiting1.job.id},
          result: {
            jobId: waiting1.job.id,
            finishReason: ProcessFinishReason.CANCELLED,
            successfulAction: 0,
            performedAction: 0,
            plannedAction: 0
          }
        },
        {
          job: {id: waiting2.job.id},
          result: {
            jobId: waiting2.job.id,
            finishReason: ProcessFinishReason.CANCELLED,
            successfulAction: 0,
            performedAction: 0,
            plannedAction: 0
          }
        }
      ]
    });
    await expect(waiting1.completion).resolves.toMatchObject({
      jobId: waiting1.job.id,
      finishReason: ProcessFinishReason.CANCELLED
    });
    await expect(waiting2.completion).resolves.toMatchObject({
      jobId: waiting2.job.id,
      finishReason: ProcessFinishReason.CANCELLED
    });

    const activeResult = createJobResult(active.job, {
      finishReason: ProcessFinishReason.CANCELLED,
      successfulAction: 2,
      performedAction: 3,
      plannedAction: 5
    });
    activeGate.resolve(activeResult);
    await expect(active.completion).resolves.toBe(activeResult);
    expect(manager.getSnapshot().completedJobs.at(-1)).toEqual({
      job: expect.objectContaining({id: active.job.id}),
      result: activeResult
    });
  });

  it('publishes terminal state before settling and starting the next job', async () =>
  {
    const firstGate = deferred();
    const events = [];
    let executionCount = 0;
    let third;
    let enqueuedFromPublisher = false;
    const manager = new JobManager({
      executeJob: job =>
      {
        executionCount++;
        if(executionCount === 1)
          return firstGate.promise;

        events.push(`start:${job.id}`);
        return successResult(job);
      },
      publishSnapshot: snapshot =>
      {
        if(snapshot.completedJobs.length === 1 &&
           snapshot.activeJob === null &&
           !enqueuedFromPublisher)
        {
          enqueuedFromPublisher = true;
          events.push('publish:terminal');
          third = manager.enqueue(request(3), {});
        }
      }
    });
    const originalSettleEntry = manager._settleEntry.bind(manager);
    vi.spyOn(manager, '_settleEntry').mockImplementation((entry, method, value) =>
    {
      events.push(`settle:${entry.job.id}`);
      return originalSettleEntry(entry, method, value);
    });

    const first = manager.enqueue(request(1), {});
    const second = manager.enqueue(request(2), {});
    const firstResult = successResult(first.job);
    firstGate.resolve(firstResult);

    await expect(first.completion).resolves.toBe(firstResult);
    await second.completion;
    await third.completion;

    expect(events.slice(0, 3)).toEqual([
      'publish:terminal',
      `settle:${first.job.id}`,
      `start:${second.job.id}`
    ]);
    expect(manager.getSnapshot().completedJobs.map(({job}) => job.id)).toEqual([
      first.job.id,
      second.job.id,
      third.job.id
    ]);
  });

  it('publishes increasing revisions for queue, start, and terminal changes', async () =>
  {
    const activeGate = deferred();
    const snapshots = [];
    const manager = new JobManager({
      executeJob: job => activeGate.promise.then(() => successResult(job)),
      publishSnapshot: snapshot => snapshots.push(snapshot)
    });

    const active = manager.enqueue(request(1), {});
    const waiting = manager.enqueue(request(2), {});

    expect(snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2, 3]);
    expect(snapshots[0]).toMatchObject({
      activeJob: null,
      waitingJobs: [{id: active.job.id}],
      completedJobs: []
    });
    expect(snapshots[1]).toMatchObject({
      activeJob: {
        job: {id: active.job.id},
        phase: JobPhase.PREPARING
      },
      waitingJobs: []
    });
    expect(snapshots[2].waitingJobs).toEqual([
      expect.objectContaining({id: waiting.job.id})
    ]);

    manager.clearWaiting();
    await waiting.completion;
    activeGate.resolve();
    await active.completion;

    expect(snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns detached immutable snapshots without private execution data', async () =>
  {
    const activeGate = deferred();
    const manager = new JobManager({executeJob: () => activeGate.promise});
    const active = manager.enqueue({
      banSource: 'private-source',
      banMode: 'private-mode',
      authorListText: 'must-not-be-public'
    }, {
      secretSetting: 'must-not-be-public'
    });

    const snapshot = manager.getSnapshot();
    const serialized = JSON.stringify(snapshot);

    expect(snapshot).toEqual({
      revision: 2,
      activeJob: {
        job: {
          id: active.job.id,
          banSource: 'private-source',
          banMode: 'private-mode',
          createdAt: active.job.createdAt
        },
        phase: JobPhase.PREPARING,
        progress: {
          successfulAction: 0,
          performedAction: 0,
          plannedAction: 0
        },
        cooldownEndsAt: null,
        cancelRequested: false
      },
      waitingJobs: [],
      completedJobs: []
    });
    expect(serialized).not.toContain('must-not-be-public');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.activeJob)).toBe(true);
    expect(Object.isFrozen(snapshot.activeJob.job)).toBe(true);
    expect(Object.isFrozen(snapshot.activeJob.progress)).toBe(true);
    expect(() => snapshot.waitingJobs.push({})).toThrow(TypeError);

    const activeResult = successResult(active.job);
    activeGate.resolve(activeResult);
    await active.completion;

    expect(snapshot.completedJobs).toEqual([]);
    expect(manager.getSnapshot().completedJobs).toHaveLength(1);
  });

  it('bounds completed history and preserves the newest terminal records', async () =>
  {
    const manager = new JobManager({
      executeJob: job => successResult(job),
      completedHistoryLimit: 2
    });

    const first = manager.enqueue(request(1), {});
    const second = manager.enqueue(request(2), {});
    const third = manager.enqueue(request(3), {});
    await Promise.all([first.completion, second.completion, third.completion]);

    const snapshot = manager.getSnapshot();
    expect(snapshot.completedJobs.map(({job}) => job.id)).toEqual([
      second.job.id,
      third.job.id
    ]);
    expect(snapshot.completedJobs.map(({result}) => result.jobId)).toEqual([
      second.job.id,
      third.job.id
    ]);
  });
});
