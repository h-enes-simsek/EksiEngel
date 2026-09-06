import {afterEach, describe, expect, it, vi} from 'vitest';

import * as enums from '../../app/assets/js/enums.js';
import {createJob} from '../../app/assets/js/jobs/job.js';
import {JobManager} from '../../app/assets/js/jobs/jobManager.js';
import {JobTelemetryReporter} from '../../app/assets/js/jobs/jobTelemetry.js';
import {notificationHandler} from '../../app/assets/js/notificationHandler.js';
import {RelationHandler} from '../../app/assets/js/relationHandler.js';
import {isEksiSozlukAccessible} from '../../app/assets/js/isEksiSozlukAccessible.js';

afterEach(() =>
{
  vi.unstubAllGlobals();
});

describe('job settings snapshots', () =>
{
  it('creates a detached, immutable settings snapshot', () =>
  {
    const settings = {
      enableMute: false,
      nested: {enabled: true}
    };

    const job = createJob({banSource: 'list', banMode: 'ban'}, settings);
    settings.enableMute = true;
    settings.nested.enabled = false;

    expect(job.settings).toEqual({
      enableMute: false,
      nested: {enabled: true}
    });
    expect(Object.isFrozen(job.settings)).toBe(true);
    expect(Object.isFrozen(job.settings.nested)).toBe(true);
  });

  it('keeps distinct settings for jobs accepted at different times', () =>
  {
    const manager = new JobManager({executeJob: () => new Promise(() => {})});
    const settings = {enableMute: false};

    const first = manager.enqueue({banSource: 'list', banMode: 'ban'}, settings).job;
    settings.enableMute = true;
    const second = manager.enqueue({banSource: 'list', banMode: 'ban'}, settings).job;

    expect(first.settings.enableMute).toBe(false);
    expect(second.settings.enableMute).toBe(true);
  });
});

describe('snapshot-aware request helpers', () =>
{
  it('checks access against the supplied job base URL', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue({status: 200});
    vi.stubGlobal('fetch', fetchImpl);

    await expect(isEksiSozlukAccessible({baseUrl: 'https://snapshot.example'}))
      .resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith('https://snapshot.example', {
      signal: undefined
    });
  });

  it('performs relation requests against the supplied job base URL', async () =>
  {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('0')
    });
    vi.stubGlobal('fetch', fetchImpl);
    const handler = new RelationHandler();

    await handler.performAction(
      enums.BanMode.BAN,
      '7',
      true,
      false,
      false,
      {baseUrl: 'https://snapshot.example'}
    );

    expect(fetchImpl.mock.calls[0][0])
      .toBe('https://snapshot.example/userrelation/addrelation/7?r=m');
  });

  it('uses the supplied job base URL in cooldown notifications', () =>
  {
    const sendMessage = vi.fn().mockResolvedValue();
    vi.stubGlobal('chrome', {
      runtime: {sendMessage}
    });

    notificationHandler.notifyCooldown(30, 'https://snapshot.example');

    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      type: enums.RuntimeMessageType.JOB_NOTIFICATION
    });
    expect(sendMessage.mock.calls[0][0].payload.statusText)
      .toContain("href='https://snapshot.example/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420'");
  });

  it('requires request helpers to receive snapshot URLs', async () =>
  {
    const handler = new RelationHandler();

    await expect(isEksiSozlukAccessible()).rejects.toThrow(TypeError);
    await expect(handler.performAction(
      enums.BanMode.BAN,
      '7',
      true,
      false,
      false
    )).rejects.toThrow(TypeError);
    expect(() => notificationHandler.notifyCooldown(30)).toThrow(TypeError);
  });

  it('forwards job context through the telemetry delivery boundary', async () =>
  {
    const send = vi.fn();
    const reporter = new JobTelemetryReporter({
      isEnabled: () => true,
      send,
      onError: vi.fn()
    });
    const telemetry = {action: 'snapshot'};
    const context = {serverUrl: 'https://snapshot.example/api/action/'};

    expect(reporter.submit(telemetry, context)).toBe(true);
    await Promise.resolve();

    expect(send).toHaveBeenCalledWith(telemetry, context);
  });
});
