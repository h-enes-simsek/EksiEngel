import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  BanMode,
  BanSource,
  JobPhase,
  ProcessFinishReason,
  RuntimeMessageType,
  TargetType
} from '../../app/assets/js/enums.js';

const fakes = vi.hoisted(() => ({
  checkAccess: vi.fn(),
  getCurrentAccount: vi.fn(),
  performAction: vi.fn()
}));

vi.mock('../../app/assets/js/urlHandler.js', () => ({
  isEksiSozlukAccessible: fakes.checkAccess
}));

vi.mock('../../app/assets/js/scrapingHandler.js', () => ({
  EksiScrapingHandler: class
  {
    getCurrentAccount = fakes.getCurrentAccount;
  }
}));

vi.mock('../../app/assets/js/relationHandler.js', () => ({
  RelationActionStatus: {RETRY_REQUIRED: 'RETRY_REQUIRED'},
  RelationHandler: class
  {
    performAction = fakes.performAction;
  }
}));

function settings()
{
  return {
    EksiSozlukURL: 'https://example.test',
    serverURL: 'https://telemetry.example.test',
    sendData: false,
    sendLog: false,
    enableNoobBan: false,
    enableMute: false,
    enableTitleBan: true,
    enableAnalysisBeforeOperation: false,
    enableOnlyRequiredActions: false,
    enableProtectFollowedUsers: false,
    banPremiumIcons: false
  };
}

async function loadBackground({storageGet = vi.fn().mockResolvedValue({config: settings()})} = {})
{
  let runtimeMessageListener;
  let tabRemovedListener;
  const runtimeSendMessage = vi.fn().mockResolvedValue({ok: true});
  const tabsCreate = vi.fn().mockResolvedValue({id: 42});

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: runtimeSendMessage,
      onMessage: {
        addListener: vi.fn(listener => { runtimeMessageListener = listener; })
      },
      onInstalled: {addListener: vi.fn()},
      OnInstalledReason: {INSTALL: 'install', UPDATE: 'update'},
      getURL: vi.fn(path => `chrome-extension://test/${path}`),
      getManifest: vi.fn(() => ({version: 'test'}))
    },
    tabs: {
      onRemoved: {
        addListener: vi.fn(listener => { tabRemovedListener = listener; })
      },
      get: vi.fn(),
      create: tabsCreate
    },
    storage: {
      local: {
        get: storageGet,
        set: vi.fn(),
        clear: vi.fn()
      }
    }
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});

  await import('../../app/assets/js/background.js');
  return {
    runtimeMessageListener,
    runtimeSendMessage,
    tabRemovedListener,
    tabsCreate
  };
}

async function startSingleJob(runtimeMessageListener)
{
  const sendResponse = vi.fn();
  const listenerResult = runtimeMessageListener({
    type: RuntimeMessageType.ENQUEUE_JOB,
    payload: {
      banSource: BanSource.SINGLE,
      banMode: BanMode.BAN,
      authorName: 'target',
      authorId: '7',
      targetType: TargetType.USER
    }
  }, {}, sendResponse);

  expect(listenerResult).toBe(true);
  await vi.waitFor(() => expect(fakes.performAction).toHaveBeenCalledOnce());
  expect(sendResponse).toHaveBeenCalledWith({
    ok: true,
    jobId: expect.any(String)
  });

  return fakes.performAction.mock.calls[0].at(-1).signal;
}

async function enqueueWaitingSingleJob(runtimeMessageListener)
{
  const sendResponse = vi.fn();
  runtimeMessageListener({
    type: RuntimeMessageType.ENQUEUE_JOB,
    payload: {
      banSource: BanSource.SINGLE,
      banMode: BanMode.BAN,
      authorName: 'waiting-target',
      authorId: '8',
      targetType: TargetType.USER
    }
  }, {}, sendResponse);

  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({
    ok: true,
    jobId: expect.any(String)
  }));
}

beforeEach(() =>
{
  vi.clearAllMocks();
  fakes.checkAccess.mockResolvedValue(true);
  fakes.getCurrentAccount.mockResolvedValue({authorName: 'owner', authorId: '1'});
  fakes.performAction.mockImplementation(() => new Promise(() => {}));
});

