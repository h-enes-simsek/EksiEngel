import {createJob} from './job.js';

// Application-facing facade for the existing serial process queue.
export class JobManager
{
  constructor({queue, executeJob})
  {
    this._queue = queue;
    this._executeJob = executeJob;
  }

  enqueue(request)
  {
    const job = createJob(request);
    const completion = this._queue.enqueue(
      job,
      queuedJob => this._executeJob(queuedJob)
    );

    return {job, completion};
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
}
