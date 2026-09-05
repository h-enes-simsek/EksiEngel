// Hardcoded records used when DEV_USE_FAKE_HANDLERS is enabled in background.js.
const ARTIFICIAL_DELAY_MS = 500;

function waitForArtificialDelay(signal)
{
  if(signal?.aborted)
    return Promise.reject(signal.reason);

  return new Promise((resolve, reject) =>
  {
    const timeoutId = setTimeout(() =>
    {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ARTIFICIAL_DELAY_MS);

    function handleAbort()
    {
      clearTimeout(timeoutId);
      reject(signal.reason);
    }

    signal?.addEventListener('abort', handleAbort, {once: true});
  });
}

function createRelation({
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
    authorId,
    authorName,
    isBlockedUser,
    areTitlesBlocked,
    isMuted,
    isFollowedByCurrentUser,
    followsCurrentUser
  };
}

const authorIds = {
  "fake-author-one": "1001",
  "fake-author-two": "1002",
  "fake-followed-author": "1003"
};

export class FakeScrapingHandler
{
  async getCurrentAccount({signal} = {})
  {
    await waitForArtificialDelay(signal);
    return {authorName: "fake-client", authorId: "9000"};
  }

  async getEntryMetadata(entryId, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return {
      entryId: String(entryId),
      authorId: "1001",
      authorName: "fake-author-one",
      titleId: "6000",
      titleName: "fake-title"
    };
  }

  async listEntryFavoriters(_entryId, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one"})],
      ["fake-author-two", createRelation({authorName: "fake-author-two"})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author"})]
    ]);
  }

  async listOwnRelations(_query = {}, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return new Map([
      ["fake-author-one", createRelation({
        authorName: "fake-author-one",
        authorId: authorIds["fake-author-one"],
        isBlockedUser: true,
        areTitlesBlocked: false,
        isMuted: false
      })],
      ["fake-author-two", createRelation({
        authorName: "fake-author-two",
        authorId: authorIds["fake-author-two"],
        isBlockedUser: false,
        areTitlesBlocked: true,
        isMuted: true
      })]
    ]);
  }

  async listFollowers(_authorName, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one", authorId: authorIds["fake-author-one"]})],
      ["fake-author-two", createRelation({authorName: "fake-author-two", authorId: authorIds["fake-author-two"]})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author", authorId: authorIds["fake-followed-author"]})]
    ]);
  }

  async listFollowing(_authorName, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return new Map([
      ["fake-followed-author", createRelation({
        authorName: "fake-followed-author",
        authorId: authorIds["fake-followed-author"],
        isFollowedByCurrentUser: true,
        followsCurrentUser: false
      })]
    ]);
  }

  async getAuthor(authorName, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return {
      authorName,
      authorId: authorIds[authorName] ?? "1999"
    };
  }

  async listTitleAuthors(_query, {signal} = {})
  {
    await waitForArtificialDelay(signal);
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one", authorId: authorIds["fake-author-one"]})],
      ["fake-author-two", createRelation({authorName: "fake-author-two", authorId: authorIds["fake-author-two"]})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author", authorId: authorIds["fake-followed-author"]})]
    ]);
  }
}
