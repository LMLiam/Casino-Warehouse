import { describe, expect, it } from 'vitest';
import { CasinoAudio, defaultAudioSettings, sanitizeAudioSettings } from '../../../src/audio/casinoAudio';

describe('casino audio settings', () => {
  it('clamps saved volumes into a valid range', () => {
    expect(
      sanitizeAudioSettings({
        muted: true,
        masterVolume: 2,
        musicVolume: -1,
        effectsVolume: 0.4,
        dealingVolume: 1.5,
        chipsVolume: -2,
        slotsVolume: 0.25,
      }),
    ).toMatchObject({
      muted: true,
      masterVolume: 1,
      musicVolume: 0,
      effectsVolume: 0.4,
      dealingVolume: 1,
      chipsVolume: 0,
      slotsVolume: 0.25,
    });
  });

  it('uses defaults for missing or invalid volume fields', () => {
    expect(sanitizeAudioSettings({})).toEqual(defaultAudioSettings());
    expect(sanitizeAudioSettings({ masterVolume: Number.NaN })).toEqual(defaultAudioSettings());
  });

  it('plays generated cues and gracefully stops music when muted', () => {
    const originalAudioContext = globalThis.AudioContext;
    class FakeAudioParam {
      public value = 0;
      public setValueAtTime(value: number): void {
        this.value = value;
      }
      public exponentialRampToValueAtTime(value: number): void {
        this.value = value;
      }
    }
    class FakeNode {
      public readonly gain = new FakeAudioParam();
      public readonly frequency = new FakeAudioParam();
      public type = 'sine';
      public connect(): FakeNode {
        return this;
      }
      public start(): void {}
      public stop(): void {}
    }
    class FakeAudioContext {
      public readonly currentTime = 0;
      public readonly destination = new FakeNode();
      public createGain(): FakeNode {
        return new FakeNode();
      }
      public createOscillator(): FakeNode {
        return new FakeNode();
      }
    }
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;

    const audio = new CasinoAudio();
    audio.play('deal');
    audio.play('chip');
    audio.play('spin');
    audio.play('win');
    audio.play('bonus');
    audio.play('ui');
    audio.play('ambience');
    audio.toggleMusic(true);
    audio.updateSettings({ ...defaultAudioSettings(), muted: true });
    audio.play('deal');

    globalThis.AudioContext = originalAudioContext;
  });
});
