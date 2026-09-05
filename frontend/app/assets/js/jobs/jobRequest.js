import {BanSource, BanMode} from '../enums.js';

/**
 * Normalized input for one queued Ekşi Engel process.
 *
 * Fields that do not apply to a particular ban source may be omitted or null.
 *
 * @typedef {Object} JobRequest
 * @property {string} banSource
 * @property {string} banMode
 * @property {string|null} [entryUrl]
 * @property {string|null} [authorName]
 * @property {string|null} [authorId]
 * @property {string|null} [targetType]
 * @property {string|null} [clickSource]
 * @property {string|null} [titleName]
 * @property {string|null} [titleId]
 * @property {string|null} [timeSpecifier]
 * @property {string|null} [authorListText]
 */

/**
 * Check the payload shape, source/mode values, and supplied field types.
 * Optional fields may be strings, null, or omitted; no source-specific rules
 * or string-format checks are applied.
 *
 * @param {JobRequest} message
 * @returns {JobRequest}
 * @throws {TypeError} If the payload, source/mode, or a supplied field type is invalid.
 */
export function createJobRequest(message)
{
  if(!message || typeof message !== 'object' || Array.isArray(message))
    throw new TypeError('Job request must be an object');
  if(!Object.values(BanSource).includes(message.banSource))
    throw new TypeError('banSource must be a supported BanSource');
  if(!Object.values(BanMode).includes(message.banMode))
    throw new TypeError('banMode must be a supported BanMode');

  const optionalFields = [
    'entryUrl', 'authorName', 'authorId', 'targetType', 'clickSource',
    'titleName', 'titleId', 'timeSpecifier', 'authorListText'
  ];
  for(const field of optionalFields)
  {
    if(message[field] !== undefined && message[field] !== null && typeof message[field] !== 'string')
      throw new TypeError(`${field} must be a string, null, or omitted`);
  }

  const request = {
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

  return request;
}
