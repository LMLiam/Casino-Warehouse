export interface BeatShoeStatusViewElements {
  readonly beatShoeStatus: {
    readonly classList: Pick<DOMTokenList, 'toggle'>;
  };
  readonly beatShoeLabel: { textContent: string | null };
  readonly beatShoeCounts: { textContent: string | null };
  readonly beatShoeMeter: {
    value: number;
    max: number;
  };
  readonly beatShoeCut: {
    textContent: string | null;
    readonly classList: Pick<DOMTokenList, 'toggle'>;
  };
  readonly beatShoeCue: { textContent: string | null };
}
