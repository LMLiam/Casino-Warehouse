import { afterEach, describe, expect, it, vi } from 'vitest';
import { rigDeck, type Card } from '../../../src/game/cards';
import { BeatTheHouseGame } from '../../../src/game/engine';
import { PixiTable, roundStartAnimationKey, type PixiTableDependencies } from '../../../src/ui/PixiTable';
import { dealerChipBank, toPixels } from '../../../src/ui/layout';

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ rank, suit });

describe('Beat the House popup and animation behaviour', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits the visible initial deal order: player seats left to right, then dealer hole', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('centre', 'main', 10);
    game.placeBet('right', 'main', 10);

    const snapshot = game.deal(rigDeck([card('9'), card('10'), card('J'), card('7')]));

    expect(snapshot.dealer.holeCard).toEqual(card('7'));
    expect(snapshot.dealer.holeRevealed).toBe(false);
    expect(snapshot.lastEvents.map((event) => [event.type, event.handId, event.cardIndex])).toEqual([
      ['round-started', undefined, undefined],
      ['player-card', 'left', 0],
      ['player-card', 'centre', 0],
      ['player-card', 'right', 0],
      ['dealer-hole', undefined, undefined],
    ]);
  });

  it('reveals the dealer hole first, then queues dealer hits one by one before settlement', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    const playing = game.deal(rigDeck([card('9'), card('7'), card('K')]));

    expect(playing.dealer.holeCard).toEqual(card('7'));
    expect(playing.dealer.cards).toEqual([]);

    const settled = game.stick();

    expect(settled.phase).toBe('roundOver');
    expect(settled.dealer.holeRevealed).toBe(true);
    expect(settled.dealer.cards).toEqual([card('7'), card('K')]);
    expect(settled.lastEvents.map((event) => [event.type, event.cardIndex])).toEqual([
      ['hand-completed', undefined],
      ['dealer-card', 0],
      ['dealer-card', 1],
      ['round-settled', undefined],
    ]);
  });

  it('keeps side-bet win and loss state in the engine summary for UI popups', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.placeBet('left', 'dealerBust', 2);
    game.deal(rigDeck([card('A', 'hearts'), card('7'), card('K')]));

    const settled = game.stick();
    const summary = settled.summaries[0];

    expect(summary.mainResult).toBe('win');
    expect(summary.sideWins).toEqual([{ betType: 'dealerSevens', label: 'Dealer Sevens (1)', profit: 6, returned: 8 }]);
    expect(settled.sideStates.left).toMatchObject({ dealerSevens: 'win', dealerBust: 'lose' });
    expect(settled.lastEvents.at(-1)).toMatchObject({ type: 'round-settled', totalProfit: 14 });
  });

  it('next round clears cards, side states, summaries, and active hand state', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.deal(rigDeck([card('9'), card('7'), card('K')]));
    game.stick();

    const next = game.nextRound();

    expect(next.phase).toBe('betting');
    expect(next.hands.left.cards).toEqual([]);
    expect(next.dealer.cards).toEqual([]);
    expect(next.dealer.holeCard).toBeUndefined();
    expect(next.summaries).toEqual([]);
    expect(next.sideStates.left).toMatchObject({ dealerSevens: 'idle', dealerBust: 'idle', aceFlash: 'idle', matchPush: 'idle' });
    expect(next.activeHand).toBeUndefined();
  });

  it('uses a stable round-start animation key for immediate first-card 2 settlements', () => {
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);

    const settled = game.deal(rigDeck([card('2'), card('2')]));
    const repeatedRender = game.snapshot(settled.lastEvents);
    const betting = game.nextRound();

    expect(settled.phase).toBe('roundOver');
    expect(roundStartAnimationKey(settled)).toBe(roundStartAnimationKey(repeatedRender));
    expect(roundStartAnimationKey(betting)).toBe('');
  });

  it('does not clear and restart card animations on repeated renders after a first-card 2 settlement', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const cardRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createCardRenderer']>>({
      beginFrame: vi.fn(),
      clearAnimations: vi.fn(),
      drawCard: vi.fn(),
      drawBack: vi.fn(),
      drawRevealedCard: vi.fn(),
      endFrame: vi.fn(),
    });
    const chipRenderer = rendererTestDouble<ReturnType<PixiTableDependencies['createChipRenderer']>>({ clearAnimations: vi.fn(), drawStack: vi.fn() });
    const dependencies: PixiTableDependencies = {
      createCardRenderer: () => cardRenderer,
      createChipRenderer: () => chipRenderer,
      createEffectRenderer: () => rendererTestDouble({ drawConfetti: vi.fn(), drawSideBetWin: vi.fn() }),
      createTagRenderer: () =>
        rendererTestDouble({
          drawMarker: vi.fn(),
          drawPayoutTag: vi.fn(),
          drawResultPopup: vi.fn(),
          drawSideBetWin: vi.fn(),
          drawSideState: vi.fn(),
        }),
    };
    const host = hostElementTestDouble({ dataset: {}, clientWidth: 1000, clientHeight: 1000, classList: { toggle: vi.fn() } });
    const table = new PixiTable(host, { onBet: vi.fn() }, dependencies);
    const mutableTable = pixiTableInternals(table);
    mutableTable.initialized = true;
    mutableTable.chipRenderer = chipRenderer;
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);

    const settled = game.deal(rigDeck([card('2'), card('2')]));
    table.render(settled);
    table.render(game.snapshot(settled.lastEvents));

    expect(cardRenderer.clearAnimations).toHaveBeenCalledTimes(1);
  });

  it('draws delayed settlement popups, resolved side bets, and one celebration for a settled round', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host, chipRenderer, effectRenderer, tagRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.placeBet('left', 'dealerBust', 2);
    game.deal(rigDeck([card('A', 'hearts'), card('7'), card('K')]));

    table.render(game.stick());

    expect(host.dataset.settlementVisible).toBe('true');
    expect(host.dataset.settlementHandCount).toBe('1');
    expect(JSON.parse(host.dataset.sideBetLabels ?? '[]')).toEqual(['Dealer Bust LOSE -£2', 'Dealer Sevens (1) WIN +£6']);
    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£10',
      'Side bets WIN +£4',
      ['Total WIN +£14'],
      expect.any(Number),
      expect.any(Number),
      'win',
      true,
    );
    const popupText = vi.mocked(tagRenderer.drawResultPopup).mock.calls[0]?.slice(0, 3).flat().join('\n') ?? '';
    expect(popupText).not.toContain('Dealer Bust');
    expect(popupText).not.toContain('Dealer Sevens');
    expect(tagRenderer.drawSideState).toHaveBeenCalledWith('lose', expect.any(Number), expect.any(Number));
    expect(tagRenderer.drawSideState).toHaveBeenCalledWith('win', expect.any(Number), expect.any(Number));
    expect(effectRenderer.drawSideBetWin).toHaveBeenCalled();
    expect(effectRenderer.drawConfetti).toHaveBeenCalledTimes(1);
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      10,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'payout-left-main-10', from: toPixels(dealerChipBank) }),
    );
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      2,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'loss-left-dealerBust-2', to: toPixels(dealerChipBank) }),
    );
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      6,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'payout-left-dealerSevens-6', from: toPixels(dealerChipBank) }),
    );
  });

  it('flips the dealer hole card in place when the player sticks', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const { table, host, cardRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);

    table.render(game.deal(rigDeck([card('9'), card('7'), card('K')])));
    expect(cardRenderer.drawBack).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'dealer-hole', expect.any(Number));
    vi.clearAllMocks();

    table.render(game.stick());

    expect(JSON.parse(host.dataset.cardAnimationOrders ?? '[]')).toEqual([
      ['dealer-hole-reveal', 0],
      ['dealer-1', 1],
    ]);
    expect(cardRenderer.drawRevealedCard).toHaveBeenCalledWith(
      card('7'),
      expect.any(Number),
      expect.any(Number),
      false,
      'dealer-hole',
      'dealer-hole-reveal',
      0,
    );
    expect(cardRenderer.drawCard).toHaveBeenCalledWith(card('K'), expect.any(Number), expect.any(Number), false, 'dealer-1', 1);
    expect(cardRenderer.drawCard).not.toHaveBeenCalledWith(card('7'), expect.any(Number), expect.any(Number), false, 'dealer-0', expect.any(Number));
  });

  it('summarizes losing settlement popups without listing each side bet loss', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host, chipRenderer, tagRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 3);
    game.placeBet('left', 'dealerBust', 2);
    game.deal(rigDeck([card('J', 'hearts'), card('K')]));

    table.render(game.stick());

    expect(host.dataset.settlementVisible).toBe('true');
    expect(JSON.parse(host.dataset.sideBetLabels ?? '[]')).toEqual(['Ace Flash LOSE -£3', 'Dealer Bust LOSE -£2']);
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      10,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'loss-left-main-10', to: toPixels(dealerChipBank) }),
    );
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      3,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'loss-left-aceFlash-3', to: toPixels(dealerChipBank) }),
    );
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      2,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'loss-left-dealerBust-2', to: toPixels(dealerChipBank) }),
    );
    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main LOSE -£10',
      'Side bets LOSE -£5',
      ['Total LOSE -£15'],
      expect.any(Number),
      expect.any(Number),
      'lose',
      false,
    );
    const popupText = vi.mocked(tagRenderer.drawResultPopup).mock.calls[0]?.slice(0, 3).flat().join('\n') ?? '';
    expect(popupText).not.toContain('Ace Flash');
    expect(popupText).not.toContain('Dealer Bust');
  });

  it('draws live automatic payouts without waiting for the final settlement popup', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const { table, chipRenderer, tagRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({ initialBankroll: 500 });
    game.placeBet('left', 'main', 10);
    game.placeBet('centre', 'main', 10);

    table.render(game.deal(rigDeck([card('A', 'spades'), card('9'), card('K')])));

    expect(chipRenderer.drawStack).toHaveBeenCalledWith(10, expect.any(Number), expect.any(Number), expect.any(Number));
    expect(tagRenderer.drawPayoutTag).toHaveBeenCalledWith('PAID +£10', expect.any(Number), expect.any(Number), 'win');
    expect(tagRenderer.drawMarker).toHaveBeenCalledWith('BLACK ACE', expect.any(Number), expect.any(Number), 'win');
  });
});

const createInitializedTable = () => {
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
  const host = hostElementTestDouble({
    dataset: {},
    clientWidth: 1000,
    clientHeight: 1000,
    classList: { toggle: vi.fn() },
  });
  const table = new PixiTable(host, { onBet: vi.fn() }, dependencies);
  const mutableTable = pixiTableInternals(table);
  mutableTable.initialized = true;
  mutableTable.chipRenderer = chipRenderer;

  return { table, host, cardRenderer, chipRenderer, effectRenderer, tagRenderer };
};

const rendererTestDouble = <Renderer>(implementation: object): Renderer => implementation as Renderer;

const hostElementTestDouble = (implementation: object): HTMLElement => implementation as HTMLElement;

const pixiTableInternals = (table: PixiTable): { initialized: boolean; chipRenderer: ReturnType<PixiTableDependencies['createChipRenderer']> } =>
  rendererTestDouble(table);
