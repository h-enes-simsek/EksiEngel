// Hardcoded records used when DEV_USE_FAKE_HANDLERS is enabled in background.js.
const ARTIFICIAL_DELAY_MS = 3000;

function waitForArtificialDelay()
{
  return new Promise(resolve => setTimeout(resolve, ARTIFICIAL_DELAY_MS));
}

function createRelation({
  authorName,
  authorId = null,
  isBannedUser = null,
  isBannedTitle = null,
  isBannedMute = null,
  doIFollow = null,
  doTheyFollowMe = null
})
{
  return {
    authorId,
    authorName,
    isBannedUser,
    isBannedTitle,
    isBannedMute,
    doIFollow,
    doTheyFollowMe
  };
}

const authorIds = {
  "fake-author-one": "1001",
  "fake-author-two": "1002",
  "fake-followed-author": "1003"
};

export class FakeScrapingHandler
{
  scrapeUserAgent = () =>
  {
    return "EksiEngel/FakeScrapingHandler";
  }

  scrapeClientNameAndId = async () =>
  {
    await waitForArtificialDelay();
    return {clientName: "fake-client", clientId: "9000"};
  }

  scrapeMetaDataFromEntryPage = async (entryUrl) =>
  {
    await waitForArtificialDelay();
    return {
      entryId: "5000",
      authorId: "1001",
      authorName: "fake-author-one",
      titleId: "6000",
      titleName: "fake-title"
    };
  }

  async scrapeAuthorNamesFromFavs(entryUrl)
  {
    await waitForArtificialDelay();
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one"})],
      ["fake-author-two", createRelation({authorName: "fake-author-two"})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author"})]
    ]);
  }

  async scrapeAuthorNamesFromBannedAuthorPage()
  {
    await waitForArtificialDelay();
    return new Map([
      ["fake-author-one", createRelation({
        authorName: "fake-author-one",
        authorId: authorIds["fake-author-one"],
        isBannedUser: true,
        isBannedTitle: false,
        isBannedMute: false
      })],
      ["fake-author-two", createRelation({
        authorName: "fake-author-two",
        authorId: authorIds["fake-author-two"],
        isBannedUser: false,
        isBannedTitle: true,
        isBannedMute: true
      })]
    ]);
  }

  async scrapeFollower(authorName)
  {
    await waitForArtificialDelay();
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one", authorId: authorIds["fake-author-one"]})],
      ["fake-author-two", createRelation({authorName: "fake-author-two", authorId: authorIds["fake-author-two"]})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author", authorId: authorIds["fake-followed-author"]})]
    ]);
  }

  async scrapeFollowing(authorName)
  {
    await waitForArtificialDelay();
    return new Map([
      ["fake-followed-author", createRelation({
        authorName: "fake-followed-author",
        authorId: authorIds["fake-followed-author"],
        doIFollow: true,
        doTheyFollowMe: false
      })]
    ]);
  }

  scrapeAuthorIdFromAuthorProfilePage = async (authorName) =>
  {
    await waitForArtificialDelay();
    return authorIds[authorName] ?? "1999";
  }

  async scrapeAuthorsFromTitle(titleName, titleId, timeSpecifier)
  {
    await waitForArtificialDelay();
    return new Map([
      ["fake-author-one", createRelation({authorName: "fake-author-one", authorId: authorIds["fake-author-one"]})],
      ["fake-author-two", createRelation({authorName: "fake-author-two", authorId: authorIds["fake-author-two"]})],
      ["fake-followed-author", createRelation({authorName: "fake-followed-author", authorId: authorIds["fake-followed-author"]})]
    ]);
  }
}

export const fakeScrapingHandler = new FakeScrapingHandler();
