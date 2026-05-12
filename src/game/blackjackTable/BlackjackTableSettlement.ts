export interface BlackjackTableSettlement {
  readonly seatId: string;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
}
