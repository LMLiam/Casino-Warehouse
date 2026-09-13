import { maxRoomSocialEvents } from '../../multiplayer/protocol/maxRoomSocialEvents';
import type { RoomReaction } from '../../multiplayer/protocol/RoomReaction';
import type { RoomSocialEvent } from '../../multiplayer/protocol/RoomSocialEvent';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { roomReactionSchema } from '../../schemas/casinoSchemas/roomReactionSchema';
import type { AppElements } from '../dom/appElements/AppElements';

export class RoomSocialView {
  private static readonly maxChatCodePoints = 280;
  private static readonly nearBottomThresholdPx = 24;
  private static readonly reactionDetails: Readonly<Record<RoomReaction, { readonly glyph: string; readonly label: string }>> = {
    nice: { glyph: '🔥', label: 'Nice' },
    cheer: { glyph: '👏', label: 'Applause' },
    laugh: { glyph: '😂', label: 'Laugh' },
    wow: { glyph: '😮', label: 'Wow' },
    ouch: { glyph: '😬', label: 'Ouch' },
    gg: { glyph: '🤝', label: 'Good game' },
  };

  private readonly timeFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  private currentRoomId: RoomId | undefined;
  private renderedEvents: readonly RoomSocialEvent[] = [];
  private unreadCount = 0;

  public constructor(
    private readonly elements: AppElements,
    private readonly sendChat: (text: string) => boolean,
    private readonly sendReaction: (reaction: RoomReaction) => void,
  ) {
    this.bindChatInputLength();
    this.bindChatForm();
    this.bindReactions();
    const clearUnreadWhenRoomMenuOpens = (): void => {
      if (this.isRoomMenuOpen()) {
        this.clearUnread();
        this.scrollToBottom();
      }
    };
    this.elements.roomMenu.addEventListener('toggle', clearUnreadWhenRoomMenuOpens);
    this.elements.hudOverflowMenu.addEventListener('toggle', clearUnreadWhenRoomMenuOpens);
  }

  public clear(): void {
    this.currentRoomId = undefined;
    this.renderedEvents = [];
    this.unreadCount = 0;
    this.elements.roomSocialFeed.replaceChildren();
    this.elements.roomChatInput.value = '';
    this.updateUnreadBadge();
  }

  public render(roomId: RoomId, events: readonly RoomSocialEvent[]): void {
    const nextEvents = events.slice(-maxRoomSocialEvents);
    const roomChanged = this.currentRoomId !== roomId;
    if (roomChanged) {
      this.currentRoomId = roomId;
      this.renderedEvents = [];
      this.unreadCount = 0;
      this.elements.roomChatInput.value = '';
    }
    if (!roomChanged && this.sameRenderedEvents(nextEvents)) {
      this.updateUnreadBadge();
      return;
    }
    const rows = nextEvents.map((event) => this.createEventRow(event));
    this.renderedEvents = nextEvents;
    this.elements.roomSocialFeed.replaceChildren(...rows);
    this.updateUnreadBadge();
    this.scrollToBottom();
  }

  public append(roomId: RoomId, event: RoomSocialEvent): void {
    if (this.currentRoomId !== roomId) {
      return;
    }
    const roomMenuOpen = this.isRoomMenuOpen();
    const shouldScroll = roomMenuOpen && this.isNearBottom();
    this.elements.roomSocialFeed.append(this.createEventRow(event));
    this.renderedEvents = [...this.renderedEvents, event].slice(-maxRoomSocialEvents);
    this.trimFeed();
    if (shouldScroll) {
      this.scrollToBottom();
    }
    if (!roomMenuOpen) {
      this.unreadCount += 1;
      this.updateUnreadBadge();
    }
  }

