import {JobPhase, ProcessFinishReason} from '../enums.js';
import {createJob, createJobResult} from './job.js';

const DEFAULT_COMPLETED_HISTORY_LIMIT = 50;
const JOB_PHASES = new Set(Object.values(JobPhase));
const PROGRESS_FIELDS = [
  'successfulAction',
  'performedAction',
  'plannedAction'
];

function deepFreeze(value)
{
  if(!value || typeof value !== 'object' || Object.isFrozen(value))
    return value;

  for(const nestedValue of Object.values(value))
    deepFreeze(nestedValue);

  return Object.freeze(value);
}

function createJobSummary(job)
{
  return {
    id: job.id,
    banSource: job.request.banSource,
    banMode: job.request.banMode,
    createdAt: job.createdAt
  };
}

function errorMessage(error)
{
  return error instanceof Error ? error.message : String(error);
}

function validateProgress(progress)
{
  if(!progress || typeof progress !== 'object' || Array.isArray(progress))
    throw new TypeError('progress must be an object');

  for(const field of PROGRESS_FIELDS)
  {
    if(!Number.isInteger(progress[field]) || progress[field] < 0)
      throw new TypeError(`${field} must be a non-negative integer`);
  }
}

function validateCooldown({remainingSeconds, cooldownEndsAt} = {})
{
  if(!Number.isInteger(remainingSeconds) || remainingSeconds < 0)
    throw new TypeError('remainingSeconds must be a non-negative integer');
  if(cooldownEndsAt !== null &&
     (typeof cooldownEndsAt !== 'string' || Number.isNaN(Date.parse(cooldownEndsAt))))
    throw new TypeError('cooldownEndsAt must be an ISO timestamp or null');
}

// Owns accepted jobs, their completion callbacks, and serial execution.
export class JobManager
{
  constructor({
    executeJob,
    publishSnapshot = null,
    completedHistoryLimit = DEFAULT_COMPLETED_HISTORY_LIMIT
  })
  {
    if(typeof executeJob !== 'function')
      throw new TypeError('executeJob must be a function');
    if(publishSnapshot !== null && typeof publishSnapshot !== 'function')
      throw new TypeError('publishSnapshot must be a function or null');
    if(!Number.isInteger(completedHistoryLimit) || completedHistoryLimit <= 0)
      throw new TypeError('completedHistoryLimit must be a positive integer');

    this._executeJob = executeJob;
    this._publishSnapshot = publishSnapshot;
    this._completedHistoryLimit = completedHistoryLimit;
    this._waitingEntries = [];
    this._completedRecords = [];
    this._activeExecution = null;
    this._isPumping = false;
    this._nextAcceptanceOrder = 0;
    this._revision = 0;
  }

  enqueue(request, settings)
  {
    const job = createJob(request, settings);
    let entry;
    const completion = new Promise((resolve, reject) =>
    {
      entry = {
        job,
        resolve,
        reject,
        settled: false,
        acceptanceOrder: this._nextAcceptanceOrder++
      };
    });

    this._waitingEntries.push(entry);
    this._commitVisibleState();
    void this._pump();

    return {job, completion};
  }

  async _pump()
  {
    if(this._activeExecution || this._isPumping)
      return false;

    const entry = this._waitingEntries.shift();
    if(!entry)
      return false;

    this._isPumping = true;

    const activeExecution = {
      entry,
      job: entry.job,
      abortController: new AbortController(),
      result: null,
      displayState: {
        job: createJobSummary(entry.job),
        phase: JobPhase.PREPARING,
        progress: {
          successfulAction: 0,
          performedAction: 0,
          plannedAction: 0
        },
        cooldownEndsAt: null,
        cancelRequested: false
      }
    };
    this._activeExecution = activeExecution;
    this._commitVisibleState();

    let result;
    try
    {
      result = await this._executeJob(entry.job, {
        signal: activeExecution.abortController.signal,
        reporter: this._createReporter(activeExecution)
      });
    }
    catch(error)
    {
      result = createJobResult(entry.job, {
        finishReason: ProcessFinishReason.UNEXPECTED_ERROR,
        errorMessage: errorMessage(error)
      });
    }

    activeExecution.result = result;
    this._recordCompleted(entry, result);

    if(this._activeExecution === activeExecution)
      this._activeExecution = null;

    this._commitVisibleState();
    this._settleEntry(entry, 'resolve', result);
    this._isPumping = false;
    void this._pump();

    return true;
  }

  _createReporter(activeExecution)
  {
    return Object.freeze({
      reportPhase: (phase, details) =>
        this._reportPhase(activeExecution, phase, details),
      reportProgress: progress =>
        this._reportProgress(activeExecution, progress),
      reportCooldown: cooldown =>
        this._reportCooldown(activeExecution, cooldown)
    });
  }

  _canAcceptReport(activeExecution)
  {
    return this._activeExecution === activeExecution &&
      !activeExecution.displayState.cancelRequested;
  }

