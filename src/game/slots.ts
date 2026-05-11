import { secureRandomUnit, type Rng } from './rng';
import { slotThemeSchema } from '../schemas/casinoSchemas';

export type SlotSymbol = 'princess' | 'lotus' | 'elephant' | 'temple' | 'fan' | 'orchid';
export type SlotPhase = 'idle' | 'spun' | 'bonus';
export type JackpotTier = 'mini' | 'minor' | 'major' | 'grand';

export interface JackpotWin {
  readonly tier: JackpotTier;
  readonly label: string;
  readonly amount: number;
}

export interface SlotSnapshot {
  readonly themeId: string;
  readonly themeTitle: string;
  readonly phase: SlotPhase;
  readonly wager: number;
  readonly columns: number;
  readonly rows: number;
  readonly reels: readonly SlotSymbol[];
  readonly lineWin: number;
  readonly jackpotWin?: JackpotWin;
  readonly bonusPicksRemaining: number;
  readonly freeSpinsRemaining: number;
  readonly bonusBank: number;
  readonly returned: number;
  readonly status: string;
}

export interface SlotTheme {
  readonly id: string;
  readonly title: string;
  readonly accent: string;
  readonly columns: number;
  readonly rows: number;
  readonly wildSymbol?: SlotSymbol;
  readonly reelStrip: readonly SlotSymbol[];
  readonly payouts: Readonly<Partial<Record<SlotSymbol, number>>>;
  readonly jackpots: Readonly<Partial<Record<JackpotTier, { readonly symbol: SlotSymbol; readonly multiplier: number; readonly label: string }>>>;
  readonly bonus: {
    readonly triggerSymbol: SlotSymbol;
    readonly picks: number;
    readonly freeSpinsOnTwoBonus: number;
    readonly multipliers: readonly number[];
  };
}

export interface SlotsOptions {
  readonly rng?: Rng;
  readonly theme?: SlotTheme;
}

export const defaultSlotTheme: SlotTheme = {
  id: 'thai-princess',
  title: 'Thai Princess',
  accent: '#f4bf58',
  columns: 3,
  rows: 5,
  wildSymbol: 'princess',
  reelStrip: [
    'princess',
    'lotus',
    'elephant',
    'temple',
    'fan',
    'orchid',
    'lotus',
    'elephant',
    'temple',
    'fan',
    'princess',
    'orchid',
    'lotus',
    'temple',
    'fan',
    'elephant',
    'orchid',
    'princess',
    'lotus',
    'temple',
  ],
  payouts: {
    princess: 200,
    elephant: 40,
    temple: 35,
    fan: 24,
    orchid: 16,
  },
  jackpots: {
    mini: { symbol: 'fan', multiplier: 24, label: 'Fan' },
    minor: { symbol: 'temple', multiplier: 35, label: 'Temple' },
    major: { symbol: 'elephant', multiplier: 40, label: 'Elephant' },
    grand: { symbol: 'princess', multiplier: 200, label: 'Princess' },
  },
  bonus: {
    triggerSymbol: 'lotus',
    picks: 4,
    freeSpinsOnTwoBonus: 8,
    multipliers: [5, 8, 12, 16, 20, 32, 50, 75],
  },
};

export class SlotsGame {
  private readonly rng?: Rng;
  private readonly theme: SlotTheme;
  private phase: SlotPhase = 'idle';
  private wager = 0;
  private reels: SlotSymbol[];
  private lineWin = 0;
  private jackpotWin?: JackpotWin;
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
    this.reels = normalizeReels(snapshot.reels.filter(isSlotSymbol), this.theme);
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
    this.reels = forcedReels ? normalizeReels([...forcedReels], this.theme) : Array.from({ length: gridSize(this.theme) }, () => this.randomSymbol());
    this.jackpotWin = jackpotPayout(this.theme, this.reels, this.wager);
    this.lineWin = this.jackpotWin?.amount ?? linePayout(this.theme, this.reels, this.wager);
    this.bonusBank = 0;
    this.returned = this.lineWin;

