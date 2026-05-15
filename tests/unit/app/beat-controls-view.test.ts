import { describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { HandId } from '../../../src/game/types/HandId';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import { BeatControlsView } from '../../../src/app/views/BeatControlsView';
import { chipValues } from '../../../src/ui/chips/chipValues';

class FakeClassList {
  private readonly classes = new Set<string>();

  public toggle(className: string, force?: boolean): boolean {
    const enabled = force ?? !this.classes.has(className);
    if (enabled) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }
    return enabled;
  }

  public contains(className: string): boolean {
    return this.classes.has(className);
  }
}

const createButton = () => ({
  disabled: false,
  draggable: false,
  dataset: {},
  classList: new FakeClassList(),
});

const createChipButton = (value: number) => ({
  disabled: false,
  draggable: false,
  dataset: { chip: String(value) },
  classList: new FakeClassList(),
});

const createElement = () => ({
  textContent: '',
  classList: new FakeClassList(),
});

const createElements = () => ({
  status: createElement(),
  onTable: createElement(),
  chipRail: createElement(),
  chipButtons: chipValues.map((value) => createChipButton(value)),
  dealButton: createButton(),
  rebetButton: createButton(),
  clearButton: createButton(),
  nextButton: createButton(),
  hitButton: createButton(),
  stickButton: createButton(),
});

const createRoom = (
  game: GameSnapshot,
  options: {
    readonly players?: RoomSnapshot['players'];
    readonly seats?: RoomSnapshot['seats'];
    readonly rebetSeatIds?: readonly HandId[];
  } = {},
): RoomSnapshot => ({
  roomId: 'ROOM42',
  roomName: 'Beat Room',
  hostProfileId: 'alice',
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'betting',
  phase: 'betting',
  sessionId: 'session-1',
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 1,
  players: options.players ?? [
    { connectionId: 'a', profileId: 'alice', profileName: 'Alice', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
    { connectionId: 'b', profileId: 'bob', profileName: 'Bob', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
  ],
  spectators: [],
  seats: options.seats ?? [{ seatId: 'left', profileId: 'alice' }, { seatId: 'right', profileId: 'bob' }, { seatId: 'centre' }],
  game,
  beat: { rebetSeatIds: options.rebetSeatIds ?? ['left'] },
});

describe('BeatControlsView', () => {
  it('keeps local rebet availability on the game snapshot path', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = { ...base, canRebet: true };
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined, true);

    expect(elements.rebetButton.disabled).toBe(false);
  });

  it('confirms queued local deal actions after the main bet appears', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      bets: {
        ...base.bets,
        left: { ...base.bets.left, main: 25 },
      },
    };
    const elements = createElements();
    const view = new BeatControlsView(elements);
    let confirmed = false;

    view.markPendingBet('main');
    view.queueStartRound();
    view.render(snapshot, true, () => {
      confirmed = true;
    });

    expect(confirmed).toBe(true);
    expect(elements.dealButton.disabled).toBe(false);
  });

  it('clears pending controls when the Beat the House snapshot leaves betting', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = { ...base, phase: 'roundOver' };
    const elements = createElements();
    const view = new BeatControlsView(elements);

    view.markPendingBet('main');
    view.render(snapshot, true, () => undefined);

    expect(elements.dealButton.disabled).toBe(true);
    expect(elements.nextButton.disabled).toBe(false);
  });

  it('uses the acting multiplayer seat for clear and rebet button availability', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      canRebet: false,
      rebetAmounts: { ...base.rebetAmounts, left: 25, right: 40 },
      bets: {
        ...base.bets,
        right: { ...base.bets.right, main: 40 },
      },
    };
    const room = createRoom(snapshot);
    const aliceElements = createElements();
    const bobElements = createElements();

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, 'alice', 100);
    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, 'bob', 100);

    expect(aliceElements.rebetButton.disabled).toBe(false);
    expect(aliceElements.clearButton.disabled).toBe(true);
    expect(aliceElements.clearButton.classList.contains('hidden')).toBe(true);
    expect(bobElements.rebetButton.disabled).toBe(true);
    expect(bobElements.clearButton.disabled).toBe(false);
  });

  it('counts dealer tips as clearable table credits without enabling rebet', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      canRebet: false,
      rebetAmounts: { ...base.rebetAmounts, right: 40 },
      dealerTips: { ...base.dealerTips, right: 10 },
    };
    const room = createRoom(snapshot, { rebetSeatIds: ['right'] });
    const bobElements = createElements();

    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, 'bob', 100);

    expect(bobElements.clearButton.disabled).toBe(false);
    expect(bobElements.rebetButton.disabled).toBe(true);
  });

  it('keeps rebet disabled when a replacement player claims a seat with another profile saved wager', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      canRebet: false,
      rebetAmounts: { ...base.rebetAmounts, left: 25, right: 40 },
    };
    const room = createRoom(snapshot, {
      players: [
        { connectionId: 'a', profileId: 'alice', profileName: 'Alice', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
        { connectionId: 'c', profileId: 'cory', profileName: 'Cory', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
      ],
      seats: [{ seatId: 'left', profileId: 'alice' }, { seatId: 'right', profileId: 'cory' }, { seatId: 'centre' }],
      rebetSeatIds: ['left'],
    });
    const aliceElements = createElements();
    const coryElements = createElements();
    const missingEligibilityElements = createElements();

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, 'alice', 100);
    new BeatControlsView(coryElements).render(snapshot, true, () => undefined, true, room, 'cory', 100);
    new BeatControlsView(missingEligibilityElements).render(snapshot, true, () => undefined, true, { ...room, beat: undefined }, 'alice', 100);

    expect(aliceElements.rebetButton.disabled).toBe(false);
    expect(coryElements.rebetButton.disabled).toBe(true);
    expect(missingEligibilityElements.rebetButton.disabled).toBe(true);
  });

  it('hides Beat the House chip buttons above the active bankroll', () => {
    const snapshot = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined, true, undefined, undefined, 1000);

    const visibleValues = elements.chipButtons.filter((button) => !button.classList.contains('hidden')).map((button) => Number(button.dataset.chip));
    const hiddenValues = elements.chipButtons.filter((button) => button.classList.contains('hidden')).map((button) => Number(button.dataset.chip));
    expect(visibleValues).toEqual([1, 5, 25, 100, 500, 1000]);
    expect(hiddenValues).toEqual([5000, 10000]);
    expect(elements.chipButtons.find((button) => button.dataset.chip === '5000')?.disabled).toBe(true);
  });

  it('updates the visible chip list when the active bankroll changes', () => {
    const snapshot = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const elements = createElements();
    const view = new BeatControlsView(elements);

    view.render(snapshot, true, () => undefined, true, undefined, undefined, 1000);
    view.render(snapshot, true, () => undefined, true, undefined, undefined, 25);

    expect(elements.chipButtons.filter((button) => !button.classList.contains('hidden')).map((button) => Number(button.dataset.chip))).toEqual([1, 5, 25]);

    view.render(snapshot, true, () => undefined, true, undefined, undefined, 0);

    expect(elements.chipButtons.every((button) => button.classList.contains('hidden'))).toBe(true);
    expect(elements.chipRail.classList.contains('hidden')).toBe(true);
  });
});
