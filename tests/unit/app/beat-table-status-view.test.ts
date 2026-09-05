import { describe, expect, it } from 'vitest';
import { BeatTableStatusView } from '../../../src/app/views/BeatTableStatusView';

const createStatus = (): HTMLElement => {
  const tokens = new Set<string>(['hidden']);
  const classList = {
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
  } as DOMTokenList;
  const value: Partial<HTMLElement> = { textContent: '', classList };
  return value as HTMLElement;
};

describe('BeatTableStatusView', () => {
  it('shows a rejection message as visible text', () => {
    const status = createStatus();
    const view = new BeatTableStatusView(status);

    view.show('Side bets cannot exceed the main bet on the same hand.');

    expect(status.textContent).toBe('Side bets cannot exceed the main bet on the same hand.');
    expect(status.classList.contains('hidden')).toBe(false);
  });

  it('hides an empty message and clears stale feedback', () => {
    const status = createStatus();
    const view = new BeatTableStatusView(status);

    view.show('Side bets cannot exceed the main bet on the same hand.');
    view.clear();

    expect(status.textContent).toBe('');
    expect(status.classList.contains('hidden')).toBe(true);
  });

  it('keeps the message while the table stays visible and hides it when the table leaves', () => {
    const status = createStatus();
    const view = new BeatTableStatusView(status);

    view.show('Side bets cannot exceed the main bet on the same hand.');
    view.setVisible(true);
    expect(status.classList.contains('hidden')).toBe(false);

    view.setVisible(false);
    expect(status.classList.contains('hidden')).toBe(true);
    expect(status.textContent).toBe('Side bets cannot exceed the main bet on the same hand.');

    view.setVisible(true);
    expect(status.classList.contains('hidden')).toBe(false);
  });
});
