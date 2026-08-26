import {JSDOM} from './jsdom.js';
import {TimeSpecifier} from './enums.js';

/**
 * Ekşi Sözlük scraping design.
 *
 * Design rules:
 * - The caller owns AbortController; this handler only accepts AbortSignal.
 * - Cancellation and failures reject. They are never converted to empty results.
 * - Empty collections mean a successful request containing no records.
 * - Every HTTP request passes through one request method.
 * - Every paginated operation passes through one bounded paginator.
 * - Public methods express domain operations rather than endpoint details.
 */

const DEFAULT_BASE_URL = 'https://eksisozluk.com';
const DEFAULT_MAX_PAGES = 250;
const DEFAULT_MAX_ITEMS = 50_000;

export const OwnRelationKind = Object.freeze({
  BLOCKED_USER: 'blocked-user',
  BLOCKED_TITLES: 'blocked-titles',
  MUTED: 'muted'
});

const OWN_RELATION_ENDPOINT_CODES = Object.freeze({
  [OwnRelationKind.BLOCKED_USER]: 'm',
  [OwnRelationKind.BLOCKED_TITLES]: 'i',
  [OwnRelationKind.MUTED]: 'u'
});

/**
 * @typedef {Object} AuthorRelation
 * @property {string} authorName
 * @property {string|null} authorId
 * @property {boolean|null} isBlockedUser
 * @property {boolean|null} areTitlesBlocked
 * @property {boolean|null} isMuted
 * @property {boolean|null} isFollowedByCurrentUser
 * @property {boolean|null} followsCurrentUser
 */

/**
 * @typedef {Object} OperationOptions
 * @property {AbortSignal} [signal]
 * @property {{maxPages?: number, maxItems?: number}} [limits]
 */

export class ScrapingError extends Error
{
  constructor(message, {code = 'SCRAPING_ERROR', cause, details = {}} = {})
  {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;

    if(cause !== undefined)
      this.cause = cause;
  }
}

export class NetworkError extends ScrapingError
{
  constructor(message, options = {})
  {
    super(message, {...options, code: 'NETWORK_ERROR'});
  }
}

export class HttpError extends ScrapingError
{
  constructor(message, {url, status, statusText} = {})
  {
    super(message, {
      code: 'HTTP_ERROR',
      details: {url, status, statusText}
    });
  }
}

export class ParseError extends ScrapingError
{
  constructor(message, options = {})
  {
    super(message, {...options, code: 'PARSE_ERROR'});
  }
}

export class PaginationError extends ScrapingError
{
  constructor(message, {code = 'PAGINATION_ERROR', details = {}} = {})
  {
    super(message, {code, details});
  }
}

function defaultParseHtml(html)
{
  return new JSDOM(html).window.document;
}

