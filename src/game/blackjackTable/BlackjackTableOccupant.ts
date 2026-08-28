export interface BlackjackTableOccupant {
  readonly seatId: string;
  readonly profileId?: string | undefined;
  readonly profileName?: string | undefined;
  readonly bankroll?: number | undefined;
}
