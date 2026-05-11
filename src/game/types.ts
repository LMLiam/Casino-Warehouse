import type { Card } from './cards';

export const handIds = ['left', 'centre', 'right'] as const;
export const betTypes = ['main', 'aceFlash', 'dealerBust', 'matchPush', 'dealerSevens'] as const;

export type HandId = (typeof handIds)[number];
export type BetType = (typeof betTypes)[number];
export type Phase = 'betting' | 'dealing' | 'playing' | 'dealer' | 'roundOver';
export type HandResult = 'win' | 'lose' | 'push';
export type SideBetState = 'win' | 'lose' | 'idle';

export type Bets = Record<HandId, Record<BetType, number>>;
export type SideStates = Record<HandId, Record<Exclude<BetType, 'main'>, SideBetState>>;

export interface PlayerHand {
  readonly id: HandId;
  readonly cards: Card[];
  readonly done: boolean;
  readonly result?: HandResult;
  readonly automaticWin: boolean;
  readonly finalCard?: Card;
}

export interface DealerHand {
  readonly cards: Card[];
  readonly holeCard?: Card;
  readonly holeRevealed: boolean;
  readonly bust: boolean;
  readonly blackAce: boolean;
  readonly finalCard?: Card;
}

export interface RoundSummary {
  readonly handId: HandId;
  readonly mainResult: HandResult;
  readonly stake: number;
  readonly returned: number;
  readonly profit: number;
  readonly sideWins: SideWin[];
}

export interface SideWin {
  readonly betType: Exclude<BetType, 'main'>;
  readonly label: string;
  readonly profit: number;
  readonly returned: number;
}

export interface GameEvent {
  readonly type:
    | 'bet-placed'
    | 'bets-cleared'
    | 'round-started'
    | 'player-card'
    | 'dealer-hole'
    | 'dealer-card'
    | 'hand-completed'
    | 'round-settled'
    | 'message';
  readonly message?: string;
  readonly handId?: HandId;
  readonly betType?: BetType;
  readonly amount?: number;
  readonly card?: Card;
  readonly cardIndex?: number;
  readonly result?: HandResult;
  readonly summaries?: RoundSummary[];
  readonly totalProfit?: number;
}

export interface GameSnapshot {
  readonly phase: Phase;
  readonly bankroll: number;
  readonly bets: Bets;
  readonly activeHand?: HandId;
  readonly hands: Record<HandId, PlayerHand>;
  readonly dealer: DealerHand;
  readonly sideStates: SideStates;
  readonly summaries: RoundSummary[];
  readonly lastEvents: GameEvent[];
  readonly status: string;
  readonly canRebet: boolean;
}
