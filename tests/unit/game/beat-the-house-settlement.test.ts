import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { settleBeatTheHouseMain } from '../../../src/game/beatTheHouse/settlement/settleBeatTheHouseMain';
import { settleBeatTheHouseSideBets } from '../../../src/game/beatTheHouse/settlement/settleBeatTheHouseSideBets';
import type { BeatTheHouseSideSettlementInput } from '../../../src/game/beatTheHouse/settlement/BeatTheHouseSideSettlementInput';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const ordinaryPlayerCard = card('10', 'hearts');
const ordinaryDealerCard = card('9', 'diamonds');
const blackAce = card('A', 'spades');
const secondBlackAce = card('A', 'clubs');
const dealerTwo = card('2', 'hearts');

const mainInput = (overrides: Partial<Parameters<typeof settleBeatTheHouseMain>[0]> = {}): Parameters<typeof settleBeatTheHouseMain>[0] => ({
  mainStake: 1,
  playerFirstCard: ordinaryPlayerCard,
  playerMode: 'compare',
  playerFinalCard: ordinaryPlayerCard,
  dealerFirstCard: ordinaryDealerCard,
  dealerBust: false,
  dealerFinalCard: ordinaryDealerCard,
  ...overrides,
});

const sideInput = (overrides: Partial<BeatTheHouseSideSettlementInput> = {}): BeatTheHouseSideSettlementInput => ({
  sideBets: { aceFlash: 0, dealerBust: 0, matchPush: 0, dealerSevens: 0 },
  mainResult: 'win',
  playerFirstCard: ordinaryPlayerCard,
  playerFinalCard: ordinaryPlayerCard,
  dealer: {
    cards: [ordinaryDealerCard],
    bust: false,
    blackAce: false,
    finalCard: ordinaryDealerCard,
  },
  ...overrides,
});

describe('Beat the House pure main settlement', () => {
  it.each([
    [1, 2, 3, 5],
    [2, 4, 6, 10],
    [3, 6, 9, 15],
  ])('pays a first-card black Ace at 3:2 for a £%d stake', (mainStake, stakeHalfUnits, profitHalfUnits, returnedHalfUnits) => {
    const settlement = settleBeatTheHouseMain(mainInput({ mainStake, playerFirstCard: blackAce, playerMode: 'automaticWin' }));

    expect(settlement).toEqual({ result: 'win', stakeHalfUnits, profitHalfUnits, returnedHalfUnits });
  });

  it('keeps a player black-Ace automatic win ahead of a dealer black Ace', () => {
    const settlement = settleBeatTheHouseMain(
      mainInput({ playerFirstCard: blackAce, playerMode: 'automaticWin', dealerFirstCard: secondBlackAce, dealerFinalCard: secondBlackAce }),
    );

    expect(settlement).toMatchObject({ result: 'win', profitHalfUnits: 3, returnedHalfUnits: 5 });
  });

  it('settles immediate losses, dealer black Ace, dealer bust, wins, losses, and pushes', () => {
    expect(settleBeatTheHouseMain(mainInput({ playerFirstCard: card('2', 'clubs'), playerMode: 'immediateLoss' }))).toMatchObject({
      result: 'lose',
      returnedHalfUnits: 0,
    });
    expect(settleBeatTheHouseMain(mainInput({ playerMode: 'immediateLoss' }))).toMatchObject({ result: 'lose', profitHalfUnits: -2 });
    expect(settleBeatTheHouseMain(mainInput({ dealerFirstCard: blackAce, dealerFinalCard: blackAce }))).toMatchObject({ result: 'lose', returnedHalfUnits: 0 });
    expect(settleBeatTheHouseMain(mainInput({ dealerBust: true, dealerFinalCard: undefined }))).toMatchObject({ result: 'win', returnedHalfUnits: 4 });
    expect(settleBeatTheHouseMain(mainInput())).toMatchObject({ result: 'win', returnedHalfUnits: 4 });
    expect(settleBeatTheHouseMain(mainInput({ playerFinalCard: ordinaryDealerCard }))).toMatchObject({ result: 'push', returnedHalfUnits: 2 });
    expect(settleBeatTheHouseMain(mainInput({ playerFinalCard: card('8', 'hearts') }))).toMatchObject({ result: 'lose', returnedHalfUnits: 0 });
  });

  it('rejects invalid or impossible main settlement inputs', () => {
    expect(() => settleBeatTheHouseMain(mainInput({ mainStake: 0 }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ mainStake: 1.5 }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ playerFirstCard: ordinaryPlayerCard, playerMode: 'automaticWin' }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ playerFirstCard: card('2', 'clubs'), playerMode: 'compare' }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ playerFinalCard: undefined }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ dealerFirstCard: dealerTwo, dealerBust: false }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ dealerBust: false, dealerFinalCard: undefined }))).toThrow();
    expect(() => settleBeatTheHouseMain(mainInput({ dealerFirstCard: blackAce, dealerBust: true }))).toThrow();
  });
});

