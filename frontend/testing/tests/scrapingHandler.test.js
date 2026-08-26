/*
 * ============================================================================
 * REQUIRED LOCAL FIXTURES — THESE FILES ARE NOT INCLUDED IN THE REPOSITORY
 * ============================================================================
 *
 * This suite uses captured Ekşi Sözlük responses to check the scraper against
 * real page structures. Because authenticated responses can contain account
 * details, anti-forgery tokens, and other private information, the repository
 * intentionally does not distribute the captures. The fixture-dependent tests
 * will fail to load, or their assertions may fail, until the tester provides
 * captures matching the cases below in `./fixtures/`.
 *
 * Capture the response bodies from an authenticated browser session (for
 * example, from the browser developer tools' Network/Response panel, or with
 * `fetch` executed in that session) and save them with these exact names:
 *
 * - `author-profile.html`: GET `/biri/pandayavrusu`. A complete author profile
 *   page used to read the numeric author id from the hidden `#who` input.
 * - `homepage.html`: GET `/` while logged in. Used to identify the current
 *   account from the profile link in `.mobile-notification-icons`.
 * - `entry.html`: GET `/entry/1`. The standalone page for entry `1`, used to
 *   read the entry's author and its containing title metadata.
 * - `regular-favorites.html`: GET `/entry/favorileyenler?entryId=1`. The HTML
 *   response containing the regular authors who favorited entry `1`.
 * - `caylak-favorites.html`: GET `/entry/caylakfavorites?entryId=1`. The HTML
 *   response containing novice (çaylak) authors who favorited entry `1`.
 * - `title-1.html`: GET `/pena--31782?p=1`. Page 1 of the complete `pena`
 *   title, used as the first page when collecting and deduplicating authors.
 * - `title-2.html`: GET `/pena--31782?p=2`. Page 2 of that same title; the name
 *   means "second pagination page," not a different title.
 *
 * The expected names, ids, and item counts below were derived from those exact
 * responses. Capturing different authors, entries, titles, or newer versions of
 * changing lists may require updating the corresponding assertions.
 *
 * There are currently no external JSON fixture files: JSON response bodies in
 * this suite are constructed inline. If external JSON captures are added later,
 * they must likewise remain local and be documented in this list.
 *
 * Never commit fixture captures, cookies, request headers, storage-state files,
 * passwords, or session/anti-forgery tokens.
 * ============================================================================
 */

import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it, vi} from 'vitest';

let EksiScrapingHandler;
let HttpError;
let NetworkError;
let OwnRelationKind;
let PaginationError;
let ParseError;
let TimeSpecifier;

beforeAll(async () =>
{
  vi.stubGlobal('self', globalThis);
  ({
    EksiScrapingHandler,
    HttpError,
    NetworkError,
    OwnRelationKind,
    PaginationError,
    ParseError
  } = await import('../../app/assets/js/scrapingHandlerNew.js'));
  ({TimeSpecifier} = await import('../../app/assets/js/enums.js'));
});

const authorProfileHtml = readFileSync(
  new URL('./fixtures/author-profile.html', import.meta.url),
  'utf8'
);

const homepageHtml = readFileSync(
  new URL('./fixtures/homepage.html', import.meta.url),
  'utf8'
);

const entryHtml = readFileSync(
  new URL('./fixtures/entry.html', import.meta.url),
  'utf8'
);

const regularFavoritesHtml = readFileSync(
  new URL('./fixtures/regular-favorites.html', import.meta.url),
  'utf8'
);

const noviceFavoritesHtml = readFileSync(
  new URL('./fixtures/caylak-favorites.html', import.meta.url),
  'utf8'
);

const titlePageOneHtml = readFileSync(
  new URL('./fixtures/title-1.html', import.meta.url),
  'utf8'
);

const titlePageTwoHtml = readFileSync(
  new URL('./fixtures/title-2.html', import.meta.url),
  'utf8'
);

function textResponse(body, {status = 200, statusText = 'OK'} = {})
{
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(body),
    json: vi.fn()
  };
}

function jsonResponse(body, {status = 200, statusText = 'OK'} = {})
{
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: vi.fn(),
    json: vi.fn().mockResolvedValue(body)
  };
}

function remoteAuthor({
  name = 'author one',
  id = 101,
  isBuddy = true,
  followsCurrentUser = false,
  includeRelationshipFields = true
} = {})
{
  const author = {
    Nick: {Value: name},
    Id: id
  };

  if(includeRelationshipFields)
    author.IsBuddy = isBuddy;
  if(includeRelationshipFields)
    author.IsFollowCurrentUser = followsCurrentUser;

  return author;
}

