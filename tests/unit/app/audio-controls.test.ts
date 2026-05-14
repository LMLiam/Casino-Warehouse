import { afterEach, describe, expect, it, vi } from 'vitest';
import { CasinoAudio } from '../../../src/audio/casinoAudio/CasinoAudio';
import { defaultAudioSettings } from '../../../src/audio/casinoAudio/defaultAudioSettings';
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

  it('loads persisted settings into fallback controls and updates from dialog-mounted controls', () => {
    const dialogMount = createEventTarget();
    const dialogElements = createAudioElements();
    const document = createAudioDocument(dialogMount, dialogElements.elements);
    const setTimeout = vi.fn((callback: VoidFunction) => {
      callback();
      return 0;
    });
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', { setTimeout });

    const audio = new CasinoAudio();
    const updateSettings = vi.spyOn(audio, 'updateSettings');
    const toggleMusic = vi.spyOn(audio, 'toggleMusic').mockImplementation(() => {});
    const storage: Storage = {
      length: 1,
      clear: vi.fn(),
      getItem: vi.fn(() =>
        JSON.stringify({
          muted: true,
          masterVolume: 0.4,
          musicVolume: 0.3,
          effectsVolume: 0.2,
          dealingVolume: 0.1,
          chipsVolume: 0.5,
          slotsVolume: 0.6,
          winsVolume: 0.7,
          bonusVolume: 0.8,
          uiVolume: 0.9,
          ambienceVolume: 1,
        }),
      ),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    const fallbackElements = createAudioElements();
    const controls = new AudioControls(fallbackElements.elements, audio, storage);

    controls.bind();
    controls.load();

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ muted: true, masterVolume: 0.4, ambienceVolume: 1 }));
    expect(dialogElements.elements.muteToggle.checked).toBe(true);
    expect(dialogElements.elements.masterVolume.value).toBe('0.4');

    dialogElements.elements.muteToggle.checked = false;
    dialogElements.elements.musicVolume.value = '0';
    dialogMount.emit('click', createClosestButtonEvent('Audio'));
    dialogMount.emit('click', createClosestButtonEvent('Rules'));
    dialogMount.emit('change', createTargetEvent({ id: 'musicVolume' }));
    dialogMount.emit('input', createTargetEvent({ matches: () => false }));
    dialogMount.emit('change', createTargetEvent({ id: 'muteToggle' }));
    dialogMount.emit('input', createTargetEvent({ matches: () => true }));

    expect(setTimeout).toHaveBeenCalledOnce();
    expect(toggleMusic).toHaveBeenLastCalledWith(false);
    expect(storage.setItem).toHaveBeenCalledWith('casino_audio_settings_v1', expect.stringContaining('"musicVolume":0'));
  });

  it('falls back to default settings when persisted JSON is invalid or browser storage is unavailable', () => {
    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    });

    const audio = new CasinoAudio();
    const updateSettings = vi.spyOn(audio, 'updateSettings');
    const fallbackElements = createAudioElements();
    const controls = new AudioControls(fallbackElements.elements, audio);

    controls.load();

    expect(updateSettings).toHaveBeenCalledWith(defaultAudioSettings());
    expect(fallbackElements.elements.masterVolume.value).toBe('0.55');
  });

  it('loads defaults when browser storage is absent', () => {
    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });
    vi.stubGlobal('localStorage', undefined);

    const audio = new CasinoAudio();
    const updateSettings = vi.spyOn(audio, 'updateSettings');
    const controls = new AudioControls(createAudioElements().elements, audio);

    controls.load();

    expect(updateSettings).toHaveBeenCalledWith(defaultAudioSettings());
  });
});

function createAudioElements(): {
  readonly elements: AppElements;
  readonly emit: (id: string, type: string, event?: Partial<Event>) => void;
} {
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
    emit: (id, type, event = new Event(type)) => {
      for (const callback of listeners.get(`${id}:${type}`) ?? []) {
        callback.call(event);
      }
    },
  };
}

function createEventTarget(): { readonly addEventListener: ReturnType<typeof vi.fn>; readonly emit: (type: string, event: Partial<Event>) => void } {
  const listeners = new Map<string, EventListener[]>();
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    }),
    emit: (type, event) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event as Event);
      }
    },
  };
}

function createAudioDocument(dialogMount: ReturnType<typeof createEventTarget>, controls: AppElements): Pick<Document, 'querySelector'> {
  return {
    querySelector: vi.fn((selector: string) => {
      if (selector === '#setupRadixDialogs') {
        return dialogMount;
      }
      if (selector.startsWith('#')) {
        return controls[selector.slice(1) as keyof AppElements] ?? null;
      }
      return null;
    }),
  };
}

function createClosestButtonEvent(textContent: string): Partial<Event> {
  return createTargetEvent({
    closest: (selector: string) => (selector === 'button' ? { textContent } : null),
  });
}

function createTargetEvent(target: unknown): Partial<Event> {
  return { target: target as EventTarget };
}
