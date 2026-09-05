import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { createDeterministicBeatTheHouseShoe } from '../game/createDeterministicBeatTheHouseShoe';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import { PixiTable } from '../../../src/ui/PixiTable/PixiTable';
import type { PixiTableDependencies } from '../../../src/ui/PixiTable/PixiTableDependencies';
import { roundStartAnimationKey } from '../../../src/ui/PixiTable/roundStartAnimationKey';
import { dealerChipBank } from '../../../src/ui/layout/dealerChipBank';
import { toPixels } from '../../../src/ui/layout/toPixels';

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ rank, suit });
const createGame = (initialBankroll: number, dealOrder: readonly Card[]): BeatTheHouseGame =>
  new BeatTheHouseGame({ initialBankroll, shoe: createDeterministicBeatTheHouseShoe({ dealOrder }) });

describe('Beat the House popup and animation behaviour', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits the visible initial deal order: player seats left to right, then dealer hole', () => {
    const game = createGame(500, [card('9'), card('10'), card('J'), card('7')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('centre', 'main', 10);
    game.placeBet('right', 'main', 10);

    const snapshot = game.deal();

    expect(snapshot.dealer.cards).toEqual([]);
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
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    const playing = game.deal();

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
    const game = createGame(500, [card('A', 'hearts'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.placeBet('left', 'dealerBust', 2);
    game.deal();

    const settled = game.stick();
    const summary = settled.summaries[0];
    if (!summary) {
      throw new Error('Missing summary.');
    }

    expect(summary.mainResult).toBe('win');
    expect(summary.sideWins).toEqual([
      { betType: 'dealerSevens', label: 'Dealer Sevens (1)', profitHalfUnits: 16, returnedHalfUnits: 20, profit: 8, returned: 10 },
    ]);
    expect(settled.sideStates.left).toMatchObject({ dealerSevens: 'win', dealerBust: 'lose' });
    expect(settled.lastEvents.at(-1)).toMatchObject({ type: 'round-settled', totalProfitHalfUnits: 32, totalProfit: 16 });
  });

  it('next round clears cards, side states, summaries, and active hand state', () => {
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.deal();
    game.stick();

    const next = game.nextRound();

    expect(next.phase).toBe('betting');
    expect(next.hands.left.cards).toEqual([]);
    expect(next.dealer.cards).toEqual([]);
    expect(next.dealer.holeRevealed).toBe(false);
    expect(next.summaries).toEqual([]);
    expect(next.sideStates.left).toMatchObject({ dealerSevens: 'idle', dealerBust: 'idle', aceFlash: 'idle', matchPush: 'idle' });
    expect(next.activeHand).toBeUndefined();
  });

  it('uses a stable round-start animation key for immediate first-card 2 settlements', () => {
    const game = createGame(500, [card('2'), card('2')]);
    game.placeBet('left', 'main', 10);

    const settled = game.deal();
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
      createEffectRenderer: () =>
        rendererTestDouble<ReturnType<PixiTableDependencies['createEffectRenderer']>>({ drawConfetti: vi.fn(), drawSideBetWin: vi.fn() }),
      createTagRenderer: () =>
        rendererTestDouble<ReturnType<PixiTableDependencies['createTagRenderer']>>({
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
    const game = createGame(500, [card('2'), card('2')]);
    game.placeBet('left', 'main', 10);

    const settled = game.deal();
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
    const game = createGame(500, [card('A', 'hearts'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.placeBet('left', 'dealerBust', 2);
    game.deal();

    table.render(game.stick());

    expect(host.dataset.settlementVisible).toBe('true');
    expect(host.dataset.settlementHandCount).toBe('1');
    expect(JSON.parse(host.dataset.sideBetLabels ?? '[]')).toEqual(['Dealer Bust LOSE -£2', 'Dealer Sevens (1) WIN +£8']);
    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£10',
      'Side bets WIN +£6',
      ['Total WIN +£16'],
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
      8,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'payout-left-dealerSevens-8', from: toPixels(dealerChipBank) }),
    );
  });

  it('includes authoritative House Advance repayment and net lines in winning settlement popups', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, tagRenderer } = createInitializedTable();
    const game = createGame(500, [card('A', 'hearts'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'dealerSevens', 2);
    game.placeBet('left', 'dealerBust', 2);
    game.deal();

    table.render(game.stick(), [{ handId: 'left', houseAdvanceRepayment: 2 }]);

    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£10',
      'Side bets WIN +£6',
      ['Gross WIN +£16', 'House Advance payment -£2', 'Net WIN +£14'],
      expect.any(Number),
      expect.any(Number),
      'win',
      true,
    );
  });

  it('omits the House Advance repayment line when authoritative repayment is zero', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, tagRenderer } = createInitializedTable();
    const game = createGame(500, [card('A', 'spades'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.deal();

    table.render(game.stick(), [{ handId: 'left', houseAdvanceRepayment: 0 }]);

    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£15',
      'Side bets NONE +£0',
      ['Total WIN +£15'],
      expect.any(Number),
      expect.any(Number),
      'win',
      false,
    );
    const popupText = vi.mocked(tagRenderer.drawResultPopup).mock.calls[0]?.slice(0, 3).flat().join('\n') ?? '';
    expect(popupText).not.toContain('House Advance payment');
  });

  it('shows the exact fractional main payout in the popup and animation tag', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, chipRenderer, tagRenderer } = createInitializedTable();
    const game = createGame(500, [card('A', 'spades'), card('K', 'hearts')]);
    game.placeBet('left', 'main', 1);

    table.render(game.deal());

    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£1.5',
      'Side bets NONE +£0',
      ['Total WIN +£1.5'],
      expect.any(Number),
      expect.any(Number),
      'win',
      false,
    );
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      1.5,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'payout-left-main-1.5', from: toPixels(dealerChipBank) }),
    );
    expect(tagRenderer.drawPayoutTag).toHaveBeenCalledWith('PAID +£1.5', expect.any(Number), expect.any(Number), 'win');
  });

  it('draws dealer tip chips while betting and includes Dealer Thanks in the net breakdown', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host, chipRenderer, tagRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({
      initialBankroll: 500,
      randomInt: () => 0,
      shoe: createDeterministicBeatTheHouseShoe({ dealOrder: [card('2'), card('K')] }),
    });
    game.placeBet('left', 'main', 10);
    const tipped = game.placeDealerTip('left', 5);

    table.render(tipped);

    expect(JSON.parse(host.dataset.dealerTipSeats ?? '[]')).toEqual(['left']);
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(5, expect.any(Number), expect.any(Number), expect.any(Number), 'tip-left-5');

    vi.clearAllMocks();
    const settled = game.deal();
    table.render(settled);

    expect(JSON.parse(host.dataset.dealerThanksRewards ?? '[]')).toEqual(['left:10']);
    expect(chipRenderer.drawStack).toHaveBeenCalledWith(
      10,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ key: 'dealer-thanks-left-10', from: toPixels(dealerChipBank) }),
    );
    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main LOSE -£10',
      'Side bets NONE +£0',
      ['Gameplay LOSE -£10', "Dealer's Thanks +£10", 'Net PUSH +£0'],
      expect.any(Number),
      expect.any(Number),
      'push',
      false,
    );
  });

  it('draws wager amount indicators for every positive live bet during active phases', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host, tagRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({ initialBankroll: 500, randomInt: () => 0 });
    game.placeBet('left', 'main', 5);
    game.placeBet('left', 'dealerBust', 5);
    game.placeBet('centre', 'main', 25);

    table.render(game.snapshot());

    const wagerAmounts = JSON.parse(host.dataset.wagerAmounts ?? '[]');
    expect(wagerAmounts).toEqual(['left:main:5', 'left:dealerBust:5', 'centre:main:25']);
    expect(tagRenderer.drawMarker).toHaveBeenCalledTimes(3);
    expect(tagRenderer.drawMarker).toHaveBeenCalledWith('£5', expect.any(Number), expect.any(Number));
    expect(tagRenderer.drawMarker).toHaveBeenCalledWith('£25', expect.any(Number), expect.any(Number));
  });

  it('hides wager amount indicators once the round settles and on the fresh betting round', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host } = createInitializedTable();
    const game = new BeatTheHouseGame({
      initialBankroll: 500,
      randomInt: () => 0,
      shoe: createDeterministicBeatTheHouseShoe({ dealOrder: [card('2'), card('K')] }),
    });
    game.placeBet('left', 'main', 10);
    const settled = game.deal();

    table.render(settled);

    expect(settled.phase).toBe('roundOver');
    expect(JSON.parse(host.dataset.wagerAmounts ?? '[["stale"]]')).toEqual([]);

    table.render(game.nextRound());

    expect(JSON.parse(host.dataset.wagerAmounts ?? '[["stale"]]')).toEqual([]);
  });

  it('draws Dealer Thanks reward chips for every settled tipped seat', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    });
    const { table, host, chipRenderer } = createInitializedTable();
    const game = new BeatTheHouseGame({
      initialBankroll: 500,
      randomInt: () => 0,
      shoe: createDeterministicBeatTheHouseShoe({ dealOrder: [card('2'), card('2'), card('2'), card('K')] }),
    });
    const tippedSeats = ['left', 'centre', 'right'] as const;
    tippedSeats.forEach((handId) => {
      game.placeBet(handId, 'main', 10);
      game.placeDealerTip(handId, 5);
    });

    table.render(game.deal());

    expect(JSON.parse(host.dataset.dealerThanksRewards ?? '[]')).toEqual(['left:10', 'centre:10', 'right:10']);
    tippedSeats.forEach((handId) => {
      expect(chipRenderer.drawStack).toHaveBeenCalledWith(
        10,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ key: `dealer-thanks-${handId}-10`, from: toPixels(dealerChipBank) }),
      );
    });
  });

  it('keeps House Advance metadata when the delayed settlement timer re-renders the popup', () => {
    let revealSettlement: (() => void) | undefined;
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn((callback: () => void) => {
        revealSettlement = callback;
        return 1;
      }),
    });
    const { table, tagRenderer } = createInitializedTable();
    const game = createGame(500, [card('A', 'spades'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.deal();

    table.render(game.stick(), [{ handId: 'left', houseAdvanceRepayment: 1 }]);
    expect(tagRenderer.drawResultPopup).not.toHaveBeenCalled();

    revealSettlement?.();

    expect(tagRenderer.drawResultPopup).toHaveBeenCalledWith(
      'Main WIN +£15',
      'Side bets NONE +£0',
      ['Gross WIN +£15', 'House Advance payment -£1', 'Net WIN +£14'],
      expect.any(Number),
      expect.any(Number),
      'win',
      false,
    );
  });

  it('flips the dealer hole card in place when the player sticks', () => {
    vi.stubGlobal('window', {
      clearTimeout: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: false })),
      setTimeout: vi.fn(() => 0),
    });
    const { table, host, cardRenderer } = createInitializedTable();
    const game = createGame(500, [card('9'), card('7'), card('K')]);
    game.placeBet('left', 'main', 10);

    table.render(game.deal());
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
    const game = createGame(500, [card('J', 'hearts'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('left', 'aceFlash', 3);
    game.placeBet('left', 'dealerBust', 2);
    game.deal();

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
    const game = createGame(500, [card('A', 'spades'), card('9'), card('K')]);
    game.placeBet('left', 'main', 10);
    game.placeBet('centre', 'main', 10);

    table.render(game.deal());

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
