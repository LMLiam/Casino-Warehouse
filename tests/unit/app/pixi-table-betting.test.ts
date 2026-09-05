import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { PixiTable } from '../../../src/ui/PixiTable/PixiTable';
import type { PixiTableDependencies } from '../../../src/ui/PixiTable/PixiTableDependencies';
import { createDeterministicBeatTheHouseShoe } from '../game/createDeterministicBeatTheHouseShoe';

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ rank, suit });

const createGame = (initialBankroll: number, dealOrder: readonly Card[]): BeatTheHouseGame =>
  new BeatTheHouseGame({ initialBankroll, shoe: createDeterministicBeatTheHouseShoe({ dealOrder }) });

type ZoneTapTable = PixiTable & {
  readonly zoneLayer: { readonly children: readonly { emit(event: string): boolean }[] };
};

const emitAllZoneTaps = (table: PixiTable): void => {
  const internals = table as ZoneTapTable;
  for (const child of internals.zoneLayer.children) {
    child.emit('pointertap');
  }
};

describe('PixiTable side-bet cap', () => {
  it('blocks only the side type that reached the main stake while other types stay available', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const onBet = vi.fn();
    const { table } = createInitializedTable(onBet);
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'dealerBust', 5);
    game.placeBet('left', 'aceFlash', 1);

    table.setSelectedChip(1);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);

    const calls = onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`);
    expect(calls).not.toContain('left:dealerBust');
    expect(calls).toContain('left:aceFlash');
    expect(calls).toContain('left:main');
    vi.unstubAllGlobals();
  });

  it('blocks a selected chip larger than the remaining allowance but allows a smaller chip', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const onBet = vi.fn();
    const { table } = createInitializedTable(onBet);
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'dealerBust', 4);

    table.setSelectedChip(5);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);
    expect(onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`)).not.toContain('left:dealerBust');

    table.setSelectedChip(1);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);
    expect(onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`)).toContain('left:dealerBust');
    vi.unstubAllGlobals();
  });

  it('restores side allowance immediately after the main bet increases', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const onBet = vi.fn();
    const { table } = createInitializedTable(onBet);
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'dealerBust', 5);

    table.setSelectedChip(1);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);
    expect(onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`)).not.toContain('left:dealerBust');

    game.placeBet('left', 'main', 1);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);
    expect(onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`)).toContain('left:dealerBust');
    vi.unstubAllGlobals();
  });

  it('keeps main bets and dealer tips unchanged by the side cap', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const onBet = vi.fn();
    const { table } = createInitializedTable(onBet);
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'dealerBust', 5);

    table.setSelectedChip(5);
    table.render(game.snapshot());
    onBet.mockClear();
    emitAllZoneTaps(table);

    const calls = onBet.mock.calls.map(([handId, betType]) => `${handId}:${betType}`);
    expect(calls).toContain('left:main');
    expect(calls).toContain('left:dealerTip');
    expect(calls).toContain('centre:main');
    vi.unstubAllGlobals();
  });
});

const createInitializedTable = (onBet: (...args: never[]) => void) => {
  const chipRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createChipRenderer']>>({ clearAnimations: vi.fn(), drawStack: vi.fn() });
  const effectRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createEffectRenderer']>>({ drawConfetti: vi.fn(), drawSideBetWin: vi.fn() });
  const tagRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createTagRenderer']>>({
    drawMarker: vi.fn(),
    drawPayoutTag: vi.fn(),
    drawResultPopup: vi.fn(),
    drawSideBetWin: vi.fn(),
    drawSideState: vi.fn(),
  });
  const cardRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createCardRenderer']>>({
    beginFrame: vi.fn(),
    clearAnimations: vi.fn(),
    drawCard: vi.fn(),
    drawBack: vi.fn(),
    drawRevealedCard: vi.fn(),
    endFrame: vi.fn(),
  });
  const dependencies: PixiTableDependencies = {
    createCardRenderer: () => cardRenderer,
    createChipRenderer: () => chipRenderer,
    createEffectRenderer: () => effectRenderer,
    createTagRenderer: () => tagRenderer,
  };
  const host = hostElementTestDouble({ dataset: {}, clientWidth: 1000, clientHeight: 1000, classList: { toggle: vi.fn() } });
  const table = new PixiTable(host, { onBet: onBet as never }, dependencies);
  const mutableTable = pixiTableInternals(table);
  mutableTable.initialized = true;
  mutableTable.chipRenderer = chipRenderer;
  return { table, host };
};

type PixiHostElementDouble = {
  readonly dataset: Record<string, string>;
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly classList: { readonly toggle: (token: string, force?: boolean) => boolean };
};

const rendererTestDouble = <Renderer>(implementation: Partial<Renderer> & Record<string, (...args: never[]) => void>): Renderer => implementation as Renderer;

const hostElementTestDouble = (implementation: PixiHostElementDouble): HTMLElement => implementation as HTMLElement;

const pixiTableInternals = (table: PixiTable): { initialized: boolean; chipRenderer: ReturnType<PixiTableDependencies['createChipRenderer']> } =>
  table as PixiTable & { initialized: boolean; chipRenderer: ReturnType<PixiTableDependencies['createChipRenderer']> };