describe('Beat the House pure side settlement', () => {
  it('returns zero for losing and zero-stake side bets', () => {
    const settlement = settleBeatTheHouseSideBets(sideInput({ mainResult: 'lose' }));

    expect(settlement).toEqual({ wins: [], stakeHalfUnits: 0, profitHalfUnits: 0, returnedHalfUnits: 0 });
  });

  it('pays both Ace Flash tiers with exact profit and returned values', () => {
    const single = settleBeatTheHouseSideBets(
      sideInput({ sideBets: { aceFlash: 1, dealerBust: 0, matchPush: 0, dealerSevens: 0 }, playerFirstCard: blackAce }),
    );
    const both = settleBeatTheHouseSideBets(
      sideInput({
        sideBets: { aceFlash: 1, dealerBust: 0, matchPush: 0, dealerSevens: 0 },
        playerFirstCard: blackAce,
        dealer: { cards: [secondBlackAce], bust: false, blackAce: true, finalCard: secondBlackAce },
      }),
    );

    expect(single.wins[0]).toMatchObject({ betType: 'aceFlash', stakeHalfUnits: 2, profitHalfUnits: 24, returnedHalfUnits: 26 });
    expect(both.wins[0]).toMatchObject({ betType: 'aceFlash', stakeHalfUnits: 2, profitHalfUnits: 120, returnedHalfUnits: 122 });
  });

  it('pays Dealer Bust and Dealer Sevens when sevens precede a busting 2', () => {
    const settlement = settleBeatTheHouseSideBets(
      sideInput({
        sideBets: { aceFlash: 0, dealerBust: 1, matchPush: 0, dealerSevens: 1 },
        dealer: { cards: [card('7', 'clubs'), dealerTwo], bust: true, blackAce: false },
      }),
    );

    expect(settlement.wins).toEqual([
      { betType: 'dealerBust', stakeHalfUnits: 2, profitHalfUnits: 12, returnedHalfUnits: 14 },
      { betType: 'dealerSevens', stakeHalfUnits: 2, profitHalfUnits: 8, returnedHalfUnits: 10 },
    ]);
    expect(settlement).toMatchObject({ stakeHalfUnits: 4, profitHalfUnits: 20, returnedHalfUnits: 24 });
  });

  it.each([
    [1, 10],
    [2, 38],
    [3, 302],
    [4, 2002],
  ])('pays Dealer Sevens tier %d exactly', (sevenCount, returnedHalfUnits) => {
    const seven = card('7', 'clubs');
    const dealerCards = Array.from({ length: sevenCount }, () => seven);
    const settlement = settleBeatTheHouseSideBets(
      sideInput({
        sideBets: { aceFlash: 0, dealerBust: 0, matchPush: 0, dealerSevens: 1 },
        dealer: { cards: dealerCards, bust: false, blackAce: false, finalCard: seven },
      }),
    );

    expect(settlement.wins[0]?.returnedHalfUnits).toBe(returnedHalfUnits);
  });

  it('keeps Match Push exclusions and exact combined conservation', () => {
    const push = settleBeatTheHouseSideBets(
      sideInput({
        sideBets: { aceFlash: 0, dealerBust: 0, matchPush: 1, dealerSevens: 0 },
        mainResult: 'push',
        playerFinalCard: ordinaryDealerCard,
        dealer: { cards: [ordinaryDealerCard], bust: false, blackAce: false, finalCard: ordinaryDealerCard },
      }),
    );
    const excluded = settleBeatTheHouseSideBets(
      sideInput({
        sideBets: { aceFlash: 0, dealerBust: 0, matchPush: 1, dealerSevens: 0 },
        mainResult: 'lose',
        playerFinalCard: ordinaryDealerCard,
        dealer: { cards: [ordinaryDealerCard], bust: false, blackAce: false, finalCard: ordinaryDealerCard },
      }),
    );

    expect(push.wins[0]).toMatchObject({ betType: 'matchPush', profitHalfUnits: 18, returnedHalfUnits: 20 });
    expect(excluded.wins).toEqual([]);
    expect(push.stakeHalfUnits + push.profitHalfUnits).toBe(push.returnedHalfUnits);
  });

  it('rejects malformed side settlement state', () => {
    expect(() => settleBeatTheHouseSideBets(sideInput({ dealer: { cards: [], bust: false, blackAce: false } }))).toThrow();
    expect(() => settleBeatTheHouseSideBets(sideInput({ dealer: { cards: [dealerTwo], bust: false, blackAce: false } }))).toThrow();
    expect(() => settleBeatTheHouseSideBets(sideInput({ sideBets: { aceFlash: -1, dealerBust: 0, matchPush: 0, dealerSevens: 0 } }))).toThrow();
  });
});
