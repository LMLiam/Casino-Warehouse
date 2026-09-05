import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { AppElements } from '../../../src/app/dom/appElements/AppElements';
import { WalletView } from '../../../src/app/views/WalletView';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';

describe('WalletView Beat the House half-chip indicator', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { clearTimeout: vi.fn(), setTimeout: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only the current profile residual in the active Beat table', () => {
    const { elements, indicator } = createElements();
    const view = new WalletView(elements);
    const snapshot = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    const store = createMemoryServerDataStore();
    const created = store.createProfile('Half Chip Player').profileState.profiles[0];
    if (!created) {
      throw new Error('Expected a profile.');
    }
    const profile = { ...created, gameCredits: { beatTheHouseHalfChip: 1 as const } };

    view.render(snapshot, profile, 900, true);

    expect(indicator.textContent).toBe('Half chip: one half');
    expect(indicator.classList.toggle).toHaveBeenCalledWith('hidden', false);
    expect(elements.bankroll.textContent).toBe('£900');

    view.render(snapshot, profile, 900, false);

    expect(indicator.textContent).toBe('');
    expect(indicator.classList.toggle).toHaveBeenLastCalledWith('hidden', true);
  });

  it('hides a missing or zero residual and clears stale indicator state', () => {
    const { elements, indicator } = createElements();
    const view = new WalletView(elements);
    const snapshot = new BeatTheHouseGame({ initialBankroll: 100 }).snapshot();
    const store = createMemoryServerDataStore();
    const created = store.createProfile('Whole Chip Player').profileState.profiles[0];
    if (!created) {
      throw new Error('Expected a profile.');
    }

    view.render(snapshot, { ...created, gameCredits: { beatTheHouseHalfChip: 0 } }, undefined, true);
    expect(indicator.textContent).toBe('');
    expect(indicator.classList.toggle).toHaveBeenCalledWith('hidden', true);

    view.render(snapshot, undefined, undefined, true);
    view.clear();

    expect(indicator.textContent).toBe('');
    expect(indicator.classList.add).toHaveBeenCalledWith('hidden');
  });
});

const createElements = (): { elements: AppElements; indicator: HTMLElement } => {
  const indicator = element();
  return {
    indicator,
    elements: {
      bankroll: element(),
      bankrollDelta: element(),
      beatHalfChipIndicator: indicator,
      profileStats: element(),
      houseAdvancePill: element(),
      auditLog: element(),
    } as AppElements,
  };
};

const element = (): HTMLElement => {
  const classList: Partial<DOMTokenList> = {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
  };
  const value: Partial<HTMLElement> = {
    className: '',
    textContent: '',
    innerHTML: '',
    classList: classList as DOMTokenList,
  };
  return value as HTMLElement;
};
