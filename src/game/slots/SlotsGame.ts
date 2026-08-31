import type { Rng } from '../rng/Rng';
import { secureRandomUnit } from '../rng/secureRandomUnit';
import { slotThemeSchema } from '../../schemas/casinoSchemas/slotThemeSchema';
import { defaultSlotTheme } from './defaultSlotTheme';
import type { JackpotTier } from './JackpotTier';
import type { JackpotWin } from './JackpotWin';
import type { SlotPhase } from './SlotPhase';
import type { SlotSnapshot } from './SlotSnapshot';
import type { SlotsOptions } from './SlotsOptions';
import type { SlotSymbol } from './SlotSymbol';
import type { SlotTheme } from './SlotTheme';

export class SlotsGame {
  private static readonly bonusTriggerMatchCount = 3;
  private static readonly wildLineMinimumMatches = 3;

  private static readonly slotSymbols: readonly SlotSymbol[] = ['princess', 'lotus', 'elephant', 'temple', 'fan', 'orchid'];

  private readonly rng?: Rng | undefined;
  private readonly theme: SlotTheme;
  private phase: SlotPhase = 'idle';
  private wager = 0;
  private reels: SlotSymbol[];
  private lineWin = 0;
  private jackpotWin?: JackpotWin | undefined;
  private bonusPicksRemaining = 0;
  private freeSpinsRemaining = 0;
  private bonusBank = 0;
  private returned = 0;
  private status: string;

  public constructor(options: SlotsOptions = {}) {
    this.rng = options.rng;
    this.theme = slotThemeSchema.parse(options.theme ?? defaultSlotTheme);
    this.reels = this.initialGrid();
    this.status = `Choose a wager and spin ${this.theme.title}.`;
  }

  public snapshot(): SlotSnapshot {
    return {
      themeId: this.theme.id,
      themeTitle: this.theme.title,
      phase: this.phase,
      wager: this.wager,
      columns: this.theme.columns,
      rows: this.theme.rows,
      reels: [...this.reels],
      lineWin: this.lineWin,
      jackpotWin: this.jackpotWin,
      bonusPicksRemaining: this.bonusPicksRemaining,
      freeSpinsRemaining: this.freeSpinsRemaining,
      bonusBank: this.bonusBank,
      returned: this.returned,
      status: this.status,
    };
  }

  public restore(snapshot: SlotSnapshot): SlotSnapshot {
    if (snapshot.themeId !== this.theme.id) {
      return this.snapshot();
    }

    this.phase = snapshot.phase;
    this.wager = Math.max(0, Math.floor(snapshot.wager));
    this.reels = SlotsGame.normalizeReels(snapshot.reels.filter(SlotsGame.isSlotSymbol), this.theme);
    this.lineWin = Math.max(0, Math.floor(snapshot.lineWin));
    this.jackpotWin = snapshot.jackpotWin;
    this.bonusPicksRemaining = Math.max(0, Math.floor(snapshot.bonusPicksRemaining));
    this.freeSpinsRemaining = Math.max(0, Math.floor(snapshot.freeSpinsRemaining));
    this.bonusBank = Math.max(0, Math.floor(snapshot.bonusBank));
    this.returned = Math.max(0, Math.floor(snapshot.returned));
    this.status = snapshot.status || `Choose a wager and spin ${this.theme.title}.`;
    return this.snapshot();
  }

  public spin(wager: number, forcedReels?: readonly SlotSymbol[]): SlotSnapshot {
    if (this.phase === 'bonus') {
      return this.snapshot();
    }

    const usingFreeSpin = this.freeSpinsRemaining > 0;
    if (usingFreeSpin) {
      this.freeSpinsRemaining -= 1;
    }

    this.wager = Math.floor(wager);
    this.reels = forcedReels
      ? SlotsGame.normalizeReels([...forcedReels], this.theme)
      : Array.from({ length: SlotsGame.gridSize(this.theme) }, () => this.randomSymbol());
    this.jackpotWin = SlotsGame.jackpotPayout(this.theme, this.reels, this.wager);
    this.lineWin = this.jackpotWin?.amount ?? SlotsGame.linePayout(this.theme, this.reels, this.wager);
    this.bonusBank = 0;
    this.returned = this.lineWin;

    const bonusCount = this.reels.filter((symbol) => symbol === this.theme.bonus.triggerSymbol).length;
    if (bonusCount >= SlotsGame.bonusTriggerMatchCount) {
      this.phase = 'bonus';
      this.bonusPicksRemaining = this.theme.bonus.picks;
      this.status = `${this.theme.title} bonus unlocked. Pick ${this.theme.bonus.picks} prizes.`;
      return this.snapshot();
    }

    if (bonusCount === 2) {
      this.freeSpinsRemaining += this.theme.bonus.freeSpinsOnTwoBonus;
    }

    this.phase = 'spun';
    this.bonusPicksRemaining = 0;
    const freeSpinText = usingFreeSpin ? ' Free spin used.' : bonusCount === 2 ? ` ${this.theme.bonus.freeSpinsOnTwoBonus} free spins awarded.` : '';
    this.status = `${this.jackpotWin ? `${this.jackpotWin.label} pays £${this.lineWin}.` : this.lineWin > 0 ? `Line win pays £${this.lineWin}.` : 'No line win. Spin again.'}${freeSpinText}`;
    return this.snapshot();
  }

