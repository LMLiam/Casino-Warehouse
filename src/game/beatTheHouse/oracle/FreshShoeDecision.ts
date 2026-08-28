export type FreshShoeDecision = {
  readonly action: 'hit' | 'stick';
  readonly expectedReturned: number;
  readonly hitExpectedReturned: number;
  readonly stickExpectedReturned: number;
};
