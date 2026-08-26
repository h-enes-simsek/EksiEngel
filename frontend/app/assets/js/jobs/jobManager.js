import {createJob} from './job.js';

// Application-facing facade for the existing serial process queue.
export class JobManager
{
  constructor({queue, executeJob})
  {
    this._queue = queue;
    this._executeJob = executeJob;
    this._activeExecution = null;
  }

  enqueue(request)
  {
    const job = createJob(request);
    const completion = this._queue.enqueue(
      job,
      queuedJob => this._executeQueuedJob(queuedJob)
    );

    return {job, completion};
  }

  async _executeQueuedJob(job)
  {
    const activeExecution = {
      job,
      abortController: new AbortController(),
      result: null
    };
    this._activeExecution = activeExecution;

    try
    {
      activeExecution.result = await this._executeJob(job, {
        signal: activeExecution.abortController.signal
      });
      return activeExecution.result;
    }
    finally
    {
      if(this._activeExecution === activeExecution)
        this._activeExecution = null;
    }
  }

  cancelActive(reason)
  {
    const abortController = this._activeExecution?.abortController;
    if(!abortController || abortController.signal.aborted)
      return false;

    abortController.abort(reason);
    return true;
  }

  clearWaiting()
  {
    this._queue.clear();
  }

  get waitingCount()
  {
    return this._queue.size;
  }

  get waitingJobAttributes()
  {
    return this._queue.itemAttributes;
  }

  get isRunning()
  {
    return this._queue.isRunning;
  }

  get activeJob()
  {
    return this._activeExecution?.job ?? null;
  }
}
