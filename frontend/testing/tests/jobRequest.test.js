import {describe, expect, it} from 'vitest';

import {createJobRequest} from '../../app/assets/js/jobs/jobRequest.js';
import {BanSource, BanMode} from '../../app/assets/js/enums.js';

describe('job request snapshots', () =>
{
  it('copies LIST input instead of retaining the runtime message', () =>
  {
    const message = {
      banSource: BanSource.LIST,
      banMode: BanMode.BAN,
      authorListText: 'first-author\nsecond-author'
    };

    const request = createJobRequest(message);
    message.authorListText = 'changed-after-acceptance';

    expect(request.authorListText).toBe('first-author\nsecond-author');
  });

  it.each([
    undefined, null, [], 'invalid', {},
    {banSource: BanSource.LIST},
    {banMode: BanMode.BAN},
    {banSource: 'unknown', banMode: BanMode.BAN},
    {banSource: BanSource.LIST, banMode: 'unknown'}
  ])('rejects invalid payloads and source/mode values: %j', payload =>
  {
    expect(() => createJobRequest(payload)).toThrow(TypeError);
  });

  it.each([undefined, null])('requires authorListText for LIST requests: %j', authorListText =>
  {
    expect(() => createJobRequest({
      banSource: BanSource.LIST,
      banMode: BanMode.BAN,
      authorListText
    })).toThrow('LIST job requires authorListText');
  });

  it.each([
    'entryUrl', 'authorName', 'authorId', 'targetType', 'clickSource',
    'titleName', 'titleId', 'timeSpecifier', 'authorListText'
  ])('checks the type of optional %s without enforcing its format', field =>
  {
    const payload = {banSource: BanSource.SINGLE, banMode: BanMode.BAN};
    for(const value of [7, false, [], {}])
      expect(() => createJobRequest({...payload, [field]: value})).toThrow(TypeError);

    for(const value of [undefined, null, '', 'any-string'])
      expect(createJobRequest({...payload, [field]: value})[field]).toBe(value);
  });

  it('allows omitted source-specific inputs and ignores extra keys', () =>
  {
    const payload = Object.freeze({
      banSource: BanSource.TITLE,
      banMode: BanMode.UNDOBAN,
      extra: {ignored: true}
    });
    const request = createJobRequest(payload);

    expect(request).toMatchObject({banSource: payload.banSource, banMode: payload.banMode});
    expect(request.titleId).toBeUndefined();
    expect(request).not.toHaveProperty('extra');
  });
});
