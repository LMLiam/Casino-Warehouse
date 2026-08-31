import { describe, expect, it } from 'vitest';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { HandId } from '../../../src/game/types/HandId';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import { BeatControlsView } from '../../../src/app/views/BeatControlsView';
import { chipValues } from '../../../src/ui/chips/chipValues';
import { testConnectionId, testProfileId, testRoomId, testSessionId } from '../schemas/testIds';

const aliceId = testProfileId('alice');
const bobId = testProfileId('bob');
const coryId = testProfileId('cory');

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

class FakeStyleDeclaration {
  private readonly properties = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }

  public removeProperty(name: string): string {
    const value = this.properties.get(name) ?? '';
    this.properties.delete(name);
    return value;
  }

  public getPropertyValue(name: string): string {
    return this.properties.get(name) ?? '';
  }
}

const createButton = () => ({
  disabled: false,
  draggable: false,
  dataset: {},
  textContent: '',
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

const createActionDock = () => ({
  dataset: {} as DOMStringMap,
  style: new FakeStyleDeclaration(),
});

const createElements = () => ({
  onTable: createElement(),
  tableHost: { clientWidth: 1000, clientHeight: 600 },
  actionDock: createActionDock(),
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
  roomId: testRoomId('ROOM42'),
  roomName: 'Beat Room',
  hostProfileId: aliceId,
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'betting',
  phase: 'betting',
  sessionId: testSessionId('session-1'),
  revision: 1,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1,
  updatedAt: 1,
  players: options.players ?? [
    { connectionId: testConnectionId('a'), profileId: aliceId, profileName: 'Alice', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
    { connectionId: testConnectionId('b'), profileId: bobId, profileName: 'Bob', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
  ],
  spectators: [],
  seats: options.seats ?? [{ seatId: 'left', profileId: aliceId }, { seatId: 'right', profileId: bobId }, { seatId: 'centre' }],
  game,
  beat: { rebetSeatIds: options.rebetSeatIds ?? ['left'], readyProfileIds: [], readyCount: 0, playerCount: options.players?.length ?? 2 },
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

  it('ignores routine Beat the House snapshot status while rendering controls', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      status: "Round complete. Total +£35. Dealer's Thanks +£2.",
    };
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined);

    expect(elements.onTable.textContent).toBe('£0');
    expect(elements.dealButton.disabled).toBe(true);
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

  it('renders multiplayer deal readiness and hides repeat ready clicks', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      bets: {
        ...base.bets,
        left: { ...base.bets.left, main: 25 },
      },
    };
    const room = {
      ...createRoom(snapshot),
      beat: { rebetSeatIds: ['left' as const], readyProfileIds: [aliceId], readyCount: 1, playerCount: 2, readyPhase: 'betting' as const },
    };
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined, true, room, aliceId, 100);

    expect(elements.dealButton.textContent).toBe('Waiting to Deal');
    expect(elements.dealButton.disabled).toBe(true);
  });

  it('keeps multiplayer next-round controls driven by readiness', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = { ...base, phase: 'roundOver' };
    const room = {
      ...createRoom(snapshot),
      phase: 'settled' as const,
      beat: {
        rebetSeatIds: ['left' as const],
        readyProfileIds: [bobId],
        readyCount: 1,
        playerCount: 2,
        readyPhase: 'roundOver' as const,
        nextRoundDeadlineAt: Date.now() + 20_000,
        nextRoundRemainingMs: 20_000,
      },
    };
    const elements = createElements();

    new BeatControlsView(elements).render(snapshot, true, () => undefined, true, room, aliceId, 100);

    expect(elements.nextButton.textContent).toBe('Ready for Next');
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

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, aliceId, 100);
    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, bobId, 100);

    expect(aliceElements.rebetButton.disabled).toBe(false);
    expect(aliceElements.clearButton.disabled).toBe(true);
    expect(aliceElements.clearButton.classList.contains('hidden')).toBe(true);
    expect(bobElements.rebetButton.disabled).toBe(true);
    expect(bobElements.clearButton.disabled).toBe(false);
  });

  it('anchors room action controls to the active Beat the House seat', () => {
    const base = new BeatTheHouseGame({ initialBankroll: 1000 }).snapshot();
    const snapshot: GameSnapshot = {
      ...base,
      bets: {
        ...base.bets,
        left: { ...base.bets.left, main: 25 },
        right: { ...base.bets.right, main: 40 },
      },
    };
    const room = createRoom(snapshot);
    const aliceElements = createElements();
    const bobElements = createElements();
    const localElements = createElements();

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, aliceId, 100);
    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, bobId, 100);
    new BeatControlsView(localElements).render(snapshot, true, () => undefined, true, undefined, undefined, 100);

    expect(aliceElements.actionDock.dataset.beatSeat).toBe('left');
    expect(aliceElements.actionDock.style.getPropertyValue('--beat-action-left')).toBe('351.5px');
    expect(bobElements.actionDock.dataset.beatSeat).toBe('right');
    expect(bobElements.actionDock.style.getPropertyValue('--beat-action-left')).toBe('607.5px');
    expect(localElements.actionDock.dataset.beatSeat).toBeUndefined();
    expect(localElements.actionDock.style.getPropertyValue('--beat-action-left')).toBe('');
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

    new BeatControlsView(bobElements).render(snapshot, true, () => undefined, true, room, bobId, 100);

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
        { connectionId: testConnectionId('a'), profileId: aliceId, profileName: 'Alice', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
        { connectionId: testConnectionId('c'), profileId: coryId, profileName: 'Cory', bankroll: 100, sessionStartBankroll: 100, role: 'player' },
      ],
      seats: [{ seatId: 'left', profileId: aliceId }, { seatId: 'right', profileId: coryId }, { seatId: 'centre' }],
      rebetSeatIds: ['left'],
    });
    const aliceElements = createElements();
    const coryElements = createElements();
    const missingEligibilityElements = createElements();

    new BeatControlsView(aliceElements).render(snapshot, true, () => undefined, true, room, aliceId, 100);
    new BeatControlsView(coryElements).render(snapshot, true, () => undefined, true, room, coryId, 100);
    new BeatControlsView(missingEligibilityElements).render(snapshot, true, () => undefined, true, { ...room, beat: undefined }, aliceId, 100);

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