  private bindChatForm(): void {
    this.elements.roomChatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.elements.roomChatInput.value.trim();
      if (!text) {
        return;
      }
      if (this.sendChat(text)) {
        this.elements.roomChatInput.value = '';
      }
    });
  }

  private bindChatInputLength(): void {
    const input = this.elements.roomChatInput;
    input.addEventListener('beforeinput', (event) => {
      if (event.isComposing || !event.inputType.startsWith('insert') || event.data === null) {
        return;
      }
      event.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const nextValue = this.limitChatCodePoints(`${input.value.slice(0, start)}${event.data}${input.value.slice(end)}`);
      input.value = nextValue;
      const nextCaret = Math.min(start + event.data.length, nextValue.length);
      input.setSelectionRange(nextCaret, nextCaret);
    });
    input.addEventListener('input', () => {
      const limitedValue = this.limitChatCodePoints(input.value);
      if (limitedValue !== input.value) {
        input.value = limitedValue;
      }
    });
  }

  private limitChatCodePoints(text: string): string {
    return [...text].slice(0, RoomSocialView.maxChatCodePoints).join('');
  }

  private bindReactions(): void {
    this.elements.roomReactions.querySelectorAll<HTMLButtonElement>('[data-room-reaction]').forEach((button) => {
      const reaction = roomReactionSchema.safeParse(button.dataset.roomReaction ?? '');
      if (reaction.success) {
        button.addEventListener('click', () => this.sendReaction(reaction.data));
      }
    });
  }

  private createEventRow(event: RoomSocialEvent): HTMLElement {
    const row = document.createElement('article');
    row.className = `room-social-event room-social-event-${event.kind}`;

    const metadata = document.createElement('span');
    metadata.className = 'room-social-event-meta';
    metadata.textContent = `${this.timeFormatter.format(event.createdAt)} ${event.profileName}`;

    const content = document.createElement('span');
    content.className = 'room-social-event-content';
    content.textContent = event.kind === 'chat' ? event.text : this.reactionText(event.reaction);

    row.append(metadata, content);
    return row;
  }

  private reactionText(reaction: RoomReaction): string {
    const details = RoomSocialView.reactionDetails[reaction];
    return `reacted ${details.glyph} (${details.label})`;
  }

  private isRoomMenuOpen(): boolean {
    return this.elements.hudOverflowMenu.open && this.elements.roomMenu.open;
  }

  private sameRenderedEvents(events: readonly RoomSocialEvent[]): boolean {
    if (this.renderedEvents.length !== events.length) {
      return false;
    }
    return events.every((event, index) => {
      const renderedEvent = this.renderedEvents[index];
      if (!renderedEvent || renderedEvent.kind !== event.kind) {
        return false;
      }
      if (
        renderedEvent.profileId !== event.profileId ||
        renderedEvent.profileName !== event.profileName ||
        renderedEvent.role !== event.role ||
        renderedEvent.createdAt !== event.createdAt
      ) {
        return false;
      }
      return renderedEvent.kind === 'chat' && event.kind === 'chat'
        ? renderedEvent.text === event.text
        : renderedEvent.kind === 'reaction' && event.kind === 'reaction' && renderedEvent.reaction === event.reaction;
    });
  }

  private isNearBottom(): boolean {
    const feed = this.elements.roomSocialFeed;
    return feed.scrollHeight - feed.scrollTop - feed.clientHeight <= RoomSocialView.nearBottomThresholdPx;
  }

  private scrollToBottom(): void {
    this.elements.roomSocialFeed.scrollTop = this.elements.roomSocialFeed.scrollHeight;
  }

  private trimFeed(): void {
    while (this.elements.roomSocialFeed.childElementCount > maxRoomSocialEvents) {
      const firstRow = this.elements.roomSocialFeed.firstElementChild;
      if (!firstRow) {
        return;
      }
      this.elements.roomSocialFeed.removeChild(firstRow);
    }
  }

  private clearUnread(): void {
    if (this.unreadCount === 0) {
      return;
    }
    this.unreadCount = 0;
    this.updateUnreadBadge();
  }

  private updateUnreadBadge(): void {
    this.elements.roomSocialUnread.hidden = this.unreadCount === 0;
    this.elements.roomSocialUnread.textContent = String(this.unreadCount);
    this.elements.roomSocialUnread.setAttribute('aria-label', `Unread room activity: ${this.unreadCount}`);
  }
}
