/**
 * Data kept by the process queue for one requested operation.
 * Execution state and cancellation will be added in a later step.
 *
 * @typedef {Object} Job
 * @property {string} id
 * @property {Object} request
 * @property {string} createdAt
 * @property {string} creationDateInStr
 */

/**
 * Create a serializable job record from an accepted request.
 *
 * @param {Object} request
 * @returns {Job}
 */
export function createJob(request)
{
  const createdAt = new Date();

  return {
    id: crypto.randomUUID(),
    request,
    createdAt: createdAt.toISOString(),
    creationDateInStr: createdAt.getHours() + ":" + createdAt.getMinutes()
  };
}
