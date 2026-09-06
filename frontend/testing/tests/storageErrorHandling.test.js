import {afterEach, describe, expect, it, vi} from 'vitest';
import {RuntimeMessageResponseErrorCode} from '../../app/assets/js/enums.js';

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
  it('merges stored values over defaults and persists the result', async () =>
  {
    const storedConfig = {enableMute: true};
    const set = vi.fn().mockResolvedValue();
    stubStorage({get: vi.fn().mockResolvedValue({config: storedConfig}), set});
    const {handleConfig, CONFIG_VERSION} = await import('../../app/assets/js/config.js');

    const loadedConfig = await handleConfig();

    expect(loadedConfig).toMatchObject({
      configVersion: CONFIG_VERSION,
      enableMute: true,
      enableTitleBan: true
    });
    expect(set).toHaveBeenCalledWith({config: loadedConfig});
  });

  it('always uses the latest application-controlled configuration values', async () =>
  {
    const storedConfig = {
      configVersion: 0,
      EksiSozlukURL: 'https://old-eksi.example',
      serverURL: 'https://old-server.example',
      enableMute: true
    };
    const set = vi.fn().mockResolvedValue();
    stubStorage({get: vi.fn().mockResolvedValue({config: storedConfig}), set});
    const {handleConfig, saveConfig, CONFIG_VERSION} = await import('../../app/assets/js/config.js');

    const loadedConfig = await handleConfig();

    expect(loadedConfig).toMatchObject({
      configVersion: CONFIG_VERSION,
      EksiSozlukURL: 'https://eksisozluk.com',
      serverURL: 'https://eksiengel.hesimsek.com/api/action/',
      enableMute: true
    });

    await saveConfig({
      configVersion: 0,
      EksiSozlukURL: 'https://overridden-eksi.example',
      serverURL: 'https://overridden-server.example'
    });

    expect(set).toHaveBeenLastCalledWith({
      config: expect.objectContaining({
        configVersion: CONFIG_VERSION,
        EksiSozlukURL: 'https://eksisozluk.com',
        serverURL: 'https://eksiengel.hesimsek.com/api/action/'
      })
    });
  });

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

describe('author-list page storage', () =>
{
  function createAuthorListPageElements(listValue = 'first-author')
  {
    const listeners = {};
    const elements = {
      userList: {value: listValue},
      startBan: {
        addEventListener: (_event, listener) => { listeners.startBan = listener; }
      },
      startUndoban: {
        addEventListener: (_event, listener) => { listeners.startUndoban = listener; }
      },
      status: {innerHTML: '', style: {display: ''}}
    };

    return {listeners, elements};
  }

  it('waits for storage and sends the saved list snapshot in the ban request', async () =>
  {
    const {listeners, elements} = createAuthorListPageElements('first-author\nsecond-author');
    let finishStorageWrite;
    const storageWrite = new Promise(resolve => { finishStorageWrite = resolve; });
    const set = vi.fn().mockReturnValue(storageWrite);
    const sendMessage = vi.fn().mockResolvedValue({ok: true, jobId: 'job-1'});

    stubStorage({set});
    chrome.runtime.sendMessage = sendMessage;
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('setInterval', vi.fn());

    await import('../../app/assets/js/authorListPage.js');
    const submission = listeners.startBan();

    expect(set).toHaveBeenCalledWith({userList: 'first-author\nsecond-author'});
    expect(sendMessage).not.toHaveBeenCalled();

    finishStorageWrite();
    await submission;

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'ENQUEUE_JOB',
      payload: {
        banSource: '4',
        banMode: '1',
        authorListText: 'first-author\nsecond-author'
      }
    });
  });

  it('captures a separate list value for each submission', async () =>
  {
    const {listeners, elements} = createAuthorListPageElements('first-author');
    const sendMessage = vi.fn().mockResolvedValue({ok: true, jobId: 'job-1'});

    stubStorage({set: vi.fn().mockResolvedValue()});
    chrome.runtime.sendMessage = sendMessage;
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('setInterval', vi.fn());

    await import('../../app/assets/js/authorListPage.js');
    await listeners.startBan();
    elements.userList.value = 'second-author';
    await listeners.startUndoban();

    expect(sendMessage.mock.calls).toEqual([
      [{
        type: 'ENQUEUE_JOB',
        payload: {banSource: '4', banMode: '1', authorListText: 'first-author'}
      }],
      [{
        type: 'ENQUEUE_JOB',
        payload: {banSource: '4', banMode: '2', authorListText: 'second-author'}
      }]
    ]);
  });

  it('shows an error and does not enqueue when the write fails', async () =>
  {
    const {listeners, elements} = createAuthorListPageElements();
    const storageError = new Error('user list write failed');
    const alert = vi.fn();

    stubStorage({set: vi.fn().mockRejectedValue(storageError)});
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('alert', alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../../app/assets/js/authorListPage.js');
    await listeners.startBan();

    expect(alert).toHaveBeenCalledWith('Yazar listesi yerel hafızaya kaydedilemedi.');
    expect(elements.status.innerHTML).toBe('');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not show queued feedback when configuration prevents acceptance', async () =>
  {
    const {listeners, elements} = createAuthorListPageElements();
    const alert = vi.fn();

    stubStorage({set: vi.fn().mockResolvedValue()});
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      ok: false,
      errorCode: RuntimeMessageResponseErrorCode.JOB_ENQUEUE_FAILED
    });
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('alert', alert);
    vi.stubGlobal('setInterval', vi.fn());

    await import('../../app/assets/js/authorListPage.js');
    await listeners.startBan();

    expect(alert).toHaveBeenCalledWith(
      'Ayarlar yüklenemediği için işlem sıraya eklenemedi.'
    );
    expect(elements.status.innerHTML).toBe('');
  });

  it('reports a runtime messaging failure without showing queued feedback', async () =>
  {
    const {listeners, elements} = createAuthorListPageElements();
    const alert = vi.fn();
    const messageError = new Error('service worker unavailable');

    stubStorage({set: vi.fn().mockResolvedValue()});
    chrome.runtime.sendMessage = vi.fn().mockRejectedValue(messageError);
    vi.stubGlobal('document', {
      getElementById: id => elements[id]
    });
    vi.stubGlobal('alert', alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../../app/assets/js/authorListPage.js');
    await listeners.startBan();

    expect(alert).toHaveBeenCalledWith('İşlem isteği gönderilemedi.');
    expect(elements.status.innerHTML).toBe('');
  });
});