function ownRelationPage(items, isLast)
{
  return {
    Relations: {
      Items: items,
      IsLast: isLast
    }
  };
}

function titlePage(authors = [], marker = 'page')
{
  const entries = authors.map(({name, id}, index) => `
    <li data-entry-marker="${marker}-${index}" data-author="${name}" data-author-id="${id}">
      <div class="content">entry</div>
    </li>
  `).join('');

  return `<ul id="entry-item-list">${entries}</ul>`;
}

function requestedUrl(fetchImpl, callIndex = 0)
{
  return new URL(String(fetchImpl.mock.calls[callIndex][0]));
}

describe('EksiScrapingHandler.getAuthor', () =>
{
  it('extracts the author id from a captured profile page', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue(authorProfileHtml)
    });
    const handler = new EksiScrapingHandler({fetchImpl});

    const author = await handler.getAuthor('pandayavrusu');

    expect(author).toEqual({
      authorName: 'pandayavrusu',
      authorId: '64178'
    });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [requestedUrl, requestOptions] = fetchImpl.mock.calls[0];
    expect(String(requestedUrl)).toBe('https://eksisozluk.com/biri/pandayavrusu');
    expect(requestOptions).toMatchObject({
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      }
    });
  });

  it('returns null when the author profile returns 404', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', {
      status: 404,
      statusText: 'Not Found'
    }));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getAuthor('missing author')).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['is missing', '<html><body></body></html>'],
    ['is empty', '<input id="who" value="">'],
    ['is not numeric', '<input id="who" value="abc">']
  ])('throws ParseError when the author id %s', async (_caseName, html) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(html))
    });

    await expect(handler.getAuthor('author')).rejects.toBeInstanceOf(ParseError);
  });

  it('normalizes and safely encodes the requested author name', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('<input id="who" value="7">'));
    const handler = new EksiScrapingHandler({fetchImpl});

    await handler.getAuthor('  Türkçe Yazar  ');

    expect(decodeURIComponent(requestedUrl(fetchImpl).pathname)).toBe('/biri/Türkçe-Yazar');
  });
});