  _reportPhase(activeExecution, phase, details)
  {
    if(!this._canAcceptReport(activeExecution))
      return false;
    if(!JOB_PHASES.has(phase))
      throw new TypeError('phase must be a JobPhase');
    if(details !== undefined &&
       (!details || typeof details !== 'object' || Array.isArray(details)))
      throw new TypeError('details must be an object when provided');

    activeExecution.displayState.phase = phase;
    if(phase !== JobPhase.COOLDOWN)
      activeExecution.displayState.cooldownEndsAt = null;
    this._commitVisibleState();
    return true;
  }

  _reportProgress(activeExecution, progress)
  {
    if(!this._canAcceptReport(activeExecution))
      return false;

    validateProgress(progress);
    activeExecution.displayState.progress = {
      successfulAction: progress.successfulAction,
      performedAction: progress.performedAction,
      plannedAction: progress.plannedAction
    };
    this._commitVisibleState();
    return true;
  }

  _reportCooldown(activeExecution, cooldown)
  {
    if(!this._canAcceptReport(activeExecution))
      return false;

    validateCooldown(cooldown);
    activeExecution.displayState.phase = cooldown.cooldownEndsAt === null
      ? JobPhase.EXECUTING_RELATIONS
      : JobPhase.COOLDOWN;
    activeExecution.displayState.cooldownEndsAt = cooldown.cooldownEndsAt;
    this._commitVisibleState();
    return true;
  }

  _recordCompleted(entry, result)
  {
    this._completedRecords.push(Object.freeze({
      job: Object.freeze(createJobSummary(entry.job)),
      result,
      acceptanceOrder: entry.acceptanceOrder
    }));
    this._completedRecords.sort((left, right) =>
      right.acceptanceOrder - left.acceptanceOrder
    );

    const overflow = this._completedRecords.length - this._completedHistoryLimit;
    if(overflow > 0)
      this._completedRecords.splice(this._completedHistoryLimit, overflow);
  }

  _commitVisibleState()
  {
    this._revision++;
    const snapshot = this.getSnapshot();

    if(this._publishSnapshot)
    {
      try
      {
        const publication = this._publishSnapshot(snapshot);
        if(publication && typeof publication.catch === 'function')
          void publication.catch(error => console.error('Job snapshot publication failed:', error));
      }
      catch(error)
      {
        console.error('Job snapshot publication failed:', error);
      }
    }

    return snapshot;
  }

  _settleEntry(entry, method, value)
  {
    if(entry.settled)
      return false;

    entry.settled = true;
    entry[method](value);
    return true;
  }

  _requestActiveCancellation(reason)
  {
    const activeExecution = this._activeExecution;
    const abortController = activeExecution?.abortController;
    if(!abortController || abortController.signal.aborted)
      return false;

    activeExecution.displayState.phase = JobPhase.CANCELLING;
    activeExecution.displayState.cooldownEndsAt = null;
    activeExecution.displayState.cancelRequested = true;
    abortController.abort(reason);
    return true;
  }

  _drainWaiting()
  {
    const drainedEntries = this._waitingEntries.splice(0);
    const drainedResults = drainedEntries.map(entry =>
    {
      const result = createJobResult(entry.job, {
        finishReason: ProcessFinishReason.CANCELLED
      });
      this._recordCompleted(entry, result);
      return result;
    });

    return {drainedEntries, drainedResults};
  }

  _settleDrainedEntries(drainedEntries, drainedResults)
  {
    drainedEntries.forEach((entry, index) =>
      this._settleEntry(entry, 'resolve', drainedResults[index])
    );
  }

  cancelActive(reason)
  {
    if(!this._requestActiveCancellation(reason))
      return false;

    this._commitVisibleState();
    return true;
  }

  cancelAll(reason)
  {
    const activeCancellationRequested = this._requestActiveCancellation(reason);
    const {drainedEntries, drainedResults} = this._drainWaiting();

    if(!activeCancellationRequested && drainedEntries.length === 0)
      return false;

    this._commitVisibleState();
    this._settleDrainedEntries(drainedEntries, drainedResults);
    return true;
  }

  clearWaiting()
  {
    const {drainedEntries, drainedResults} = this._drainWaiting();
    if(drainedEntries.length === 0)
      return drainedResults;

    this._commitVisibleState();
    this._settleDrainedEntries(drainedEntries, drainedResults);
    return drainedResults;
  }

  getSnapshot()
  {
    return deepFreeze(structuredClone({
      revision: this._revision,
      activeJob: this._activeExecution?.displayState ?? null,
      waitingJobs: this._waitingEntries.map(({job}) => createJobSummary(job)),
      completedJobs: this._completedRecords.map(({job, result}) => ({job, result}))
    }));
  }

  get waitingCount()
  {
    return this._waitingEntries.length;
  }

  get waitingJobAttributes()
  {
    return this._waitingEntries.map(({job}) => ({
      banSource: job.request.banSource,
      banMode: job.request.banMode,
      creationDateInStr: job.creationDateInStr
    }));
  }

  get isRunning()
  {
    return this._activeExecution !== null;
  }

  get activeJob()
  {
    return this._activeExecution?.job ?? null;
  }
}
