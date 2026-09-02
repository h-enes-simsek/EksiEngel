import {afterEach, describe, expect, it, vi} from 'vitest';

const controls = [
  ["sendData", "sendDataEnabled", "sendDataDisabled"],
  ["enableTitleBan", "titleBanEnabled", "titleBanDisabled"],
  ["enableNoobBan", "noobBanEnabled", "noobBanDisabled"],
  ["enableMute", "muteEnabled", "muteDisabled"],
  ["enableProtectFollowedUsers", "protectFollowedUsersEnabled", "protectFollowedUsersDisabled"],
  ["enableOnlyRequiredActions", "onlyRequiredActionsEnabled", "onlyRequiredActionsDisabled"],
  ["banPremiumIcons", "banPremiumIconsEnabled", "banPremiumIconsDisabled"]
];

afterEach(() =>
{
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('FAQ settings', () =>
{
  it('uses handleConfig results and saves changes without importing mutable config', async () =>
  {
    const storedSettings = Object.fromEntries(
      controls.map(([key], index) => [key, index % 2 === 0])
    );
    const set = vi.fn().mockResolvedValue();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({config: storedSettings}),
          set
        }
      }
    });

    const clickListeners = {};
    const elements = {};
    for(const [, enabledId, disabledId] of controls)
    {
      for(const id of [enabledId, disabledId])
      {
        elements[id] = {
          checked: false,
          addEventListener: vi.fn((_event, listener) =>
          {
            clickListeners[id] = listener;
          })
        };
      }
    }

    let initialize;
    vi.stubGlobal('document', {
      addEventListener: vi.fn((_event, listener) => { initialize = listener; }),
      getElementById: vi.fn(id => elements[id])
    });
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await import('../../app/assets/js/faq.js');
    await initialize();

    for(const [key, enabledId, disabledId] of controls)
    {
      expect(elements[enabledId].checked).toBe(storedSettings[key]);
      expect(elements[disabledId].checked).toBe(!storedSettings[key]);
    }

    elements.sendDataEnabled.checked = false;
    clickListeners.sendDataDisabled();

    expect(storedSettings.sendData).toBe(false);
    expect(set).toHaveBeenCalledWith({config: storedSettings});

    const configModule = await import('../../app/assets/js/config.js');
    expect(configModule).not.toHaveProperty('config');
  });
});
