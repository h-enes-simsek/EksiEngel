/**
 * Normalized input for one queued Ekşi Engel process.
 *
 * Fields that do not apply to a particular ban source remain undefined. This
 * intentionally matches the current message contract while replacing the
 * positional processHandler arguments with one explicit object.
 *
 * @typedef {Object} JobRequest
 * @property {string} banSource
 * @property {string} banMode
 * @property {string} [entryUrl]
 * @property {string} [authorName]
 * @property {string} [authorId]
 * @property {string} [targetType]
 * @property {string} [clickSource]
 * @property {string} [titleName]
 * @property {string} [titleId]
 * @property {string} [timeSpecifier]
 * @property {string} [authorListText]
 */

/**
 * Copy an accepted runtime message into the request shape used by the process
 * manager. Source-specific validation will be introduced in a later refactor.
 *
 * @param {JobRequest} message
 * @returns {JobRequest}
 */
export function createJobRequest(message)
{
  return {
    banSource: message.banSource,
    banMode: message.banMode,
    entryUrl: message.entryUrl,
    authorName: message.authorName,
    authorId: message.authorId,
    targetType: message.targetType,
    clickSource: message.clickSource,
    titleName: message.titleName,
    titleId: message.titleId,
    timeSpecifier: message.timeSpecifier,
    authorListText: message.authorListText
  };
}
