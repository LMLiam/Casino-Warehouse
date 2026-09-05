import { describe, expect, it } from 'vitest';
import { BeatShoeStatusView } from '../../../src/app/views/BeatShoeStatusView';
import type { BeatShoeStatusViewElements } from '../../../src/app/views/BeatShoeStatusViewElements';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import type { BeatTheHouseShoeSnapshot } from '../../../src/game/beatTheHouse/shoe/BeatTheHouseShoeSnapshot';
import type { GameEvent } from '../../../src/game/types/GameEvent';

const createElements = () => {
  const statusClassList = createClassList();
  const cutClassList = createClassList();
  const elements: BeatShoeStatusViewElements & {
    readonly statusClassList: { contains(token: string): boolean };
    readonly cutClassList: { contains(token: string): boolean };
  } = {
    beatShoeStatus: { classList: statusClassList },
    beatShoeLabel: { textContent: '' },
    beatShoeCounts: { textContent: '' },
    beatShoeMeter: { value: 0, max: 0 },
    beatShoeCut: { textContent: '', classList: cutClassList },
    beatShoeCue: { textContent: '' },
    statusClassList,
    cutClassList,
  };
  return elements;
};

const createClassList = () => {
  const tokens = new Set<string>();
  return {
    toggle(token: string, force?: boolean): boolean {
      const enabled = force ?? !tokens.has(token);
      if (enabled) {
        tokens.add(token);
      } else {
        tokens.delete(token);
      }
      return enabled;
    },
    contains(token: string): boolean {
      return tokens.has(token);
    },
  };
};

const createShoe = (overrides: Partial<BeatTheHouseShoeSnapshot> = {}): BeatTheHouseShoeSnapshot => ({
  cardsDealt: 42,
  cardsRemaining: 270,
  totalCards: 312,
  cutCardReached: false,
  ...overrides,
});

const createEvent = (type: GameEvent['type']): GameEvent => ({ type });

interface HostileShoeSnapshot extends BeatTheHouseShoeSnapshot {
  readonly remainingCards: readonly { readonly rank: string; readonly suit: string }[];
  readonly cutThresholdCardsDealt: number;
  readonly shufflePending: boolean;
  readonly rankCounts: Readonly<Record<string, number>>;
  readonly suitCounts: Readonly<Record<string, number>>;
  readonly randomState: number;
}

describe('BeatShoeStatusView', () => {
  it('renders only the four approved public fields with the six-deck label and meter maximum', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);

    view.render(createShoe(), []);

    expect(elements.beatShoeLabel.textContent).toBe(`${beatTheHouseRules.deckCount}-deck shoe`);
    expect(elements.beatShoeCounts.textContent).toContain('42');
    expect(elements.beatShoeCounts.textContent).toContain('270');
    expect(elements.beatShoeCounts.textContent).toContain('312');
    expect(elements.beatShoeMeter.max).toBe(312);
    expect(elements.beatShoeMeter.value).toBe(270);
    expect(elements.statusClassList.contains('hidden')).toBe(false);
  });

  it('keeps persistent cut status visible while the flag is true, including a reconnect without the event', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);

    view.render(createShoe({ cutCardReached: true }), []);

    expect(elements.beatShoeCut.textContent).toBe('Cut card reached - shuffle after round');
    expect(elements.cutClassList.contains('hidden')).toBe(false);
    expect(elements.beatShoeCue.textContent).toBe('');
  });

  it('announces cut and shuffle transitions once and suppresses repeats', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);
    const base = createShoe({ cutCardReached: true });

    view.render(base, []);
    expect(elements.beatShoeCue.textContent).toBe('');

    view.render(base, [createEvent('shoe-cut-reached')]);
    expect(elements.beatShoeCue.textContent).toContain('Cut card reached');

    view.render(base, [createEvent('shoe-cut-reached')]);
    expect(elements.beatShoeCue.textContent).toContain('Cut card reached');

    view.render(base, []);
    expect(elements.beatShoeCue.textContent).toBe('');

    view.render(createShoe(), [createEvent('shoe-shuffled')]);
    expect(elements.beatShoeCue.textContent).toContain('Shoe shuffled');

    view.render(createShoe(), [createEvent('shoe-shuffled')]);
    expect(elements.beatShoeCue.textContent).toContain('Shoe shuffled');

    view.render(createShoe(), []);
    expect(elements.beatShoeCue.textContent).toBe('');
  });

  it('renders cues in lastEvents order and clears the shuffle cue on the next shoe snapshot', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);

    view.render(createShoe(), [createEvent('shoe-cut-reached'), createEvent('shoe-shuffled')]);
    const cue = elements.beatShoeCue.textContent ?? '';
    expect(cue.indexOf('Cut card reached')).toBeLessThan(cue.indexOf('Shoe shuffled'));

    view.render(createShoe({ cardsDealt: 0, cardsRemaining: 312 }), []);
    expect(elements.beatShoeCue.textContent).toBe('');
    expect(elements.beatShoeCounts.textContent).toContain('312');
  });

  it('never serialises private shoe keys into rendered output', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);
    const hostile: HostileShoeSnapshot = {
      ...createShoe(),
      remainingCards: [{ rank: 'A', suit: 'spades' }],
      cutThresholdCardsDealt: 220,
      shufflePending: true,
      rankCounts: { A: 1 },
      suitCounts: { spades: 1 },
      randomState: 123,
    };

    view.render(hostile, []);

    const rendered = [
      elements.beatShoeLabel.textContent ?? '',
      elements.beatShoeCounts.textContent ?? '',
      elements.beatShoeCut.textContent ?? '',
      elements.beatShoeCue.textContent ?? '',
    ].join('\n');
    for (const forbidden of ['remainingCards', 'cutThresholdCardsDealt', 'shufflePending', 'rankCounts', 'suitCounts', 'randomState']) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it('hides without resetting the transition latch', () => {
    const elements = createElements();
    const view = new BeatShoeStatusView(elements);
    const shoe = createShoe({ cutCardReached: true });

    view.render(shoe, [createEvent('shoe-cut-reached')]);
    expect(elements.beatShoeCue.textContent).toContain('Cut card reached');

    view.hide();
    expect(elements.statusClassList.contains('hidden')).toBe(true);

    view.render(shoe, [createEvent('shoe-cut-reached')]);
    expect(elements.beatShoeCue.textContent).toContain('Cut card reached');

    view.render(shoe, []);
    view.render(shoe, [createEvent('shoe-cut-reached')]);
    expect(elements.beatShoeCue.textContent).toContain('Cut card reached');
  });
});