describe('EksiScrapingHandler construction and validation', () =>
{
  it('rejects a non-function fetch implementation', () =>
  {
    expect(() => new EksiScrapingHandler({fetchImpl: null})).toThrow(TypeError);
  });

  it('rejects a non-function HTML parser', () =>
  {
    expect(() => new EksiScrapingHandler({parseHtml: null})).toThrow(TypeError);
  });

  it.each([
    ['an invalid URL', 'not a URL'],
    ['an unsupported protocol', 'ftp://example.test']
  ])('rejects %s as the base URL', (_caseName, baseUrl) =>
  {
    expect(() => new EksiScrapingHandler({baseUrl})).toThrow(TypeError);
  });

  it.each([
    ['maxPages', 0],
    ['maxPages', -1],
    ['maxPages', 1.5],
    ['maxItems', 0],
    ['maxItems', -1],
    ['maxItems', '10']
  ])('rejects invalid constructor limit %s=%s', (name, value) =>
  {
    expect(() => new EksiScrapingHandler({[name]: value})).toThrow(TypeError);
  });

  it('normalizes a custom base URL to its origin', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('<input id="who" value="1">'));
    const handler = new EksiScrapingHandler({
      fetchImpl,
      baseUrl: 'https://example.test/path?query=yes#fragment'
    });

    await handler.getAuthor('author');

    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://example.test/biri/author');
  });

  it.each([
    ['null options', handler => handler.getAuthor('author', null)],
    ['array options', handler => handler.getAuthor('author', [])],
    ['invalid signal', handler => handler.getAuthor('author', {signal: {}})],
    ['null limits', handler => handler.getAuthor('author', {limits: null})],
    ['array limits', handler => handler.getAuthor('author', {limits: []})],
    ['zero page limit', handler => handler.getAuthor('author', {limits: {maxPages: 0}})],
    ['fractional item limit', handler => handler.getAuthor('author', {limits: {maxItems: 1.5}})]
  ])('rejects %s before fetching', async (_caseName, invoke) =>
  {
    const fetchImpl = vi.fn();
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(invoke(handler)).rejects.toBeInstanceOf(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['empty author name', handler => handler.getAuthor('   ')],
    ['non-numeric entry id', handler => handler.getEntryMetadata('abc')],
    ['non-numeric favorites entry id', handler => handler.listEntryFavoriters('1a')],
    ['invalid includeNovices', handler => handler.listEntryFavoriters('1', {includeNovices: 'yes'})],
    ['non-array own relation kinds', handler => handler.listOwnRelations({kinds: 'blocked-user'})],
    ['unsupported own relation kind', handler => handler.listOwnRelations({kinds: ['unsupported']})],
    ['empty follower name', handler => handler.listFollowers('')],
    ['empty following name', handler => handler.listFollowing(' ')],
    ['missing title query', handler => handler.listTitleAuthors()],
    ['non-numeric title id', handler => handler.listTitleAuthors({titleName: 'title', titleId: 'x'})],
    ['unsupported title period', handler => handler.listTitleAuthors({
      titleName: 'title',
      titleId: '1',
      period: TimeSpecifier.LAST_1_W
    })]
  ])('rejects %s before fetching', async (_caseName, invoke) =>
  {
    const fetchImpl = vi.fn();
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(invoke(handler)).rejects.toBeInstanceOf(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('EksiScrapingHandler request and error contract', () =>
{
  it('calls the default fetch with the service-worker global as its receiver', async () =>
  {
    const fetchImpl = vi.fn(function()
    {
      if(this !== globalThis)
        throw new TypeError('Illegal invocation');

      return Promise.resolve(textResponse('<input id="who" value="1">'));
    });
    vi.stubGlobal('fetch', fetchImpl);
    const handler = new EksiScrapingHandler();

    await expect(handler.getAuthor('author')).resolves.toEqual({
      authorName: 'author',
      authorId: '1'
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('uses the legacy request headers for JSON endpoints', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    await handler.listFollowers('author');

    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      }
    });
  });

  it('passes the supplied signal unchanged to fetch', async () =>
  {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('<input id="who" value="1">'));
    const handler = new EksiScrapingHandler({fetchImpl});

    await handler.getAuthor('author', {signal: controller.signal});

    expect(fetchImpl.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('wraps a rejected fetch in NetworkError with its cause and URL', async () =>
  {
    const cause = new Error('offline');
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockRejectedValue(cause)
    });

    let error;
    try
    {
      await handler.getAuthor('author');
    }
    catch(caughtError)
    {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({
      name: 'NetworkError',
      code: 'NETWORK_ERROR',
      cause,
      details: {url: 'https://eksisozluk.com/biri/author'}
    });
  });

  it('converts a non-success response to HttpError without reading its body', async () =>
  {
    const response = textResponse('server error', {
      status: 500,
      statusText: 'Server Error'
    });
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(response)
    });

    let error;
    try
    {
      await handler.getAuthor('author');
    }
    catch(caughtError)
    {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      name: 'HttpError',
      code: 'HTTP_ERROR',
      details: {
        status: 500,
        statusText: 'Server Error',
        url: 'https://eksisozluk.com/biri/author'
      }
    });
    expect(response.text).not.toHaveBeenCalled();
  });

  it('converts a rejected text body read to ParseError', async () =>
  {
    const cause = new Error('text failed');
    const response = textResponse('');
    response.text.mockRejectedValue(cause);
    const handler = new EksiScrapingHandler({fetchImpl: vi.fn().mockResolvedValue(response)});

    await expect(handler.getAuthor('author')).rejects.toMatchObject({
      name: 'ParseError',
      code: 'PARSE_ERROR',
      cause
    });
  });

  it('converts a rejected JSON body read to ParseError', async () =>
  {
    const cause = new Error('json failed');
    const response = jsonResponse([]);
    response.json.mockRejectedValue(cause);
    const handler = new EksiScrapingHandler({fetchImpl: vi.fn().mockResolvedValue(response)});

    await expect(handler.listFollowers('author')).rejects.toMatchObject({
      name: 'ParseError',
      code: 'PARSE_ERROR',
      cause
    });
  });

  it('converts an injected HTML parser failure to ParseError', async () =>
  {
    const cause = new Error('parser failed');
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('<html></html>')),
      parseHtml: () => { throw cause; }
    });

    await expect(handler.getAuthor('author')).rejects.toMatchObject({
      name: 'ParseError',
      code: 'PARSE_ERROR',
      cause
    });
  });
});

