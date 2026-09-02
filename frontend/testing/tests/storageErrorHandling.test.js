import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() =>
{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubStorage({get, set})
{
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: get ?? vi.fn(),
        set: set ?? vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn()
    }
  });
}

describe('configuration storage', () =>
{
  it('returns false only when the config key is missing', async () =>
  {
    stubStorage({get: vi.fn().mockResolvedValue({})});
    const {getConfig} = await import('../../app/assets/js/config.js');

    await expect(getConfig()).resolves.toBe(false);
  });

  it('propagates config read failures', async () =>
  {
    const storageError = new Error('config read failed');
    stubStorage({get: vi.fn().mockRejectedValue(storageError)});
    const {getConfig} = await import('../../app/assets/js/config.js');

    await expect(getConfig()).rejects.toBe(storageError);
  });

  it('propagates config write failures', async () =>
  {
    const storageError = new Error('config write failed');
    stubStorage({set: vi.fn().mockRejectedValue(storageError)});
    const {saveConfig} = await import('../../app/assets/js/config.js');

    await expect(saveConfig({sendData: true})).rejects.toBe(storageError);
  });

  it('waits for the default config write and propagates its failure', async () =>
  {
    const storageError = new Error('default config write failed');
    stubStorage({
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockRejectedValue(storageError)
    });
    const {handleConfig} = await import('../../app/assets/js/config.js');

    await expect(handleConfig()).rejects.toBe(storageError);
  });
});

describe('user-list storage', () =>
{
  it('returns an empty list only when the userList key is missing', async () =>
  {
    stubStorage({get: vi.fn().mockResolvedValue({})});
    const {getUserList} = await import('../../app/assets/js/utils.js');

    await expect(getUserList()).resolves.toEqual([]);
  });

  it('propagates user-list read failures', async () =>
  {
    const storageError = new Error('user list read failed');
    stubStorage({get: vi.fn().mockRejectedValue(storageError)});
    const {getUserList} = await import('../../app/assets/js/utils.js');

    await expect(getUserList()).rejects.toBe(storageError);
  });
});

describe('author-list page storage', () =>
{
  it('shows an error instead of saved feedback when the write fails', async () =>
  {
    const listeners = {};
    const elements = {
      userList: {value: 'first-author'},
      startBan: {
        addEventListener: (_event, listener) => { listeners.startBan = listener; }
      },
      startUndoban: {
        addEventListener: (_event, listener) => { listeners.startUndoban = listener; }
      },
      status: {innerHTML: '', style: {display: ''}}
    };
    const storageError = new Error('user list write failed');
    const alert = vi.fn();

    stubStorage({set: vi.fn().mockRejectedValue(storageError)});
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('alert', alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../../app/assets/js/authorListPage.js');
    listeners.startBan();
    await Promise.resolve();
    await Promise.resolve();

    expect(alert).toHaveBeenCalledWith('Yazar listesi yerel hafızaya kaydedilemedi.');
    expect(elements.status.innerHTML).toBe('');
  });
});
