import { describe, expect, it } from 'vitest';
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
});
