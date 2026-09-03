import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {BanMode, BanSource, RuntimeMessageType, TargetType} from '../../app/assets/js/enums.js';

const fakes = vi.hoisted(() => ({
  checkAccess: vi.fn(),
  getCurrentAccount: vi.fn(),
  performAction: vi.fn(),
  notification: {
    updatePlannedProcessesList: vi.fn(),
    finishErrorEarlyStop: vi.fn(),
    notifyControlAccess: vi.fn(),
    notifyControlLogin: vi.fn(),
    notifyOngoing: vi.fn(),
    finishSuccess: vi.fn()
  }
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

vi.mock('../../app/assets/js/notificationHandler.js', () => ({
  notificationHandler: fakes.notification
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

async function loadBackground()
{
  let runtimeMessageListener;
  let tabRemovedListener;

  vi.stubGlobal('chrome', {
    runtime: {
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
      create: vi.fn().mockResolvedValue({id: 42})
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({config: settings()}),
        set: vi.fn(),
        clear: vi.fn()
      }
    }
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});

  await import('../../app/assets/js/background.js');
  return {runtimeMessageListener, tabRemovedListener};
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
  it('routes the explicit cancellation message to the active JobManager execution', async () =>
  {
    const {runtimeMessageListener} = await loadBackground();
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
    expect(fakes.notification.updatePlannedProcessesList).toHaveBeenLastCalledWith([]);
    expect(fakes.notification.finishErrorEarlyStop).toHaveBeenCalledOnce();
    expect(fakes.notification.finishErrorEarlyStop)
      .toHaveBeenCalledWith(BanSource.SINGLE, BanMode.BAN);
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