describe('EksiScrapingHandler.getCurrentAccount', () =>
{
  it('returns null after one request when no account link is present', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('<html><body>logged out</body></html>'));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getCurrentAccount()).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://eksisozluk.com/');
  });

  it('extracts the current account from a captured logged-in homepage', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(homepageHtml))
      .mockResolvedValueOnce(textResponse('<input id="who" value="42">'));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getCurrentAccount()).resolves.toEqual({
      authorName: 'fraksiyonludesti',
      authorId: '42'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://eksisozluk.com/');
    expect(decodeURIComponent(requestedUrl(fetchImpl, 1).pathname)).toBe('/biri/fraksiyonludesti');
  });

  it('throws ParseError when the account link has an empty title', async () =>
  {
    const homepage = `
      <div class="mobile-notification-icons">
        <div class="mobile-only"><a title=""></a></div>
      </div>
    `;
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(homepage))
    });

    await expect(handler.getCurrentAccount()).rejects.toBeInstanceOf(ParseError);
  });

  it('throws ParseError when the identified current profile returns 404', async () =>
  {
    const homepage = `
      <div class="mobile-notification-icons">
        <div class="mobile-only"><a title="Missing Author"></a></div>
      </div>
    `;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(homepage))
      .mockResolvedValueOnce(textResponse('', {status: 404, statusText: 'Not Found'}));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getCurrentAccount()).rejects.toBeInstanceOf(ParseError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('EksiScrapingHandler.getEntryMetadata', () =>
{
  it('extracts metadata from a captured entry page', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(entryHtml))
    });

    await expect(handler.getEntryMetadata('1')).resolves.toEqual({
      entryId: '1',
      authorId: '8097',
      authorName: 'ssg',
      titleId: '31782',
      titleName: 'pena'
    });
  });

  it('extracts and normalizes complete entry metadata', async () =>
  {
    const html = `
      <ul><li data-author-id="999" data-author="Decoy Author"></li></ul>
      <ul id="entry-item-list">
        <li data-author-id="10" data-author="Entry  Author"></li>
      </ul>
      <h1 id="title" data-id="20" data-title="Entry  Title"></h1>
    `;
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(html));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getEntryMetadata(' 123 ')).resolves.toEqual({
      entryId: '123',
      authorId: '10',
      authorName: 'Entry--Author',
      titleId: '20',
      titleName: 'Entry--Title'
    });
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://eksisozluk.com/entry/123');
  });

  it('returns null when the entry page returns 404', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('', {status: 404, statusText: 'Not Found'}))
    });

    await expect(handler.getEntryMetadata('123')).resolves.toBeNull();
  });

  it.each([
    ['entry list', '<h1 id="title" data-id="20" data-title="Title"></h1>'],
    ['title element', '<ul id="entry-item-list"><li data-author-id="10" data-author="Author"></li></ul>']
  ])('throws ParseError when the %s is missing', async (_caseName, html) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(html))
    });

    await expect(handler.getEntryMetadata('123')).rejects.toBeInstanceOf(ParseError);
  });

  it.each([
    ['author id', '<li data-author-id="x" data-author="Author"></li>', '<h1 id="title" data-id="20" data-title="Title"></h1>'],
    ['author name', '<li data-author-id="10" data-author=""></li>', '<h1 id="title" data-id="20" data-title="Title"></h1>'],
    ['title id', '<li data-author-id="10" data-author="Author"></li>', '<h1 id="title" data-id="x" data-title="Title"></h1>'],
    ['title name', '<li data-author-id="10" data-author="Author"></li>', '<h1 id="title" data-id="20" data-title=""></h1>']
  ])('throws ParseError for an invalid %s', async (_caseName, entryElement, titleElement) =>
  {
    const html = `<ul id="entry-item-list">${entryElement}</ul>${titleElement}`;
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(html))
    });

    await expect(handler.getEntryMetadata('123')).rejects.toBeInstanceOf(ParseError);
  });

  it('propagates non-404 HTTP failures', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('', {status: 403, statusText: 'Forbidden'}))
    });

    await expect(handler.getEntryMetadata('123')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('EksiScrapingHandler.listEntryFavoriters', () =>
{
  it('extracts regular authors from a captured favorites response', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(regularFavoritesHtml))
    });

    const result = await handler.listEntryFavoriters('1');

    expect(result.size).toBe(327);
    expect([...result.keys()].slice(0, 3)).toEqual(['040116', '089', '13fullmoon']);
    expect(result.has('29-ekim-1923te-meclise-geciken-mebus')).toBe(true);
    expect([...result.keys()].at(-1)).toBe('zoeger');
    expect([...result.keys()].some(authorName => authorName.includes('çaylak'))).toBe(false);
  });

  it('merges authors from captured regular and novice favorites responses', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(regularFavoritesHtml))
      .mockResolvedValueOnce(textResponse(noviceFavoritesHtml));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listEntryFavoriters('1', {includeNovices: true});
    const authorNames = [...result.keys()];

    expect(result.size).toBe(437);
    expect(authorNames.slice(327, 330)).toEqual([
      'addicted-fish',
      'allgirlsarebeatiful',
      'antitayipci'
    ]);
    expect(authorNames.at(-1)).toBe('zizou41');
  });

  it('extracts, normalizes, deduplicates, and skips the final novice summary', async () =>
  {
    const html = `
      <a>@First  Author</a>
      <a>@First  Author</a>
      <a>@Second Author</a>
      <a>2 çaylak</a>
    `;
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(html));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listEntryFavoriters('55');

    expect([...result.keys()]).toEqual(['First--Author', 'Second-Author']);
    expect(result.get('First--Author')).toEqual({
      authorName: 'First--Author',
      authorId: null,
      isBlockedUser: null,
      areTitlesBlocked: null,
      isMuted: null,
      isFollowedByCurrentUser: null,
      followsCurrentUser: null
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(requestedUrl(fetchImpl).pathname).toBe('/entry/favorileyenler');
    expect(requestedUrl(fetchImpl).searchParams.get('entryId')).toBe('55');
  });

  it('returns an empty Map for a successful response without author links', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('<div>no favorites</div>'))
    });

    await expect(handler.listEntryFavoriters('55')).resolves.toEqual(new Map());
  });

  it('requests and merges novice favorites when enabled', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse('<a>@Regular Author</a><a>@Shared Author</a>'))
      .mockResolvedValueOnce(textResponse('<a>@Novice Author</a><a>@Shared Author</a>'));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listEntryFavoriters('55', {includeNovices: true});

    expect([...result.keys()]).toEqual(['Regular-Author', 'Shared-Author', 'Novice-Author']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(requestedUrl(fetchImpl, 1).pathname).toBe('/entry/caylakfavorites');
    expect(requestedUrl(fetchImpl, 1).searchParams.get('entryId')).toBe('55');
  });

  it('does not request novice favorites when the regular request fails', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', {
      status: 500,
      statusText: 'Server Error'
    }));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listEntryFavoriters('55', {includeNovices: true})).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('rejects instead of returning regular favorites when the novice request fails', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse('<a>@Regular Author</a>'))
      .mockResolvedValueOnce(textResponse('', {status: 500, statusText: 'Server Error'}));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listEntryFavoriters('55', {includeNovices: true})).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('EksiScrapingHandler.listOwnRelations', () =>
{
  it('requests all relation kinds and merges their flags by author', async () =>
  {
    const authorOne = remoteAuthor({name: 'Author One', id: 1});
    const authorTwo = remoteAuthor({name: 'Author Two', id: 2});
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([authorOne], true)))
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([authorOne, authorTwo], true)))
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([authorTwo], true)));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listOwnRelations();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls.map((_call, index) => requestedUrl(fetchImpl, index).searchParams.get('relationType')))
      .toEqual(['m', 'i', 'u']);
    expect(result.get('Author-One')).toMatchObject({
      authorId: '1',
      isBlockedUser: true,
      areTitlesBlocked: true,
      isMuted: false
    });
    expect(result.get('Author-Two')).toMatchObject({
      authorId: '2',
      isBlockedUser: false,
      areTitlesBlocked: true,
      isMuted: true
    });
  });

  it('leaves unrequested relation flags null', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(
      ownRelationPage([remoteAuthor({name: 'Blocked Author', id: 1})], true)
    ));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listOwnRelations({
      kinds: [OwnRelationKind.BLOCKED_USER]
    });

    expect(result.get('Blocked-Author')).toMatchObject({
      isBlockedUser: true,
      areTitlesBlocked: null,
      isMuted: null
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns an empty Map without fetching when no kinds are requested', async () =>
  {
    const fetchImpl = vi.fn();
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listOwnRelations({kinds: []})).resolves.toEqual(new Map());
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deduplicates repeated requested kinds', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(ownRelationPage([], true)));
    const handler = new EksiScrapingHandler({fetchImpl});

    await handler.listOwnRelations({
      kinds: [OwnRelationKind.MUTED, OwnRelationKind.MUTED]
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(requestedUrl(fetchImpl).searchParams.get('relationType')).toBe('u');
  });

  it('collects records from every page including a non-empty final page', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([
        remoteAuthor({name: 'First Author', id: 1})
      ], false)))
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([
        remoteAuthor({name: 'Final Author', id: 2})
      ], true)));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listOwnRelations({
      kinds: [OwnRelationKind.BLOCKED_USER]
    });

    expect([...result.keys()]).toEqual(['First-Author', 'Final-Author']);
    expect(requestedUrl(fetchImpl, 0).searchParams.get('pageIndex')).toBe('1');
    expect(requestedUrl(fetchImpl, 1).searchParams.get('pageIndex')).toBe('2');
  });

  it.each([
    ['missing Relations', {}],
    ['non-array Items', {Relations: {Items: {}, IsLast: true}}],
    ['non-boolean IsLast', {Relations: {Items: [], IsLast: 'true'}}]
  ])('rejects an invalid page with %s', async (_caseName, body) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(body))
    });

    await expect(handler.listOwnRelations({
      kinds: [OwnRelationKind.BLOCKED_USER]
    })).rejects.toBeInstanceOf(ParseError);
  });

  it.each([
    ['missing name', {Nick: {}, Id: 1}],
    ['empty name', {Nick: {Value: ''}, Id: 1}],
    ['missing id', {Nick: {Value: 'Author'}}],
    ['invalid id', {Nick: {Value: 'Author'}, Id: 'abc'}]
  ])('rejects an author item with %s', async (_caseName, item) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(ownRelationPage([item], true)))
    });

    await expect(handler.listOwnRelations({
      kinds: [OwnRelationKind.BLOCKED_USER]
    })).rejects.toBeInstanceOf(ParseError);
  });

  it('does not continue to later relation kinds after a failure', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(ownRelationPage([], true)))
      .mockResolvedValueOnce(jsonResponse({}, {status: 500, statusText: 'Server Error'}));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listOwnRelations()).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe.each([
  ['listFollowers', 'follower'],
  ['listFollowing', 'following']
])('EksiScrapingHandler.%s', (methodName, endpoint) =>
{
  it('requests pages until an empty terminal page and maps relationship flags', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        remoteAuthor({name: 'Connected  Author', id: 7, isBuddy: true, followsCurrentUser: false})
      ]))
      .mockResolvedValueOnce(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler[methodName]('Target Author');

    expect(result.get('Connected--Author')).toEqual({
      authorName: 'Connected--Author',
      authorId: '7',
      isBlockedUser: null,
      areTitlesBlocked: null,
      isMuted: null,
      isFollowedByCurrentUser: true,
      followsCurrentUser: false
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(requestedUrl(fetchImpl, 0).pathname).toBe(`/${endpoint}`);
    expect(requestedUrl(fetchImpl, 0).searchParams.get('nick')).toBe('Target-Author');
    expect(requestedUrl(fetchImpl, 0).searchParams.get('pageIndex')).toBe('1');
    expect(requestedUrl(fetchImpl, 1).searchParams.get('pageIndex')).toBe('2');
  });

  it('returns an empty Map after one empty page', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler[methodName]('author')).resolves.toEqual(new Map());
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('uses null for absent relationship booleans', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        remoteAuthor({name: 'Author', id: 1, includeRelationshipFields: false})
      ]))
      .mockResolvedValueOnce(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler[methodName]('author');

    expect(result.get('Author')).toMatchObject({
      isFollowedByCurrentUser: null,
      followsCurrentUser: null
    });
  });

  it('rejects a non-array page', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({Items: []}))
    });

    await expect(handler[methodName]('author')).rejects.toBeInstanceOf(ParseError);
  });

  it.each([
    ['missing name', {Nick: {}, Id: 1}],
    ['invalid id', {Nick: {Value: 'Author'}, Id: 'abc'}]
  ])('rejects an item with %s', async (_caseName, item) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse([item]))
    });

    await expect(handler[methodName]('author')).rejects.toBeInstanceOf(ParseError);
  });
});

