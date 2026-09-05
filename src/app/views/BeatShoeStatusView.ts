import { beatTheHouseRules } from '../../game/beatTheHouse/beatTheHouseRules';
import type { BeatTheHouseShoeSnapshot } from '../../game/beatTheHouse/shoe/BeatTheHouseShoeSnapshot';
import type { GameEvent } from '../../game/types/GameEvent';
import type { BeatShoeStatusViewElements } from './BeatShoeStatusViewElements';

export class BeatShoeStatusView {
  private static readonly cutPersistentMessage = 'Cut card reached - shuffle after round';
  private static readonly cutCueMessage = 'Cut card reached - shuffle after round';
  private static readonly shuffleCueMessage = 'Shoe shuffled - new shoe ready';

  private previousCutEventPresent = false;
  private previousShuffleEventPresent = false;

  public constructor(private readonly elements: BeatShoeStatusViewElements) {}

  public render(shoe: BeatTheHouseShoeSnapshot, events: readonly GameEvent[]): void {
    const { cardsDealt, cardsRemaining, totalCards, cutCardReached } = shoe;
    this.elements.beatShoeStatus.classList.toggle('hidden', false);
    this.elements.beatShoeLabel.textContent = `${beatTheHouseRules.deckCount}-deck shoe`;
    this.elements.beatShoeCounts.textContent = `Dealt ${cardsDealt} • Remaining ${cardsRemaining} of ${totalCards}`;
    this.elements.beatShoeMeter.max = totalCards;
    this.elements.beatShoeMeter.value = cardsRemaining;
    this.elements.beatShoeCut.textContent = cutCardReached ? BeatShoeStatusView.cutPersistentMessage : '';
    this.elements.beatShoeCut.classList.toggle('hidden', !cutCardReached);

    const hasCutEvent = events.some((event) => event.type === 'shoe-cut-reached');
    const hasShuffleEvent = events.some((event) => event.type === 'shoe-shuffled');
    const cutArrived = hasCutEvent && !this.previousCutEventPresent;
    const shuffleArrived = hasShuffleEvent && !this.previousShuffleEventPresent;
    if (cutArrived || shuffleArrived) {
      const parts: string[] = [];
      for (const event of events) {
        if (event.type === 'shoe-cut-reached' && cutArrived && !parts.includes(BeatShoeStatusView.cutCueMessage)) {
          parts.push(BeatShoeStatusView.cutCueMessage);
        }
        if (event.type === 'shoe-shuffled' && shuffleArrived && !parts.includes(BeatShoeStatusView.shuffleCueMessage)) {
          parts.push(BeatShoeStatusView.shuffleCueMessage);
        }
      }
      this.elements.beatShoeCue.textContent = parts.join(' • ');
    } else if (!hasCutEvent && !hasShuffleEvent) {
      this.elements.beatShoeCue.textContent = '';
    }
    this.previousCutEventPresent = hasCutEvent;
    this.previousShuffleEventPresent = hasShuffleEvent;
  }

  public hide(): void {
    this.elements.beatShoeStatus.classList.toggle('hidden', true);
  }
}
