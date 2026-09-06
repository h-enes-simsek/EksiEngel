import {describe, expect, it} from 'vitest';

import {createJobTelemetry} from '../../app/assets/js/jobs/jobTelemetry.js';

describe('createJobTelemetry', () =>
{
  it('includes the queued job ID in the Action payload', () =>
  {
    const telemetry = createJobTelemetry({
      jobId: 'job-123',
      jobDuration: 456,
      request: {},
      authorList: [],
      entryMetaData: {},
      userAgent: 'test-agent',
      clientName: 'client',
      clientId: '1',
      successfulAction: 1,
      performedAction: 1,
      plannedAction: 1,
      earlyStopped: false,
      version: '3.3',
      logLevel: 'DISABLED',
      logData: null,
      settings: {configVersion: 7}
    });

    expect(telemetry.action.job_id).toBe('job-123');
    expect(telemetry.action.job_duration).toBe(456);
    expect(telemetry.actionConfig.config_version).toBe(7);
  });
});