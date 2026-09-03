import {ProcessFinishReason} from '../enums.js';

/**
 * Data kept by JobManager for one requested operation.
 * Runtime state, such as AbortController, is intentionally kept outside this
 * serializable record.
 *
 * @typedef {Object} Job
 * @property {string} id
 * @property {Object} request
 * @property {Readonly<Object>} settings
 * @property {string} createdAt
 * @property {string} creationDateInStr
 */

function deepFreeze(value)
{
  if(!value || typeof value !== 'object' || Object.isFrozen(value))
    return value;

  for(const nestedValue of Object.values(value))
    deepFreeze(nestedValue);

  return Object.freeze(value);
}

/**
 * Create a serializable job record from an accepted request.
 *
 * @param {Object} request
 * @param {Object} settings
 * @returns {Job}
 */
export function createJob(request, settings)
{
  if(!settings || typeof settings !== 'object' || Array.isArray(settings))
    throw new TypeError('settings must be an object');

  const createdAt = new Date();
  const settingsSnapshot = deepFreeze(structuredClone(settings));

  return {
    id: crypto.randomUUID(),
    request,
    settings: settingsSnapshot,
    createdAt: createdAt.toISOString(),
    creationDateInStr: createdAt.getHours() + ":" + createdAt.getMinutes()
  };
}

/**
 * Immutable result created exactly once after a job reaches a terminal state.
 * `finishReason` is authoritative; a separate status would duplicate it and
 * could introduce contradictory result states.
 *
 * @typedef {Object} JobResult
 * @property {string} jobId
 * @property {string} finishReason
 * @property {number} successfulAction
 * @property {number} performedAction
 * @property {number} plannedAction
 * @property {string} completedAt
 * @property {string|null} errorMessage
 */

function requireNonNegativeInteger(value, fieldName)
{
  if(!Number.isInteger(value) || value < 0)
    throw new TypeError(`${fieldName} must be a non-negative integer`);
}

/**
 * Create a serializable terminal result for a job.
 *
 * @param {Job} job
 * @param {Object} result
 * @param {string} result.finishReason
 * @param {number} [result.successfulAction=0]
 * @param {number} [result.performedAction=0]
 * @param {number} [result.plannedAction=0]
 * @param {Date|string|number} [result.completedAt]
 * @param {string|null} [result.errorMessage=null]
 * @returns {Readonly<JobResult>}
 */
export function createJobResult(job, {
  finishReason,
  successfulAction = 0,
  performedAction = 0,
  plannedAction = 0,
  completedAt = new Date(),
  errorMessage = null
} = {})
{
  if(typeof job?.id !== 'string' || job.id.length === 0)
    throw new TypeError('job must have a non-empty string id');

  if(finishReason === ProcessFinishReason.NOT_SET ||
     !Object.values(ProcessFinishReason).includes(finishReason))
    throw new TypeError('finishReason must identify a terminal process result');

  requireNonNegativeInteger(successfulAction, 'successfulAction');
  requireNonNegativeInteger(performedAction, 'performedAction');
  requireNonNegativeInteger(plannedAction, 'plannedAction');

  if(successfulAction > performedAction || performedAction > plannedAction)
    throw new RangeError('action counters must satisfy successful <= performed <= planned');

  if(errorMessage !== null && typeof errorMessage !== 'string')
    throw new TypeError('errorMessage must be a string or null');

  const completedDate = new Date(completedAt);
  if(Number.isNaN(completedDate.getTime()))
    throw new TypeError('completedAt must be a valid date');

  return Object.freeze({
    jobId: job.id,
    finishReason,
    successfulAction,
    performedAction,
    plannedAction,
    completedAt: completedDate.toISOString(),
    errorMessage
  });
}