    const bonusCount = this.reels.filter((symbol) => symbol === this.theme.bonus.triggerSymbol).length;
    if (bonusCount >= 3) {
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

    const multiplier = forcedMultiplier ?? this.theme.bonus.multipliers[this.randomIndex(this.theme.bonus.multipliers.length)];
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
    return this.theme.reelStrip[this.randomIndex(this.theme.reelStrip.length)];
  }

  private initialGrid(): SlotSymbol[] {
    return Array.from({ length: gridSize(this.theme) }, (_, index) => this.theme.reelStrip[index % this.theme.reelStrip.length]);
  }

  private randomIndex(length: number): number {
    const value = this.rng ? this.rng() : secureRandomUnit();
    return Math.max(0, Math.min(length - 1, Math.floor(value * length)));
  }
}

export const symbolLabel = (symbol: SlotSymbol): string =>
  ({
    princess: 'Princess Wild',
    lotus: 'Lotus Scatter',
    elephant: 'Elephant',
    temple: 'Temple',
    fan: 'Fan',
    orchid: 'Orchid',
  })[symbol];

const linePayout = (theme: SlotTheme, reels: readonly SlotSymbol[], wager: number): number =>
  winningRows(theme, reels).reduce((total, row) => total + rowPayout(theme, row, wager), 0);

const rowPayout = (theme: SlotTheme, row: readonly SlotSymbol[], wager: number): number => {
  const wildPayout = wildLinePayout(theme, row, wager);
  if (wildPayout > 0) {
    return wildPayout;
  }

  const [first, second, third] = row;
  if (first === second && second === third && first !== theme.bonus.triggerSymbol) {
    return wager * (theme.payouts[first] ?? 0);
  }

  return 0;
};

const wildLinePayout = (theme: SlotTheme, row: readonly SlotSymbol[], wager: number): number => {
  const wildSymbol = theme.wildSymbol;
  if (!wildSymbol) {
    return 0;
  }

  const firstPayingSymbol = row.find((symbol) => symbol !== wildSymbol && symbol !== theme.bonus.triggerSymbol);
  const lineSymbol = row[0] === wildSymbol ? (firstPayingSymbol ?? wildSymbol) : row[0];
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

  if (matches < 3) {
    return 0;
  }

  const baseMultiplier = theme.payouts[lineSymbol] ?? 0;
  return wager * baseMultiplier * Math.max(1, matches - 2);
};

const jackpotPayout = (theme: SlotTheme, reels: readonly SlotSymbol[], wager: number): JackpotWin | undefined => {
  const wins = winningRows(theme, reels).flatMap((row) => {
    const [first, second, third] = row;
    if (first !== second || second !== third) {
      return [];
    }
    const win = (Object.entries(theme.jackpots) as [JackpotTier, NonNullable<SlotTheme['jackpots'][JackpotTier]>][]).find(([, jackpot]) => jackpot.symbol === first);
    if (!win) {
      return [];
    }
    const [tier, jackpot] = win;
    return [{ tier, label: `${jackpot.label} Jackpot`, amount: wager * jackpot.multiplier }];
  });
  return wins.sort((left, right) => right.amount - left.amount)[0];
};

const winningRows = (theme: SlotTheme, reels: readonly SlotSymbol[]): readonly SlotSymbol[][] =>
  Array.from({ length: theme.rows }, (_, rowIndex) => reels.slice(rowIndex * theme.columns, rowIndex * theme.columns + theme.columns)).filter(
    (row) => row.length === theme.columns,
  );

const gridSize = (theme: SlotTheme): number => theme.columns * theme.rows;

const normalizeReels = (reels: readonly SlotSymbol[], theme: SlotTheme): SlotSymbol[] => {
  const fallback = theme.reelStrip[0] ?? 'lotus';
  return Array.from({ length: gridSize(theme) }, (_, index) => reels[index] ?? fallback);
};

const slotSymbols: readonly SlotSymbol[] = ['princess', 'lotus', 'elephant', 'temple', 'fan', 'orchid'];

const isSlotSymbol = (symbol: SlotSymbol): symbol is SlotSymbol => slotSymbols.includes(symbol);
