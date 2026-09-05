import { describe, expect, it } from 'vitest';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import { findGame } from '../../../src/game/catalog/findGame';
import { findSlotTheme } from '../../../src/game/catalog/findSlotTheme';
import { gameCatalog } from '../../../src/game/catalog/gameCatalog';
import { slotThemes } from '../../../src/game/catalog/slotThemes';

describe('game catalog', () => {
  it('provides rules and paytable copy for every lobby game', () => {
    expect(gameCatalog.length).toBeGreaterThan(2);
    for (const game of gameCatalog) {
      expect(game.rules.length).toBeGreaterThan(0);
      expect(game.paytable.length).toBeGreaterThan(0);
    }
  });

  it('registers every slot theme as a lobby game with matching bonus information', () => {
    const slotGames = gameCatalog.filter((game) => game.kind === 'slots');

    expect(slotGames.map((game) => game.slotTheme?.id)).toEqual(slotThemes.map((theme) => theme.id));
    expect(slotGames.map((game) => game.title)).toEqual(['Thai Princess']);
    for (const game of slotGames) {
      expect(game.rules.join(' ')).toContain(String(game.slotTheme?.bonus.freeSpinsOnTwoBonus));
      expect(game.paytable.join(' ')).toContain('Bonus picks');
    }
  });

  it('models Thai Princess from the researched Blueprint slot traits', () => {
    const thaiPrincess = slotThemes.find((theme) => theme.id === 'thai-princess');
    const catalogEntry = findGame('slots:thai-princess');

    expect(thaiPrincess).toMatchObject({
      title: 'Thai Princess',
      columns: 3,
      rows: 5,
      wildSymbol: 'princess',
      bonus: { triggerSymbol: 'lotus', picks: 4, freeSpinsOnTwoBonus: 8 },
    });
    expect(catalogEntry.rules.join(' ')).toContain('lotus scatter-style');
    expect(catalogEntry.paytable.join(' ')).toContain('princess substitutes');
  });

  it('falls back safely for unknown catalog lookups', () => {
    expect(findGame('missing' as never).id).toBe('beat-the-house');
    expect(findSlotTheme('blackjack').id).toBe('thai-princess');
  });

  it('binds every Beat the House rule and payout to production constants', () => {
    const beat = findGame('beat-the-house');
    const copy = [...beat.rules, ...beat.paytable].join('\n');

    expect(copy).toContain(`${beatTheHouseRules.deckCount}-deck shoe`);
    expect(copy).toContain(String(beatTheHouseRules.cardsPerShoe));
    expect(copy).toContain(String(beatTheHouseRules.cutThreshold.minimum));
    expect(copy).toContain(String(beatTheHouseRules.cutThreshold.maximum));
    expect(copy).toContain('70.2%');
    expect(copy).toContain('75%');
    expect(copy).toContain('shuffles before the next deal');
    expect(copy).toContain('hits ranks 3 through 9');
    expect(copy).toContain('stands on 10, J, Q, K, and A');
    expect(copy).toContain('first card of 2 loses immediately');
    expect(copy).toContain('dealer 2');
    expect(copy).toContain(`${beatTheHouseRules.maximumPlayerCards}-card maximum`);
    expect(copy).toContain('ties push');
    expect(copy).toContain(`${beatTheHouseRules.blackAceProfitRatio.numerator}:${beatTheHouseRules.blackAceProfitRatio.denominator} profit`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.aceFlashSingle}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.aceFlashBoth}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.dealerBust}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.matchPush}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensOne}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensTwo}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensThree}:1`);
    expect(copy).toContain(`${beatTheHouseRules.sideBetProfitMultipliers.dealerSevensFour}:1`);
    expect(copy).toContain('cannot exceed, the main bet');
    expect(copy).toContain('whole-chip');
    expect(copy).toContain('zero or one');
    expect(copy).toContain('Two half-chips release one whole chip automatically');
    expect(copy).toContain('not wagerable');
    expect(copy).toContain('fictional');
    expect(copy).toContain('no cash value');
    expect(copy).not.toContain('10:1 for one black Ace');
    expect(copy).not.toContain('50:1 when');
    expect(copy).not.toContain('total return');
  });

  it('keeps Blackjack and Slots rules unchanged', () => {
    const blackjack = findGame('blackjack');
    expect(blackjack.rules.join('\n')).toContain('Dealer stands on soft 17');
    expect(blackjack.paytable.join('\n')).toContain('Blackjack pays 3:2.');

    const slots = findGame('slots:thai-princess');
    expect(slots.rules.join(' ')).toContain('lotus scatter-style');
    expect(slots.paytable.join(' ')).toContain('princess substitutes');
  });
});
