import { CasinoAudio } from '../../audio/casinoAudio/CasinoAudio';
import type { CasinoAudioSettings } from '../../audio/casinoAudio/CasinoAudioSettings';
import { defaultAudioSettings } from '../../audio/casinoAudio/defaultAudioSettings';
import { sanitizeAudioSettings } from '../../audio/casinoAudio/sanitizeAudioSettings';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import type { AppElements } from '../dom/appElements/AppElements';

export class AudioControls {
  private settings: CasinoAudioSettings = defaultAudioSettings();

  public constructor(
    private readonly elements: AppElements,
    private readonly audio: CasinoAudio,
    private readonly storage: Storage | undefined = AudioControls.browserStorage(),
  ) {}

  public bind(): void {
    this.elements.muteToggle.addEventListener('change', () => this.updateFromControls());
    this.elements.masterVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.musicVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.effectsVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.dealingVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.chipsVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.slotsVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.winsVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.bonusVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.uiVolume.addEventListener('input', () => this.updateFromControls());
    this.elements.ambienceVolume.addEventListener('input', () => this.updateFromControls());

    const dialogMount = document.querySelector('#setupRadixDialogs');
    dialogMount?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (button?.textContent?.trim() === 'Audio') {
        window.setTimeout(() => this.render());
      }
    });
    dialogMount?.addEventListener('change', (event) => {
      if ((event.target as HTMLElement).id === 'muteToggle') {
        this.updateFromControls();
      }
    });
    dialogMount?.addEventListener('input', (event) => {
      if ((event.target as HTMLElement).matches('[id$="Volume"]')) {
        this.updateFromControls();
      }
    });
  }

  public load(): void {
    try {
      this.settings = sanitizeAudioSettings(parseJsonText(this.storage?.getItem('casino_audio_settings') ?? '{}'));
    } catch {
      this.settings = defaultAudioSettings();
    }
    this.audio.updateSettings(this.settings);
    this.render();
  }

  private render(): void {
    this.audioControl('muteToggle').checked = this.settings.muted;
    this.audioControl('masterVolume').value = String(this.settings.masterVolume);
    this.audioControl('musicVolume').value = String(this.settings.musicVolume);
    this.audioControl('effectsVolume').value = String(this.settings.effectsVolume);
    this.audioControl('dealingVolume').value = String(this.settings.dealingVolume);
    this.audioControl('chipsVolume').value = String(this.settings.chipsVolume);
    this.audioControl('slotsVolume').value = String(this.settings.slotsVolume);
    this.audioControl('winsVolume').value = String(this.settings.winsVolume);
    this.audioControl('bonusVolume').value = String(this.settings.bonusVolume);
    this.audioControl('uiVolume').value = String(this.settings.uiVolume);
    this.audioControl('ambienceVolume').value = String(this.settings.ambienceVolume);
  }

  private updateFromControls(): void {
    this.settings = sanitizeAudioSettings({
      muted: this.audioControl('muteToggle').checked,
      masterVolume: Number(this.audioControl('masterVolume').value),
      musicVolume: Number(this.audioControl('musicVolume').value),
      effectsVolume: Number(this.audioControl('effectsVolume').value),
      dealingVolume: Number(this.audioControl('dealingVolume').value),
      chipsVolume: Number(this.audioControl('chipsVolume').value),
      slotsVolume: Number(this.audioControl('slotsVolume').value),
      winsVolume: Number(this.audioControl('winsVolume').value),
      bonusVolume: Number(this.audioControl('bonusVolume').value),
      uiVolume: Number(this.audioControl('uiVolume').value),
      ambienceVolume: Number(this.audioControl('ambienceVolume').value),
    });
    this.audio.updateSettings(this.settings);
    this.audio.toggleMusic(!this.settings.muted && this.settings.musicVolume > 0);
    try {
      this.storage?.setItem('casino_audio_settings', JSON.stringify(this.settings));
    } catch {
      // Persistence can be blocked; the in-memory audio settings already applied.
    }
  }

  private static browserStorage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }

  private audioControl(
    id: keyof Pick<
      AppElements,
      | 'muteToggle'
      | 'masterVolume'
      | 'musicVolume'
      | 'effectsVolume'
      | 'dealingVolume'
      | 'chipsVolume'
      | 'slotsVolume'
      | 'winsVolume'
      | 'bonusVolume'
      | 'uiVolume'
      | 'ambienceVolume'
    >,
  ): HTMLInputElement {
    return document.querySelector<HTMLInputElement>(`#${id}`) ?? this.elements[id];
  }
}
