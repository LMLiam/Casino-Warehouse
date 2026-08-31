import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isBlackAce } from '../../../src/game/cards/isBlackAce';
import { ranks } from '../../../src/game/cards/ranks';
import { suits } from '../../../src/game/cards/suits';
import { sideBetTypes } from '../../../src/game/types/sideBetTypes';
import type { HandResult } from '../../../src/game/types/HandResult';
import { settleBeatTheHouseMain } from '../../../src/game/beatTheHouse/settlement/settleBeatTheHouseMain';
import type { BeatTheHouseMainSettlementInput } from '../../../src/game/beatTheHouse/settlement/BeatTheHouseMainSettlementInput';
import type { BeatTheHouseSideSettlementInput } from '../../../src/game/beatTheHouse/settlement/BeatTheHouseSideSettlementInput';
import { settleBeatTheHouseSideBets } from '../../../src/game/beatTheHouse/settlement/settleBeatTheHouseSideBets';

const maxPropertyStake = 1_000;
const maxDealerTrailingCards = 3;
const propertyRunCount = 250;
const rankArbitrary = fc.constantFrom(...ranks);
const suitArbitrary = fc.constantFrom(...suits);
const cardArbitrary = fc.record({ rank: rankArbitrary, suit: suitArbitrary });
const ordinaryRankArbitrary = fc.constantFrom('3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K');
const ordinaryCardArbitrary = fc.record({ rank: ordinaryRankArbitrary, suit: suitArbitrary });
const nonBlackAceCardArbitrary = fc.record({ rank: fc.constantFrom('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'), suit: suitArbitrary });
const blackAceArbitrary = fc.record({ rank: fc.constant('A'), suit: fc.constantFrom('spades', 'clubs') });
const stakeArbitrary = fc.integer({ min: 1, max: maxPropertyStake });
const sideStakeArbitrary = fc.integer({ min: 0, max: maxPropertyStake });

const mainDealerArbitrary = fc.oneof(
  fc.record({ dealerFirstCard: blackAceArbitrary, dealerBust: fc.constant(false), dealerFinalCard: cardArbitrary }),
  fc.record({
    dealerFirstCard: fc.record({ rank: fc.constant('2'), suit: suitArbitrary }),
    dealerBust: fc.constant(true),
    dealerFinalCard: fc.constant(undefined),
  }),
  fc.record({ dealerFirstCard: nonBlackAceCardArbitrary, dealerBust: fc.constant(true), dealerFinalCard: cardArbitrary }),
  fc.record({ dealerFirstCard: ordinaryCardArbitrary, dealerBust: fc.constant(false), dealerFinalCard: cardArbitrary }),
);

const mainInputArbitrary = fc.oneof(
  fc
    .record({
      mainStake: stakeArbitrary,
      playerFirstCard: ordinaryCardArbitrary,
      playerMode: fc.constant('compare'),
      playerFinalCard: cardArbitrary,
    })
    .chain((player) => mainDealerArbitrary.map((dealer) => ({ ...player, ...dealer }))),
  fc
    .record({
      mainStake: stakeArbitrary,
      playerFirstCard: blackAceArbitrary,
      playerMode: fc.constant('automaticWin'),
      playerFinalCard: fc.constant(undefined),
    })
    .chain((player) => mainDealerArbitrary.map((dealer) => ({ ...player, ...dealer }))),
  fc
    .record({
      mainStake: stakeArbitrary,
      playerFirstCard: nonBlackAceCardArbitrary,
      playerMode: fc.constant('immediateLoss'),
      playerFinalCard: fc.constant(undefined),
    })
    .chain((player) => mainDealerArbitrary.map((dealer) => ({ ...player, ...dealer }))),
);

const sideBetsArbitrary = fc.record({
  aceFlash: sideStakeArbitrary,
  dealerBust: sideStakeArbitrary,
  matchPush: sideStakeArbitrary,
  dealerSevens: sideStakeArbitrary,
});

const sideDealerArbitrary = fc.tuple(cardArbitrary, fc.array(cardArbitrary, { maxLength: maxDealerTrailingCards })).map(([firstCard, trailingCards]) => {
  const cards = [firstCard, ...trailingCards];
  return {
    cards,
    bust: cards.some((card) => card.rank === '2'),
    blackAce: isBlackAce(firstCard),
    finalCard: cards.at(-1),
  };
});

const sideInputArbitrary = fc.record({
  sideBets: sideBetsArbitrary,
  mainResult: fc.constantFrom<HandResult>('lose', 'push', 'win'),
  playerFirstCard: cardArbitrary,
  playerFinalCard: cardArbitrary,
  dealer: sideDealerArbitrary,
});

describe('Beat the House settlement properties', () => {
  it('conserves generated main settlement payouts', () => {
    fc.assert(
      fc.property(mainInputArbitrary, (input: BeatTheHouseMainSettlementInput) => {
        const settlement = settleBeatTheHouseMain(input);

        expect(settlement.stakeHalfUnits).toBe(input.mainStake * 2);
        expect(Number.isSafeInteger(settlement.returnedHalfUnits)).toBe(true);
        expect(Number.isSafeInteger(settlement.profitHalfUnits)).toBe(true);
        expect(settlement.returnedHalfUnits).toBeGreaterThanOrEqual(0);
        expect(settlement.profitHalfUnits).toBe(settlement.returnedHalfUnits - settlement.stakeHalfUnits);

        if (settlement.result === 'lose') {
          expect(settlement.returnedHalfUnits).toBe(0);
        } else if (settlement.result === 'push') {
          expect(settlement.returnedHalfUnits).toBe(settlement.stakeHalfUnits);
        } else {
          expect(settlement.returnedHalfUnits).toBeGreaterThan(settlement.stakeHalfUnits);
        }
      }),
      { numRuns: propertyRunCount },
    );
  });

  it('conserves generated side-bet payouts and keeps each win self-consistent', () => {
    fc.assert(
      fc.property(sideInputArbitrary, (input: BeatTheHouseSideSettlementInput) => {
        const settlement = settleBeatTheHouseSideBets(input);
        const expectedStakeHalfUnits = sideBetTypes.reduce((total, betType) => total + input.sideBets[betType] * 2, 0);
        const expectedReturnedHalfUnits = settlement.wins.reduce((total, win) => total + win.returnedHalfUnits, 0);
        const winningBetTypes = new Set(settlement.wins.map((win) => win.betType));

        expect(settlement.stakeHalfUnits).toBe(expectedStakeHalfUnits);
        expect(settlement.returnedHalfUnits).toBe(expectedReturnedHalfUnits);
        expect(settlement.returnedHalfUnits).toBeGreaterThanOrEqual(0);
        expect(settlement.profitHalfUnits).toBe(settlement.returnedHalfUnits - settlement.stakeHalfUnits);
        expect(settlement.wins.length).toBe(winningBetTypes.size);
        expect(settlement.wins.length).toBeLessThanOrEqual(sideBetTypes.length);

        for (const win of settlement.wins) {
          expect(input.sideBets[win.betType]).toBeGreaterThan(0);
          expect(win.stakeHalfUnits).toBe(input.sideBets[win.betType] * 2);
          expect(win.profitHalfUnits).toBeGreaterThan(0);
          expect(win.returnedHalfUnits).toBe(win.stakeHalfUnits + win.profitHalfUnits);
        }

        for (const betType of sideBetTypes) {
          if (input.sideBets[betType] === 0) {
            expect(winningBetTypes.has(betType)).toBe(false);
          }
        }
      }),
      { numRuns: propertyRunCount },
    );
  });
});