afterEach(() =>
{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('background cancellation routing', () =>
{
  it('commits notification-tab creation failure before invoking the runner', async () =>
  {
    const {
      runtimeMessageListener,
      runtimeSendMessage,
      tabsCreate
    } = await loadBackground();
    tabsCreate.mockRejectedValueOnce(new Error('tab creation failed'));
    const sendResponse = vi.fn();

    runtimeMessageListener({
      type: RuntimeMessageType.ENQUEUE_JOB,
      payload: {
        banSource: BanSource.SINGLE,
        banMode: BanMode.BAN,
        authorName: 'target',
        authorId: '7',
        targetType: TargetType.USER
      }
    }, {}, sendResponse);

    await vi.waitFor(() => expect(runtimeSendMessage).toHaveBeenLastCalledWith({
      type: RuntimeMessageType.JOB_SNAPSHOT,
      payload: expect.objectContaining({
        activeJob: null,
        completedJobs: [expect.objectContaining({
          result: expect.objectContaining({
            finishReason: ProcessFinishReason.NOTIFICATION_TAB_CREATION
          })
        })]
      })
    }));
    expect(fakes.checkAccess).not.toHaveBeenCalled();
    expect(fakes.performAction).not.toHaveBeenCalled();
  });

  it('publishes complete snapshots for visible JobManager transitions', async () =>
  {
    const {runtimeMessageListener, runtimeSendMessage} = await loadBackground();
    await startSingleJob(runtimeMessageListener);

    const publications = runtimeSendMessage.mock.calls.map(([message]) => message);
    expect(publications.length).toBeGreaterThan(0);
    expect(publications.every(message =>
      message.type === RuntimeMessageType.JOB_SNAPSHOT
    )).toBe(true);
    const revisions = publications.map(({payload}) => payload.revision);
    expect(revisions).toEqual(revisions.toSorted((a, b) => a - b));
    expect(new Set(revisions).size).toBe(revisions.length);
    expect(publications.map(({payload}) => payload.activeJob?.phase)).toEqual(
      expect.arrayContaining([
        JobPhase.PREPARING,
        JobPhase.CHECKING_ACCESS,
        JobPhase.CHECKING_LOGIN,
        JobPhase.EXECUTING_RELATIONS
      ])
    );
    expect(publications.at(-1).payload).toMatchObject({
      activeJob: {
        job: {
          id: expect.any(String),
          banSource: BanSource.SINGLE,
          banMode: BanMode.BAN
        },
        progress: {
          successfulAction: 0,
          performedAction: 0,
          plannedAction: 1
        }
      },
      waitingJobs: [],
      completedJobs: []
    });
  });

  it('returns the authoritative JobManager snapshot on request', async () =>
  {
    const {runtimeMessageListener} = await loadBackground();
    const activeSignal = await startSingleJob(runtimeMessageListener);
    const sendResponse = vi.fn();

    const listenerResult = runtimeMessageListener({
      type: RuntimeMessageType.GET_JOB_SNAPSHOT,
      payload: null
    }, {}, sendResponse);

    expect(listenerResult).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      snapshot: {
        revision: expect.any(Number),
        activeJob: {
          job: {
            id: expect.any(String),
            banSource: BanSource.SINGLE,
            banMode: BanMode.BAN,
            createdAt: expect.any(String)
          },
          phase: expect.any(String),
          progress: {
            successfulAction: 0,
            performedAction: 0,
            plannedAction: 1
          },
          cooldownEndsAt: null,
          cancelRequested: false
        },
        waitingJobs: [],
        completedJobs: []
      }
    });
    expect(activeSignal.aborted).toBe(false);
  });

  it('routes the explicit cancellation message to the active JobManager execution', async () =>
  {
    const {runtimeMessageListener, runtimeSendMessage} = await loadBackground();
    const activeSignal = await startSingleJob(runtimeMessageListener);
    await enqueueWaitingSingleJob(runtimeMessageListener);
    const sendResponse = vi.fn();

    const listenerResult = runtimeMessageListener({
      type: RuntimeMessageType.CANCEL_ALL_JOBS
    }, {}, sendResponse);

    expect(listenerResult).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ok: true});
    expect(activeSignal.aborted).toBe(true);
    expect(activeSignal.reason).toBe('Cancellation requested by the user.');
    expect(fakes.performAction).toHaveBeenCalledOnce();
    expect(runtimeSendMessage).toHaveBeenLastCalledWith({
      type: RuntimeMessageType.JOB_SNAPSHOT,
      payload: expect.objectContaining({
        activeJob: expect.objectContaining({
          phase: JobPhase.CANCELLING,
          cancelRequested: true
        }),
        waitingJobs: []
      })
    });
  });

  it('does not enqueue a request whose configuration load finishes after cancellation', async () =>
  {
    let resolveSettings;
    const storageGet = vi.fn(() => new Promise(resolve =>
    {
      resolveSettings = resolve;
    }));
    const {runtimeMessageListener} = await loadBackground({storageGet});
    const sendResponse = vi.fn();

    runtimeMessageListener({
      type: RuntimeMessageType.ENQUEUE_JOB,
      payload: {
        banSource: BanSource.SINGLE,
        banMode: BanMode.BAN,
        authorName: 'late-target',
        authorId: '9',
        targetType: TargetType.USER
      }
    }, {}, sendResponse);

    await vi.waitFor(() => expect(resolveSettings).toEqual(expect.any(Function)));
    const cancelResponse = vi.fn();
    runtimeMessageListener({
      type: RuntimeMessageType.CANCEL_ALL_JOBS
    }, {}, cancelResponse);

    resolveSettings({config: settings()});

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      errorCode: 'CANCELLED'
    }));
    expect(cancelResponse).toHaveBeenCalledWith({ok: true});
    expect(fakes.performAction).not.toHaveBeenCalled();
  });

  it('cancels only when the tracked notification tab is removed', async () =>
  {
    const {runtimeMessageListener, tabRemovedListener} = await loadBackground();
    const activeSignal = await startSingleJob(runtimeMessageListener);

    tabRemovedListener(41, {});
    expect(activeSignal.aborted).toBe(false);

    tabRemovedListener(42, {});
    expect(activeSignal.aborted).toBe(true);
    expect(activeSignal.reason).toBe('The notification tab was closed.');
  });
});
