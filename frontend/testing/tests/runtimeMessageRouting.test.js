import {afterEach, describe, expect, it, vi} from 'vitest';

import * as enums from '../../app/assets/js/enums.js';

afterEach(() =>
{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadNotificationPage()
{
  let messageListener;
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: vi.fn(listener => { messageListener = listener; })
      },
      sendMessage: vi.fn().mockResolvedValue({ok: true})
    }
  });
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    getElementById: vi.fn(() => ({innerHTML: '', style: {}}))
  });

  await import('../../app/assets/js/notification.js');
  return messageListener;
}

describe('runtime message routing', () =>
{
  it('notification page ignores unrelated messages without responding', async () =>
  {
    const listener = await loadNotificationPage();
    const sendResponse = vi.fn();

    const result = listener({
      type: enums.RuntimeMessageType.ENQUEUE_JOB,
      payload: {banSource: enums.BanSource.LIST, banMode: enums.BanMode.BAN}
    }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('notification page acknowledges only notification messages', async () =>
  {
    const listener = await loadNotificationPage();
    const sendResponse = vi.fn();
    const statusElement = {innerHTML: ''};
    document.getElementById.mockReturnValue(statusElement);

    const result = listener({
      type: enums.RuntimeMessageType.JOB_NOTIFICATION,
      payload: {
        status: enums.NotificationType.NOTIFY,
        statusText: 'collecting authors'
      }
    }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ok: true});
    expect(statusElement.innerHTML).toBe('collecting authors');
  });
});