describe('EksiScrapingHandler.listTitleAuthors', () =>
{
  it('collects and deduplicates authors from captured title pages', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(titlePageOneHtml))
      .mockResolvedValueOnce(textResponse(titlePageTwoHtml))
      .mockResolvedValueOnce(textResponse('', {status: 404, statusText: 'Not Found'}));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listTitleAuthors({titleName: 'pena', titleId: '31782'});

    expect(result.size).toBe(47);
    expect(result.get('ssg')).toMatchObject({authorId: '8097'});
    expect(result.get('ahmet-corleone')).toMatchObject({authorId: '7810'});
    expect(result.get('sudaki-duman')).toMatchObject({authorId: '13321'});
    expect(result.get('joe-90')).toMatchObject({authorId: '22046'});
    expect(result.get('point')).toMatchObject({authorId: '26574'});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('requests all-time pages until a successful empty page', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(titlePage([
        {name: 'Title  Author', id: 11}
      ], 'first')))
      .mockResolvedValueOnce(textResponse(titlePage([], 'empty')));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listTitleAuthors({
      titleName: 'Test Title',
      titleId: '99'
    });

    expect(result.get('Title--Author')).toMatchObject({authorId: '11'});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(requestedUrl(fetchImpl, 0).pathname)).toBe('/Test-Title--99');
    expect(requestedUrl(fetchImpl, 0).searchParams.get('p')).toBe('1');
    expect(requestedUrl(fetchImpl, 0).searchParams.has('a')).toBe(false);
    expect(requestedUrl(fetchImpl, 1).searchParams.get('p')).toBe('2');
  });

  it('adds the daily filter for the last-24-hours period', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', {
      status: 404,
      statusText: 'Not Found'
    }));
    const handler = new EksiScrapingHandler({fetchImpl});

    await handler.listTitleAuthors({
      titleName: 'Daily Title',
      titleId: '99',
      period: TimeSpecifier.LAST_24_H
    });

    expect(requestedUrl(fetchImpl).search).toBe('?a=dailynice&p=1');
    expect(requestedUrl(fetchImpl).searchParams.get('a')).toBe('dailynice');
    expect(requestedUrl(fetchImpl).searchParams.get('p')).toBe('1');
  });

  it('treats a 404 after a non-empty page as normal completion', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(titlePage([{name: 'Author', id: 1}], 'first')))
      .mockResolvedValueOnce(textResponse('', {status: 404, statusText: 'Not Found'}));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listTitleAuthors({titleName: 'title', titleId: '1'});

    expect([...result.keys()]).toEqual(['Author']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns an empty Map when the first title page returns 404', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', {
      status: 404,
      statusText: 'Not Found'
    }));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listTitleAuthors({titleName: 'title', titleId: '1'}))
      .resolves.toEqual(new Map());
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('deduplicates an author appearing on different title pages', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(titlePage([{name: 'Same Author', id: 1}], 'first')))
      .mockResolvedValueOnce(textResponse(titlePage([{name: 'Same Author', id: 1}], 'second')))
      .mockResolvedValueOnce(textResponse(titlePage([], 'empty')));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listTitleAuthors({titleName: 'title', titleId: '1'});

    expect([...result.keys()]).toEqual(['Same-Author']);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('treats a successful page without content elements as terminal', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('<html><body></body></html>'))
    });

    await expect(handler.listTitleAuthors({titleName: 'title', titleId: '1'}))
      .resolves.toEqual(new Map());
  });

  it.each([
    ['missing author name', '<li data-author-id="1"><div class="content"></div></li>'],
    ['invalid author id', '<li data-author="Author" data-author-id="abc"><div class="content"></div></li>']
  ])('throws ParseError for an entry with %s', async (_caseName, entry) =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse(`<ul id="entry-item-list">${entry}</ul>`))
    });

    await expect(handler.listTitleAuthors({titleName: 'title', titleId: '1'}))
      .rejects.toBeInstanceOf(ParseError);
  });

  it('propagates non-404 HTTP failures', async () =>
  {
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(textResponse('', {status: 500, statusText: 'Server Error'}))
    });

    await expect(handler.listTitleAuthors({titleName: 'title', titleId: '1'}))
      .rejects.toBeInstanceOf(HttpError);
  });
});

