import {describe, expect, it} from 'vitest';

import {createJobRequest} from '../../app/assets/js/jobs/jobRequest.js';

describe('job request snapshots', () =>
{
  it('copies LIST input instead of retaining the runtime message', () =>
  {
    const message = {
      banSource: 'list',
      banMode: 'ban',
      authorListText: 'first-author\nsecond-author'
    };

    const request = createJobRequest(message);
    message.authorListText = 'changed-after-acceptance';

    expect(request.authorListText).toBe('first-author\nsecond-author');
  });
});