  public pickBonus(forcedMultiplier?: number): SlotSnapshot {
    if (this.phase !== 'bonus' || this.bonusPicksRemaining <= 0) {
      return this.snapshot();
    }

    const multiplierValue = this.theme.bonus.multipliers[this.randomIndex(this.theme.bonus.multipliers.length)];
    if (multiplierValue === undefined) {
      throw new Error('Slot bonus multiplier is invalid.');
    }
    const multiplier = forcedMultiplier ?? multiplierValue;
    const prize = this.wager * multiplier;
    this.bonusBank += prize;
    this.bonusPicksRemaining -= 1;
    this.returned = this.lineWin + this.bonusBank;

    if (this.bonusPicksRemaining === 0) {
      this.phase = 'spun';
      this.status = `Bonus complete. Total slot return £${this.returned}.`;
    } else {
      this.status = `Bonus pick pays £${prize}. ${this.bonusPicksRemaining} left.`;
    }

    return this.snapshot();
  }

  private randomSymbol(): SlotSymbol {
    const symbol = this.theme.reelStrip[this.randomIndex(this.theme.reelStrip.length)];
    if (!symbol) {
      throw new Error('Slot reel strip is invalid.');
    }
    return symbol;
  }

  private initialGrid(): SlotSymbol[] {
    return Array.from({ length: SlotsGame.gridSize(this.theme) }, (_, index) => {
      const symbol = this.theme.reelStrip[index % this.theme.reelStrip.length];
      if (!symbol) {
        throw new Error('Slot reel strip is invalid.');
      }
      return symbol;
    });
  }

  private randomIndex(length: number): number {
    const value = this.rng ? this.rng() : secureRandomUnit();
    return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
  }

  private static linePayout(theme: SlotTheme, reels: readonly SlotSymbol[], wager: number): number {
    return SlotsGame.winningRows(theme, reels).reduce((total, row) => total + SlotsGame.rowPayout(theme, row, wager), 0);
  }

  private static rowPayout(theme: SlotTheme, row: readonly SlotSymbol[], wager: number): number {
    const wildPayout = SlotsGame.wildLinePayout(theme, row, wager);
    if (wildPayout > 0) {
      return wildPayout;
    }

    const [first, second, third] = row;
    if (first === undefined || second === undefined || third === undefined) {
      return 0;
    }
    if (first === second && second === third && first !== theme.bonus.triggerSymbol) {
      return wager * (theme.payouts[first] ?? 0);
    }

    return 0;
  }

  private static wildLinePayout(theme: SlotTheme, row: readonly SlotSymbol[], wager: number): number {
    const wildSymbol = theme.wildSymbol;
    if (!wildSymbol) {
      return 0;
    }

    const firstPayingSymbol = row.find((symbol) => symbol !== wildSymbol && symbol !== theme.bonus.triggerSymbol);
    const lineSymbol = row[0] === wildSymbol ? (firstPayingSymbol ?? wildSymbol) : row[0];
    if (lineSymbol === undefined) {
      return 0;
    }
    if (lineSymbol === theme.bonus.triggerSymbol) {
      return 0;
    }

    let matches = 0;
    for (const symbol of row) {
      if (symbol === lineSymbol || symbol === wildSymbol) {
        matches += 1;
        continue;
      }
      break;
    }

    if (matches < SlotsGame.wildLineMinimumMatches) {
      return 0;
    }

    const baseMultiplier = theme.payouts[lineSymbol] ?? 0;
    return wager * baseMultiplier * Math.max(1, matches - 2);
  }

  private static jackpotPayout(theme: SlotTheme, reels: readonly SlotSymbol[], wager: number): JackpotWin | undefined {
    const wins = SlotsGame.winningRows(theme, reels).flatMap((row) => {
      const [first, second, third] = row;
      if (first !== second || second !== third) {
        return [];
      }
      const win = (Object.entries(theme.jackpots) as [JackpotTier, NonNullable<SlotTheme['jackpots'][JackpotTier]>][]).find(
        ([, jackpot]) => jackpot.symbol === first,
      );
      if (!win) {
        return [];
      }
      const [tier, jackpot] = win;
      return [{ tier, label: `${jackpot.label} Jackpot`, amount: wager * jackpot.multiplier }];
    });
    return wins.sort((left, right) => right.amount - left.amount)[0];
  }

  private static winningRows(theme: SlotTheme, reels: readonly SlotSymbol[]): readonly SlotSymbol[][] {
    return Array.from({ length: theme.rows }, (_, rowIndex) => reels.slice(rowIndex * theme.columns, rowIndex * theme.columns + theme.columns)).filter(
      (row) => row.length === theme.columns,
    );
  }

  private static gridSize(theme: SlotTheme): number {
    return theme.columns * theme.rows;
  }

  private static normalizeReels(reels: readonly SlotSymbol[], theme: SlotTheme): SlotSymbol[] {
    const fallback = theme.reelStrip[0] ?? 'lotus';
    return Array.from({ length: SlotsGame.gridSize(theme) }, (_, index) => reels[index] ?? fallback);
  }

  private static isSlotSymbol(symbol: SlotSymbol): symbol is SlotSymbol {
    return SlotsGame.slotSymbols.includes(symbol);
  }
}