describe('EksiScrapingHandler pagination safety', () =>
{
  it('throws REPEATED_PAGE and stops when a connection page repeats', async () =>
  {
    const page = [remoteAuthor({name: 'Repeated Author', id: 1})];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page))
      .mockResolvedValueOnce(jsonResponse(page));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listFollowers('author')).rejects.toMatchObject({
      name: 'PaginationError',
      code: 'REPEATED_PAGE',
      details: {pageIndex: 2}
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws REPEATED_PAGE when an own-relation page repeats', async () =>
  {
    const page = ownRelationPage([remoteAuthor({name: 'Repeated Author', id: 1})], false);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page))
      .mockResolvedValueOnce(jsonResponse(page));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listOwnRelations({
      kinds: [OwnRelationKind.BLOCKED_USER]
    })).rejects.toMatchObject({code: 'REPEATED_PAGE'});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws REPEATED_PAGE when the same non-empty title page repeats', async () =>
  {
    const page = titlePage([{name: 'Repeated Author', id: 1}], 'same');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(textResponse(page))
      .mockResolvedValueOnce(textResponse(page));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listTitleAuthors({titleName: 'title', titleId: '1'}))
      .rejects.toMatchObject({code: 'REPEATED_PAGE'});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws PAGE_LIMIT_EXCEEDED without requesting beyond the limit', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      remoteAuthor({name: 'Author', id: 1})
    ]));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listFollowers('author', {
      limits: {maxPages: 1}
    })).rejects.toMatchObject({
      name: 'PaginationError',
      code: 'PAGE_LIMIT_EXCEEDED',
      details: {maxPages: 1}
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('succeeds when the terminal page is exactly the page limit', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([remoteAuthor({name: 'Author', id: 1})]))
      .mockResolvedValueOnce(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listFollowers('author', {
      limits: {maxPages: 2}
    })).resolves.toBeInstanceOf(Map);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws ITEM_LIMIT_EXCEEDED after crossing the item limit', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([
      remoteAuthor({name: 'Author One', id: 1}),
      remoteAuthor({name: 'Author Two', id: 2})
    ]));
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listFollowers('author', {
      limits: {maxItems: 1}
    })).rejects.toMatchObject({
      name: 'PaginationError',
      code: 'ITEM_LIMIT_EXCEEDED',
      details: {pageIndex: 1, maxItems: 1}
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('allows exactly maxItems records', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([remoteAuthor({name: 'Author', id: 1})]))
      .mockResolvedValueOnce(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl});

    const result = await handler.listFollowers('author', {
      limits: {maxItems: 1}
    });

    expect(result.size).toBe(1);
  });

  it('uses operation limits in place of stricter constructor defaults', async () =>
  {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([remoteAuthor({name: 'Author', id: 1})]))
      .mockResolvedValueOnce(jsonResponse([]));
    const handler = new EksiScrapingHandler({fetchImpl, maxPages: 1});

    await expect(handler.listFollowers('author', {
      limits: {maxPages: 2}
    })).resolves.toBeInstanceOf(Map);
  });
});

