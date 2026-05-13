import { afterEach, describe, expect, it, vi } from 'vitest';
import { CasinoAudio } from '../../../src/audio/casinoAudio/CasinoAudio';
import { AudioControls } from '../../../src/app/views/AudioControls';
import type { AppElements } from '../../../src/app/dom/appElements/AppElements';

describe('audio controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps audio controls usable when settings persistence fails', () => {
    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });

    const audio = new CasinoAudio();
    const updateSettings = vi.spyOn(audio, 'updateSettings');
    const toggleMusic = vi.spyOn(audio, 'toggleMusic').mockImplementation(() => {});
    const storage: Storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
    };
    const audioElements = createAudioElements();
    const controls = new AudioControls(audioElements.elements, audio, storage);
    controls.bind();

    expect(() => {
      audioElements.emit('masterVolume', 'input');
    }).not.toThrow();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        muted: false,
        masterVolume: 0.7,
        musicVolume: 0.6,
        effectsVolume: 0.5,
        dealingVolume: 0.4,
        chipsVolume: 0.3,
        slotsVolume: 0.2,
        winsVolume: 0.8,
        bonusVolume: 0.9,
        uiVolume: 0.25,
        ambienceVolume: 0.15,
      }),
    );
    expect(toggleMusic).toHaveBeenCalledWith(true);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
});

function createAudioElements(): { readonly elements: AppElements; readonly emit: (id: string, type: string) => void } {
  const listeners = new Map<string, VoidFunction[]>();
  const input = (id: string, value: string, checked = false): HTMLInputElement => {
    const addEventListener = (type: string, listener: EventListenerOrEventListenerObject): void => {
      const key = `${id}:${type}`;
      const callbacks = listeners.get(key) ?? [];
      callbacks.push(() => {
        if (typeof listener === 'function') {
          listener(new Event(type));
        } else {
          listener.handleEvent(new Event(type));
        }
      });
      listeners.set(key, callbacks);
    };
    const element: Partial<HTMLInputElement> = {
      addEventListener: vi.fn(addEventListener) as HTMLInputElement['addEventListener'],
      checked,
      value,
    };
    return element as HTMLInputElement;
  };

  return {
    elements: {
      muteToggle: input('muteToggle', '0'),
      masterVolume: input('masterVolume', '0.7'),
      musicVolume: input('musicVolume', '0.6'),
      effectsVolume: input('effectsVolume', '0.5'),
      dealingVolume: input('dealingVolume', '0.4'),
      chipsVolume: input('chipsVolume', '0.3'),
      slotsVolume: input('slotsVolume', '0.2'),
      winsVolume: input('winsVolume', '0.8'),
      bonusVolume: input('bonusVolume', '0.9'),
      uiVolume: input('uiVolume', '0.25'),
      ambienceVolume: input('ambienceVolume', '0.15'),
    } as AppElements,
    emit: (id, type) => {
      for (const callback of listeners.get(`${id}:${type}`) ?? []) {
        callback();
      }
    },
  };
}