function normalizeBaseUrl(baseUrl)
{
  const url = new URL(baseUrl);

  if(url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new TypeError('baseUrl must use the HTTP or HTTPS protocol');

  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function requireNonEmptyString(value, name)
{
  if(typeof value !== 'string' || value.trim() === '')
    throw new TypeError(`${name} must be a non-empty string`);

  return value.trim();
}

function requireNumericId(value, name)
{
  const id = requireNonEmptyString(value, name);

  if(!/^\d+$/.test(id))
    throw new TypeError(`${name} must contain only digits`);

  return id;
}

function requirePositiveInteger(value, name)
{
  if(!Number.isInteger(value) || value < 1)
    throw new TypeError(`${name} must be a positive integer`);

  return value;
}

function isAbortError(error)
{
  return error?.name === 'AbortError';
}

function normalizeAuthorName(authorName)
{
  return requireNonEmptyString(authorName, 'authorName').replace(/\s+/g, '-');
}

function normalizeScrapedName(name)
{
  return name.replace(/ /gi, '-');
}

function optionalBoolean(value)
{
  return typeof value === 'boolean' ? value : null;
}

function parseRemoteAuthor(item, context)
{
  const authorName = item?.Nick?.Value;
  const authorId = item?.Id;

  if(typeof authorName !== 'string' || authorName.trim() === '')
  {
    throw new ParseError(`Author name is missing in ${context}`, {
      details: {context}
    });
  }

  if((typeof authorId !== 'string' && typeof authorId !== 'number') || !/^\d+$/.test(String(authorId)))
  {
    throw new ParseError(`Author id is invalid in ${context}`, {
      details: {context, authorId}
    });
  }

  return {
    authorName: normalizeScrapedName(authorName),
    authorId: String(authorId),
    isFollowedByCurrentUser: optionalBoolean(item.IsBuddy),
    followsCurrentUser: optionalBoolean(item.IsFollowCurrentUser)
  };
}

function pageIdentityFromAuthors(authors)
{
  if(authors.length === 0)
    return undefined;

  return authors.map(author => author.authorId).join(',');
}

function textFingerprint(text)
{
  let hash = 2166136261;
  for(let index = 0; index < text.length; index++)
  {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${text.length}:${hash >>> 0}`;
}

function throwIfAborted(signal)
{
  if(!signal?.aborted)
    return;

  if(typeof signal.throwIfAborted === 'function')
    signal.throwIfAborted();

  if(signal.reason !== undefined)
    throw signal.reason;

  throw new DOMException('The operation was aborted', 'AbortError');
}

function createAuthorRelation({
  authorName,
  authorId = null,
  isBlockedUser = null,
  areTitlesBlocked = null,
  isMuted = null,
  isFollowedByCurrentUser = null,
  followsCurrentUser = null
})
{
  return {
    authorName,
    authorId,
    isBlockedUser,
    areTitlesBlocked,
    isMuted,
    isFollowedByCurrentUser,
    followsCurrentUser
  };
}

export class EksiScrapingHandler
{
  #fetch;
  #baseUrl;
  #parseHtml;
  #defaultLimits;

  constructor({
    fetchImpl = (...args) => globalThis.fetch(...args),
    baseUrl = DEFAULT_BASE_URL,
    parseHtml = defaultParseHtml,
    maxPages = DEFAULT_MAX_PAGES,
    maxItems = DEFAULT_MAX_ITEMS
  } = {})
  {
    if(typeof fetchImpl !== 'function')
      throw new TypeError('fetchImpl must be a function');

    if(typeof parseHtml !== 'function')
      throw new TypeError('parseHtml must be a function');

    this.#fetch = fetchImpl;
    this.#baseUrl = normalizeBaseUrl(baseUrl);
    this.#parseHtml = parseHtml;
    this.#defaultLimits = Object.freeze({
      maxPages: requirePositiveInteger(maxPages, 'maxPages'),
      maxItems: requirePositiveInteger(maxItems, 'maxItems')
    });
  }

  /**
   * Returns the authenticated account identity, or null when the successful page
   * explicitly shows that no account is logged in.
   *
   * Requests: homepage + author profile.
   *
   * @param {OperationOptions} [options]
   * @returns {Promise<{authorName: string, authorId: string}|null>}
   */
  async getCurrentAccount(options = {})
  {
    this.#validateOptions(options);
    const {signal} = options;
    const url = this.#buildUrl('/');
    const html = await this.#requestText(url, {signal});
    throwIfAborted(signal);

    const document = this.#documentFromHtml(html, 'current account page');
    const notificationIcons = document.querySelector('.mobile-notification-icons');
    const accountLink = notificationIcons?.querySelector('.mobile-only a');

    if(!accountLink)
      return null;

    const rawAuthorName = accountLink.title;
    if(typeof rawAuthorName !== 'string' || rawAuthorName.trim() === '')
      throw new ParseError('The current account link does not contain an author name');

    const authorName = normalizeScrapedName(rawAuthorName);
    const author = await this.getAuthor(authorName, {signal});

    if(!author)
    {
      throw new ParseError('The current account profile could not be resolved', {
        details: {authorName}
      });
    }

    return author;
  }

  /**
   * Resolves an author name to its numeric identifier and returns the normalized
   * requested name with it.
   *
   * @param {string} authorName
   * @param {OperationOptions} [options]
   * @returns {Promise<{authorName: string, authorId: string}|null>}
   */
  async getAuthor(authorName, options = {})
  {
    const normalizedAuthorName = normalizeAuthorName(authorName);
    this.#validateOptions(options);
    const {signal} = options;
    const url = this.#buildUrl(`/biri/${encodeURIComponent(normalizedAuthorName)}`);

    let html;
    try
    {
      html = await this.#requestText(url, {signal});
    }
    catch(error)
    {
      if(this.#isNotFound(error))
        return null;

      throw error;
    }

    throwIfAborted(signal);
    const document = this.#documentFromHtml(html, `author profile: ${normalizedAuthorName}`);
    const idElement = document.getElementById('who');
    const authorId = idElement?.getAttribute('value');

    if(typeof authorId !== 'string' || !/^\d+$/.test(authorId))
    {
      throw new ParseError('Author profile does not contain a valid author id', {
        details: {authorName: normalizedAuthorName}
      });
    }

    return {authorName: normalizedAuthorName, authorId};
  }

  /**
   * Fetches metadata for a trusted entry identifier. Arbitrary URLs are not
   * accepted; the handler constructs the URL from its configured base URL.
   *
   * @param {string} entryId
   * @param {OperationOptions} [options]
   * @returns {Promise<{entryId: string, authorId: string, authorName: string, titleId: string, titleName: string}|null>}
   */
  async getEntryMetadata(entryId, options = {})
  {
    const normalizedEntryId = requireNumericId(entryId, 'entryId');
    this.#validateOptions(options);
    const {signal} = options;
    const url = this.#buildUrl(`/entry/${normalizedEntryId}`);

    let html;
    try
    {
      html = await this.#requestText(url, {signal});
    }
    catch(error)
    {
      if(this.#isNotFound(error))
        return null;

      throw error;
    }

    throwIfAborted(signal);
    const document = this.#documentFromHtml(html, `entry: ${normalizedEntryId}`);
    const entryList = document.getElementById('entry-item-list');
    const entryElement = entryList?.querySelector('li');
    const titleElement = document.getElementById('title');

    if(!entryElement || !titleElement)
    {
      throw new ParseError('Entry page is missing its entry or title element', {
        details: {entryId: normalizedEntryId}
      });
    }

    const authorId = entryElement.getAttribute('data-author-id');
    const rawAuthorName = entryElement.getAttribute('data-author');
    const titleId = titleElement.getAttribute('data-id');
    const rawTitleName = titleElement.getAttribute('data-title');

    if(typeof authorId !== 'string' || !/^\d+$/.test(authorId) ||
       typeof titleId !== 'string' || !/^\d+$/.test(titleId) ||
       typeof rawAuthorName !== 'string' || rawAuthorName.trim() === '' ||
       typeof rawTitleName !== 'string' || rawTitleName.trim() === '')
    {
      throw new ParseError('Entry page contains invalid metadata', {
        details: {entryId: normalizedEntryId}
      });
    }

    return {
      entryId: normalizedEntryId,
      authorId,
      authorName: normalizeScrapedName(rawAuthorName),
      titleId,
      titleName: normalizeScrapedName(rawTitleName)
    };
  }

  /**
   * @param {string} entryId
   * @param {OperationOptions & {includeNovices?: boolean}} [options]
   * @returns {Promise<Map<string, AuthorRelation>>}
   */
  async listEntryFavoriters(entryId, options = {})
  {
    const normalizedEntryId = requireNumericId(entryId, 'entryId');
    this.#validateOptions(options);

    if(options.includeNovices !== undefined && typeof options.includeNovices !== 'boolean')
      throw new TypeError('options.includeNovices must be a boolean');

    const {signal, includeNovices = false} = options;
    const relations = new Map();
    const regularUrl = this.#buildUrl('/entry/favorileyenler', {
      entryId: normalizedEntryId
    });
    const regularHtml = await this.#requestText(regularUrl, {signal});
    throwIfAborted(signal);

    for(const authorName of this.#parseFavoriterNames(
      regularHtml,
      'entry favorites',
      {skipNoviceSummary: true}
    ))
      relations.set(authorName, createAuthorRelation({authorName}));

    if(includeNovices)
    {
      const noviceUrl = this.#buildUrl('/entry/caylakfavorites', {
        entryId: normalizedEntryId
      });
      const noviceHtml = await this.#requestText(noviceUrl, {signal});
      throwIfAborted(signal);

      for(const authorName of this.#parseFavoriterNames(noviceHtml, 'novice entry favorites'))
        relations.set(authorName, createAuthorRelation({authorName}));
    }

    return relations;
  }

  /**
   * Returns the requested relations belonging to the authenticated account.
   * Multiple relation kinds are merged by author name.
   *
   * @param {Object} [query]
   * @param {string[]} [query.kinds]
   * @param {OperationOptions} [options]
   * @returns {Promise<Map<string, AuthorRelation>>}
   */
  async listOwnRelations(
    {kinds = Object.values(OwnRelationKind)} = {},
    options = {}
  )
  {
    if(!Array.isArray(kinds) || kinds.some(kind => !Object.values(OwnRelationKind).includes(kind)))
      throw new TypeError('kinds contains an unsupported own-relation kind');

    this.#validateOptions(options);
    const {signal, limits} = options;
    const requestedKinds = [...new Set(kinds)];
    const relations = new Map();

    for(const kind of requestedKinds)
    {
      throwIfAborted(signal);
      const endpointCode = OWN_RELATION_ENDPOINT_CODES[kind];
      const authors = await this.#collectPages({
        fetchPage: async (pageIndex, {signal: pageSignal}) =>
        {
          const url = this.#buildUrl('/relation-list', {
            relationType: endpointCode,
            pageIndex
          });
          const json = await this.#requestJson(url, {signal: pageSignal});
          const relationPage = json?.Relations;

          if(!relationPage || !Array.isArray(relationPage.Items) || typeof relationPage.IsLast !== 'boolean')
          {
            throw new ParseError('Own-relation endpoint returned an invalid page', {
              details: {kind, pageIndex}
            });
          }

          return {
            items: relationPage.Items.map((item, itemIndex) =>
              parseRemoteAuthor(item, `own relation ${kind}, page ${pageIndex}, item ${itemIndex}`)
            ),
            isLast: relationPage.IsLast
          };
        },
        getItems: page => page.items,
        isLastPage: page => page.isLast,
        getPageIdentity: page => pageIdentityFromAuthors(page.items),
        signal,
        limits
      });

      for(const author of authors)
      {
        let relation = relations.get(author.authorName);
        if(!relation)
        {
          relation = createAuthorRelation({
            authorName: author.authorName,
            authorId: author.authorId
          });
          relations.set(author.authorName, relation);
        }

        this.#setOwnRelationFlag(relation, kind, true);
      }
    }

    for(const relation of relations.values())
    {
      for(const kind of requestedKinds)
      {
        if(this.#getOwnRelationFlag(relation, kind) === null)
          this.#setOwnRelationFlag(relation, kind, false);
      }
    }

    return relations;
  }

  /**
   * @param {string} authorName
   * @param {OperationOptions} [options]
   * @returns {Promise<Map<string, AuthorRelation>>}
   */
  async listFollowers(authorName, options = {})
  {
    const normalizedAuthorName = normalizeAuthorName(authorName);
    this.#validateOptions(options);
    return this.#listConnections('follower', normalizedAuthorName, options);
  }

  /**
   * @param {string} authorName
   * @param {OperationOptions} [options]
   * @returns {Promise<Map<string, AuthorRelation>>}
   */
  async listFollowing(authorName, options = {})
  {
    const normalizedAuthorName = normalizeAuthorName(authorName);
    this.#validateOptions(options);
    return this.#listConnections('following', normalizedAuthorName, options);
  }

  /**
   * @param {{titleName: string, titleId: string, period?: string}} query
   * @param {OperationOptions} [options]
   * @returns {Promise<Map<string, AuthorRelation>>}
   */
  async listTitleAuthors(
    {titleName, titleId, period = TimeSpecifier.ALL} = {},
    options = {}
  )
  {
    const normalizedTitleName = requireNonEmptyString(titleName, 'titleName').replace(/\s+/g, '-');
    const normalizedTitleId = requireNumericId(titleId, 'titleId');

    if(period !== TimeSpecifier.ALL && period !== TimeSpecifier.LAST_24_H)
      throw new TypeError('period is unsupported');

    this.#validateOptions(options);
    const {signal, limits} = options;
    const authors = await this.#collectPages({
      fetchPage: async (pageIndex, {signal: pageSignal}) =>
      {
        const searchParameters = period === TimeSpecifier.LAST_24_H
          ? {a: 'dailynice', p: pageIndex}
          : {p: pageIndex};

        const url = this.#buildUrl(
          `/${encodeURIComponent(normalizedTitleName)}--${normalizedTitleId}`,
          searchParameters
        );

        let html;
        try
        {
          html = await this.#requestText(url, {signal: pageSignal});
        }
        catch(error)
        {
          if(this.#isNotFound(error))
            return {items: [], isLast: true, pageIdentity: undefined};

          throw error;
        }

        throwIfAborted(pageSignal);
        const pageItems = this.#parseTitleAuthors(
          html,
          `title ${normalizedTitleName}--${normalizedTitleId}, page ${pageIndex}`
        );

        return {
          items: pageItems,
          isLast: pageItems.length === 0,
          pageIdentity: pageItems.length === 0 ? undefined : textFingerprint(html)
        };
      },
      getItems: page => page.items,
      isLastPage: page => page.isLast,
      getPageIdentity: page => page.pageIdentity,
      signal,
      limits
    });

    const relations = new Map();
    for(const author of authors)
    {
      if(!relations.has(author.authorName))
      {
        relations.set(author.authorName, createAuthorRelation({
          authorName: author.authorName,
          authorId: author.authorId
        }));
      }
    }

    return relations;
  }

  async #listConnections(endpoint, authorName, {signal, limits})
  {
    const authors = await this.#collectPages({
      fetchPage: async (pageIndex, {signal: pageSignal}) =>
      {
        const url = this.#buildUrl(`/${endpoint}`, {
          nick: authorName,
          pageIndex
        });
        const json = await this.#requestJson(url, {signal: pageSignal});

        if(!Array.isArray(json))
        {
          throw new ParseError(`${endpoint} endpoint returned a non-array page`, {
            details: {authorName, pageIndex}
          });
        }

        return json.map((item, itemIndex) =>
          parseRemoteAuthor(item, `${endpoint}, page ${pageIndex}, item ${itemIndex}`)
        );
      },
      getItems: page => page,
      isLastPage: (page, pageItems) => pageItems.length === 0,
      getPageIdentity: page => pageIdentityFromAuthors(page),
      signal,
      limits
    });

    const relations = new Map();
    for(const author of authors)
    {
      relations.set(author.authorName, createAuthorRelation({
        authorName: author.authorName,
        authorId: author.authorId,
        isFollowedByCurrentUser: author.isFollowedByCurrentUser,
        followsCurrentUser: author.followsCurrentUser
      }));
    }

    return relations;
  }

  #parseFavoriterNames(html, context, {skipNoviceSummary = false} = {})
  {
    const document = this.#documentFromHtml(html, context);
    const authorNames = [];
    const links = document.querySelectorAll('a');

    for(let index = 0; index < links.length; index++)
    {
      const value = links[index].innerHTML;
      if(!value)
        continue;

      if(skipNoviceSummary && index === links.length - 1 && value.includes('çaylak'))
        continue;

      authorNames.push(normalizeScrapedName(value.substr(1)));
    }

    return authorNames;
  }

  #parseTitleAuthors(html, context)
  {
    const document = this.#documentFromHtml(html, context);
    const authors = [];

    for(const contentElement of document.getElementsByClassName('content'))
    {
      const entryElement = contentElement.parentNode;
      const rawAuthorName = entryElement?.getAttribute('data-author');
      const authorId = entryElement?.getAttribute('data-author-id');

      if(typeof rawAuthorName !== 'string' || rawAuthorName.trim() === '' ||
         typeof authorId !== 'string' || !/^\d+$/.test(authorId))
      {
        throw new ParseError(`Title entry contains invalid author metadata in ${context}`, {
          details: {context}
        });
      }

      authors.push({
        authorName: normalizeScrapedName(rawAuthorName),
        authorId
      });
    }

    return authors;
  }

  #setOwnRelationFlag(relation, kind, value)
  {
    if(kind === OwnRelationKind.BLOCKED_USER)
      relation.isBlockedUser = value;
    else if(kind === OwnRelationKind.BLOCKED_TITLES)
      relation.areTitlesBlocked = value;
    else if(kind === OwnRelationKind.MUTED)
      relation.isMuted = value;
  }

  #getOwnRelationFlag(relation, kind)
  {
    if(kind === OwnRelationKind.BLOCKED_USER)
      return relation.isBlockedUser;
    if(kind === OwnRelationKind.BLOCKED_TITLES)
      return relation.areTitlesBlocked;
    if(kind === OwnRelationKind.MUTED)
      return relation.isMuted;

    return null;
  }

  #isNotFound(error)
  {
    return error instanceof HttpError && error.details.status === 404;
  }

  #validateOptions(options)
  {
    if(options === null || typeof options !== 'object' || Array.isArray(options))
      throw new TypeError('options must be an object');

    if(options.signal !== undefined && typeof options.signal?.aborted !== 'boolean')
      throw new TypeError('options.signal must be an AbortSignal');

    this.#resolveLimits(options.limits);
  }

  #resolveLimits(overrides = {})
  {
    if(overrides === null || typeof overrides !== 'object' || Array.isArray(overrides))
      throw new TypeError('limits must be an object');

    return {
      maxPages: overrides.maxPages === undefined
        ? this.#defaultLimits.maxPages
        : requirePositiveInteger(overrides.maxPages, 'limits.maxPages'),
      maxItems: overrides.maxItems === undefined
        ? this.#defaultLimits.maxItems
        : requirePositiveInteger(overrides.maxItems, 'limits.maxItems')
    };
  }

  #buildUrl(pathname, searchParameters = {})
  {
    const url = new URL(pathname, this.#baseUrl);

    for(const [name, value] of Object.entries(searchParameters))
    {
      if(value !== undefined && value !== null)
        url.searchParams.set(name, String(value));
    }

    return url;
  }

  async #requestText(url, {signal} = {})
  {
    return this.#request(url, {signal, responseType: 'text'});
  }

  async #requestJson(url, {signal} = {})
  {
    return this.#request(url, {signal, responseType: 'json'});
  }

  async #request(url, {signal, responseType})
  {
    throwIfAborted(signal);

    let response;
    try
    {
      response = await this.#fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest'
        },
        signal
      });
    }
    catch(error)
    {
      if(isAbortError(error) || signal?.aborted)
        throw error;

      throw new NetworkError(`Request failed: ${url}`, {
        cause: error,
        details: {url: String(url)}
      });
    }

    if(!response.ok)
    {
      throw new HttpError(`Request returned HTTP ${response.status}: ${url}`, {
        url: String(url),
        status: response.status,
        statusText: response.statusText
      });
    }

    try
    {
      return responseType === 'json' ? await response.json() : await response.text();
    }
    catch(error)
    {
      if(isAbortError(error) || signal?.aborted)
        throw error;

      throw new ParseError(`Could not read ${responseType} response: ${url}`, {
        cause: error,
        details: {url: String(url), responseType}
      });
    }
  }

  #documentFromHtml(html, context)
  {
    try
    {
      return this.#parseHtml(html);
    }
    catch(error)
    {
      throw new ParseError(`Could not parse HTML for ${context}`, {
        cause: error,
        details: {context}
      });
    }
  }

  async #collectPages({
    fetchPage,
    getItems,
    isLastPage,
    getPageIdentity,
    signal,
    limits
  })
  {
    const {maxPages, maxItems} = this.#resolveLimits(limits);
    const collectedItems = [];
    const seenPageIdentities = new Set();

    for(let pageIndex = 1; pageIndex <= maxPages; pageIndex++)
    {
      throwIfAborted(signal);

      const page = await fetchPage(pageIndex, {signal});
      const pageItems = getItems(page);

      if(!Array.isArray(pageItems))
      {
        throw new PaginationError('A page did not provide an item array', {
          code: 'INVALID_PAGE',
          details: {pageIndex}
        });
      }

      if(getPageIdentity)
      {
        const identity = getPageIdentity(page, pageItems);
        if(identity !== undefined && identity !== null)
        {
          if(seenPageIdentities.has(identity))
          {
            throw new PaginationError('The remote endpoint repeated a page', {
              code: 'REPEATED_PAGE',
              details: {pageIndex}
            });
          }

          seenPageIdentities.add(identity);
        }
      }

      collectedItems.push(...pageItems);

      if(collectedItems.length > maxItems)
      {
        throw new PaginationError('Pagination exceeded the item limit', {
          code: 'ITEM_LIMIT_EXCEEDED',
          details: {pageIndex, maxItems}
        });
      }

      if(isLastPage(page, pageItems))
        return collectedItems;
    }

    throw new PaginationError('Pagination exceeded the page limit', {
      code: 'PAGE_LIMIT_EXCEEDED',
      details: {maxPages}
    });
  }

}