describe('EksiScrapingHandler abort behavior', () =>
{
  it('rejects an already-aborted operation without fetching', async () =>
  {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getAuthor('author', {signal: controller.signal}))
      .rejects.toBe(controller.signal.reason);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves the abort reason when fetch is aborted', async () =>
  {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation((_url, {signal}) =>
    {
      controller.abort();
      return Promise.reject(signal.reason);
    });
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.getAuthor('author', {signal: controller.signal}))
      .rejects.toBe(controller.signal.reason);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('preserves the abort reason while reading a response body', async () =>
  {
    const controller = new AbortController();
    const abortReason = new Error('body read aborted');
    const response = textResponse('');
    response.text.mockImplementation(() =>
    {
      controller.abort(abortReason);
      return Promise.reject(controller.signal.reason);
    });
    const handler = new EksiScrapingHandler({
      fetchImpl: vi.fn().mockResolvedValue(response)
    });

    await expect(handler.getAuthor('author', {signal: controller.signal}))
      .rejects.toBe(abortReason);
  });

  it('rejects an aborted second page without returning partial records or requesting a third page', async () =>
  {
    const controller = new AbortController();
    const abortReason = new Error('pagination aborted');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse([remoteAuthor({name: 'Collected Author', id: 1})]))
      .mockImplementationOnce((_url, {signal}) =>
      {
        controller.abort(abortReason);
        return Promise.reject(signal.reason);
      });
    const handler = new EksiScrapingHandler({fetchImpl});

    const operation = handler.listFollowers('author', {signal: controller.signal});

    await expect(operation).rejects.toBe(abortReason);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not request novice favorites when aborted after reading regular favorites', async () =>
  {
    const controller = new AbortController();
    const abortReason = new Error('favorites aborted');
    const response = textResponse('<a>@Regular Author</a>');
    response.text.mockImplementation(() =>
    {
      controller.abort(abortReason);
      return Promise.resolve('<a>@Regular Author</a>');
    });
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listEntryFavoriters('1', {
      includeNovices: true,
      signal: controller.signal
    })).rejects.toBe(abortReason);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('does not continue to another own-relation kind after abort', async () =>
  {
    const controller = new AbortController();
    const abortReason = new Error('relations aborted');
    const response = jsonResponse(ownRelationPage([], true));
    response.json.mockImplementation(() =>
    {
      controller.abort(abortReason);
      return Promise.resolve(ownRelationPage([], true));
    });
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const handler = new EksiScrapingHandler({fetchImpl});

    await expect(handler.listOwnRelations({}, {signal: controller.signal}))
      .rejects.toBe(abortReason);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
