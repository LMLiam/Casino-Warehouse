export interface LegacyCasinoProfile {
  readonly id?: string | number;
  readonly name?: string | number;
  readonly color?: string | null;
  readonly bankroll?: number | string | null;
  readonly houseAdvance?: {
    readonly outstandingBalance?: number | string | null;
    readonly activeCount?: number | string | null;
  } | null;
  readonly stats?: {
    readonly totalWagered?: number | string | null;
    readonly totalWon?: number | string | null;
    readonly netProfit?: number | string | null;
    readonly biggestWin?: number | string | null;
    readonly biggestWager?: number | string | null;
    readonly gamesPlayed?: number | string | null;
    readonly perGame?: Readonly<
      Record<
        string,
        {
          readonly gamesPlayed?: number | string | null;
          readonly wagered?: number | string | null;
          readonly won?: number | string | null;
          readonly netProfit?: number | string | null;
        } | null
      >
    > | null;
    readonly favouriteGame?: string | null;
  } | null;
  readonly transactions?:
    | readonly {
        readonly id?: string | number;
        readonly profileId?: string;
        readonly at?: string;
        readonly gameId?: string;
        readonly roomId?: string;
        readonly sessionId?: string;
        readonly type?: string | null;
        readonly amount?: number | string | null;
        readonly balanceBefore?: number | string | null;
        readonly balanceAfter?: number | string | null;
        readonly description?: string;
        readonly note?: string;
        readonly metadata?: Readonly<Record<string, string | number | boolean | Readonly<Record<string, string>>>> | null;
      }[]
    | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}
