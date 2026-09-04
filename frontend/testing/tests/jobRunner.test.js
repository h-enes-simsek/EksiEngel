import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  BanMode,
  BanSource,
  JobPhase,
  ProcessFinishReason,
  TargetType
} from '../../app/assets/js/enums.js';
import {runJob} from '../../app/assets/js/jobs/jobRunner.js';
import {RelationActionStatus} from '../../app/assets/js/relationHandler.js';

const BASE_SETTINGS = {
  EksiSozlukURL: 'https://snapshot.example',
  serverURL: 'https://telemetry.example/api/action/',
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

function createTestJob(request)
{
  return {
    id: 'job-runner-test',
    request,
    settings: BASE_SETTINGS,
    createdAt: '2026-09-03T12:00:00.000Z'
  };
}

function createDependencies(overrides = {})
{
  const reporter = {
    reportPhase: vi.fn(),
    reportProgress: vi.fn(),
    reportCooldown: vi.fn()
  };
  const scrapingHandler = {
    getCurrentAccount: vi.fn().mockResolvedValue({
      authorName: 'owner',
      authorId: '1'
    })
  };
  const relationHandler = {
    performAction: vi.fn().mockResolvedValue({
      status: RelationActionStatus.COMPLETED,
      actionPerformed: true,
      actionSucceeded: true
    })
  };

  return {
    signal: new AbortController().signal,
    settings: BASE_SETTINGS,
    reporter,
    scrapingHandler,
    relationHandler,
    telemetryReporter: {submit: vi.fn()},
    accessChecker: vi.fn().mockResolvedValue(true),
    cooldownWaiter: vi.fn().mockResolvedValue(undefined),
    userAgent: 'job-runner-test-agent',
    extensionVersion: '3.3-test',
    onTelemetryError: vi.fn(),
    ...overrides
  };
}

function singleRequest()
{
  return {
    banSource: BanSource.SINGLE,
    banMode: BanMode.BAN,
    authorName: 'target',
    authorId: '7',
    targetType: TargetType.USER
  };
}

beforeEach(() =>
{
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() =>
{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('runJob', () =>
{
  it('executes a job without Chrome globals and reports complete progress', async () =>
  {
    vi.stubGlobal('chrome', undefined);
    const job = createTestJob(singleRequest());
    const dependencies = createDependencies();

    const result = await runJob(job, dependencies);

    expect(result).toMatchObject({
      jobId: job.id,
      finishReason: ProcessFinishReason.SUCCESS,
      successfulAction: 1,
      performedAction: 1,
      plannedAction: 1,
      errorMessage: null
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(dependencies.reporter.reportPhase.mock.calls.map(([phase]) => phase))
      .toEqual([
        JobPhase.CHECKING_ACCESS,
        JobPhase.CHECKING_LOGIN,
        JobPhase.EXECUTING_RELATIONS
      ]);
    expect(dependencies.reporter.reportProgress.mock.calls.map(([progress]) => progress))
      .toEqual([
        {successfulAction: 0, performedAction: 0, plannedAction: 1},
        {successfulAction: 1, performedAction: 1, plannedAction: 1}
      ]);
    expect(dependencies.relationHandler.performAction).toHaveBeenCalledWith(
      BanMode.BAN,
      '7',
      true,
      false,
      false,
      {signal: dependencies.signal, baseUrl: BASE_SETTINGS.EksiSozlukURL}
    );
  });

  it('preserves the single retry after a relation rate limit', async () =>
  {
    const retryResult = {
      status: RelationActionStatus.RETRY_REQUIRED,
      actionPerformed: false,
      actionSucceeded: null
    };
    const completedResult = {
      status: RelationActionStatus.COMPLETED,
      actionPerformed: true,
      actionSucceeded: true
    };
    const relationHandler = {
      performAction: vi.fn()
        .mockResolvedValueOnce(retryResult)
        .mockResolvedValueOnce(completedResult)
    };
    const cooldownWaiter = vi.fn(async ({seconds, signal, onTick}) =>
    {
      expect(seconds).toBe(62);
      expect(signal.aborted).toBe(false);
      onTick(61);
    });
    const dependencies = createDependencies({relationHandler, cooldownWaiter});

    const result = await runJob(createTestJob(singleRequest()), dependencies);

    expect(result.finishReason).toBe(ProcessFinishReason.SUCCESS);
    expect(relationHandler.performAction).toHaveBeenCalledTimes(2);
    expect(relationHandler.performAction.mock.calls[1])
      .toEqual(relationHandler.performAction.mock.calls[0]);
    expect(cooldownWaiter).toHaveBeenCalledOnce();
    expect(dependencies.reporter.reportCooldown).toHaveBeenCalledTimes(3);
    expect(dependencies.reporter.reportCooldown.mock.calls[0][0]).toMatchObject({
      remainingSeconds: 62,
      cooldownEndsAt: expect.any(String)
    });
    expect(dependencies.reporter.reportCooldown.mock.calls[1][0]).toMatchObject({
      remainingSeconds: 61,
      cooldownEndsAt: expect.any(String)
    });
    expect(dependencies.reporter.reportCooldown.mock.calls[2][0]).toEqual({
      remainingSeconds: 0,
      cooldownEndsAt: null
    });
  });

  it('does not retry when cancellation arrives during cooldown', async () =>
  {
    const abortController = new AbortController();
    const relationHandler = {
      performAction: vi.fn().mockResolvedValue({
        status: RelationActionStatus.RETRY_REQUIRED,
        actionPerformed: false,
        actionSucceeded: null
      })
    };
    const cooldownWaiter = vi.fn(async () =>
    {
      abortController.abort('test cancellation');
    });
    const dependencies = createDependencies({
      signal: abortController.signal,
      relationHandler,
      cooldownWaiter
    });

    const result = await runJob(createTestJob(singleRequest()), dependencies);

    expect(result.finishReason).toBe(ProcessFinishReason.CANCELLED);
    expect(relationHandler.performAction).toHaveBeenCalledOnce();
  });

  it('does not accept a relation result completed after cancellation', async () =>
  {
    const abortController = new AbortController();
    let resolveRelation;
    const relationHandler = {
      performAction: vi.fn().mockImplementation(() => new Promise(resolve =>
      {
        resolveRelation = resolve;
      }))
    };
    const dependencies = createDependencies({
      signal: abortController.signal,
      relationHandler
    });
    const runPromise = runJob(createTestJob(singleRequest()), dependencies);

    await vi.waitFor(() => expect(resolveRelation).toEqual(expect.any(Function)));
    abortController.abort('test cancellation');
    resolveRelation({
      status: RelationActionStatus.COMPLETED,
      actionPerformed: true,
      actionSucceeded: true
    });

    await expect(runPromise).resolves.toMatchObject({
      finishReason: ProcessFinishReason.CANCELLED,
      successfulAction: 0,
      performedAction: 0
    });
    expect(relationHandler.performAction).toHaveBeenCalledOnce();
  });

  it('returns the access-check terminal result', async () =>
  {
    const dependencies = createDependencies({
      accessChecker: vi.fn().mockResolvedValue(false)
    });

    const result = await runJob(createTestJob(singleRequest()), dependencies);

    expect(result.finishReason).toBe(ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE);
    expect(dependencies.scrapingHandler.getCurrentAccount).not.toHaveBeenCalled();
    expect(dependencies.relationHandler.performAction).not.toHaveBeenCalled();
  });

  it('returns the login-check terminal result', async () =>
  {
    const scrapingHandler = {
      getCurrentAccount: vi.fn().mockResolvedValue(null)
    };
    const dependencies = createDependencies({scrapingHandler});

    const result = await runJob(createTestJob(singleRequest()), dependencies);

    expect(result.finishReason).toBe(ProcessFinishReason.CLIENT_NOT_LOGGED_IN);
    expect(dependencies.relationHandler.performAction).not.toHaveBeenCalled();
  });

  it('returns the list-loading and no-account terminal results', async () =>
  {
    const missingListJob = createTestJob({
      banSource: BanSource.LIST,
      banMode: BanMode.BAN
    });
    const emptyListJob = createTestJob({
      banSource: BanSource.LIST,
      banMode: BanMode.BAN,
      authorListText: '\n  \n'
    });

    await expect(runJob(missingListJob, createDependencies()))
      .resolves.toMatchObject({finishReason: ProcessFinishReason.USER_LIST_LOADING});
    await expect(runJob(emptyListJob, createDependencies()))
      .resolves.toMatchObject({finishReason: ProcessFinishReason.NO_ACCOUNTS_FOUND});
  });

  it('skips unresolved list authors and continues with the remaining authors', async () =>
  {
    const scrapingHandler = {
      getCurrentAccount: vi.fn().mockResolvedValue({
        authorName: 'owner',
        authorId: '1'
      }),
      getAuthor: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({authorName: 'valid-author', authorId: '7'})
    };
    const dependencies = createDependencies({scrapingHandler});
    const job = createTestJob({
      banSource: BanSource.LIST,
      banMode: BanMode.BAN,
      authorListText: 'typo-author\nvalid-author'
    });

    const result = await runJob(job, dependencies);

    expect(result).toMatchObject({
      finishReason: ProcessFinishReason.SUCCESS,
      successfulAction: 1,
      performedAction: 1,
      plannedAction: 2
    });
    expect(dependencies.relationHandler.performAction).toHaveBeenCalledOnce();
    expect(dependencies.relationHandler.performAction).toHaveBeenCalledWith(
      BanMode.BAN,
      '7',
      true,
      true,
      false,
      {signal: dependencies.signal, baseUrl: BASE_SETTINGS.EksiSozlukURL}
    );
  });

  it('converts an execution exception into an unexpected-error result', async () =>
  {
    const dependencies = createDependencies({
      accessChecker: vi.fn().mockRejectedValue(new Error('access exploded'))
    });

    const result = await runJob(createTestJob(singleRequest()), dependencies);

    expect(result).toMatchObject({
      finishReason: ProcessFinishReason.UNEXPECTED_ERROR,
      successfulAction: 0,
      performedAction: 0,
      plannedAction: 0,
      errorMessage: 'access exploded'
    });
  });

  it('retains completed counters when cancellation stops relation execution', async () =>
  {
    const abortController = new AbortController();
    const relationHandler = {
      performAction: vi.fn().mockImplementationOnce(async () => ({
        status: RelationActionStatus.COMPLETED,
        actionPerformed: true,
        actionSucceeded: true
      })).mockImplementationOnce(async () =>
      {
        abortController.abort('test cancellation');
        return {
          status: RelationActionStatus.ABORTED,
          actionPerformed: false,
          actionSucceeded: null
        };
      })
    };
    const scrapingHandler = {
      getCurrentAccount: vi.fn().mockResolvedValue({authorName: 'owner', authorId: '1'}),
      listFollowers: vi.fn().mockResolvedValue(new Map([
        ['first', {authorId: '8'}],
        ['second', {authorId: '9'}],
        ['third', {authorId: '10'}]
      ]))
    };
    const dependencies = createDependencies({
      signal: abortController.signal,
      relationHandler,
      scrapingHandler
    });
    const job = createTestJob({
      banSource: BanSource.FOLLOW,
      banMode: BanMode.BAN,
      authorName: 'target'
    });

    const result = await runJob(job, dependencies);

    expect(result).toMatchObject({
      finishReason: ProcessFinishReason.CANCELLED,
      successfulAction: 1,
      performedAction: 1,
      plannedAction: 3
    });
    expect(relationHandler.performAction).toHaveBeenCalledTimes(2);
  });

  it('reports collection and analysis phases through the injected reporter', async () =>
  {
    const relation = {
      authorId: '9',
      isBlockedUser: null,
      areTitlesBlocked: null,
      isMuted: null
    };
    const scrapingHandler = {
      getCurrentAccount: vi.fn().mockResolvedValue({authorName: 'owner', authorId: '1'}),
      listFollowers: vi.fn().mockResolvedValue(new Map([['candidate', relation]])),
      listFollowing: vi.fn().mockResolvedValue(new Map()),
      listOwnRelations: vi.fn().mockResolvedValue(new Map([
        ['candidate', {
          isBlockedUser: false,
          areTitlesBlocked: false,
          isMuted: false
        }]
      ]))
    };
    const settings = {
      ...BASE_SETTINGS,
      enableAnalysisBeforeOperation: true,
      enableProtectFollowedUsers: true,
      enableOnlyRequiredActions: true
    };
    const dependencies = createDependencies({settings, scrapingHandler});
    const job = createTestJob({
      banSource: BanSource.FOLLOW,
      banMode: BanMode.BAN,
      authorName: 'target'
    });

    const result = await runJob(job, dependencies);

    expect(result.finishReason).toBe(ProcessFinishReason.SUCCESS);
    expect(dependencies.reporter.reportPhase.mock.calls.map(([phase]) => phase))
      .toEqual([
        JobPhase.CHECKING_ACCESS,
        JobPhase.CHECKING_LOGIN,
        JobPhase.COLLECTING_FOLLOWERS,
        JobPhase.COLLECTING_EXISTING_RELATIONS,
        JobPhase.ANALYSING_PROTECTED_USERS,
        JobPhase.COLLECTING_EXISTING_RELATIONS,
        JobPhase.ANALYSING_REQUIRED_ACTIONS,
        JobPhase.EXECUTING_RELATIONS
      ]);
  });

  it('uses injected runtime metadata at the telemetry boundary', async () =>
  {
    const telemetryReporter = {submit: vi.fn()};
    const settings = {...BASE_SETTINGS, sendData: true};
    const dependencies = createDependencies({settings, telemetryReporter});

    await runJob(createTestJob(singleRequest()), dependencies);

    expect(telemetryReporter.submit).toHaveBeenCalledOnce();
    const [telemetry, context] = telemetryReporter.submit.mock.calls[0];
    expect(telemetry.action.version).toBe('3.3-test');
    expect(telemetry.action.user_agent).toBe('job-runner-test-agent');
    expect(telemetry.action.job_id).toBe('job-runner-test');
    expect(telemetry.action.job_duration).toEqual(expect.any(Number));
    expect(Number.isInteger(telemetry.action.job_duration)).toBe(true);
    expect(telemetry.action.job_duration).toBeGreaterThanOrEqual(0);
    expect(context).toEqual({serverUrl: settings.serverURL});
  });
});
