import type { BetType, HandId } from '../../game/types';
import { handLayouts, tableSize } from '../../ui/layout';

export const hitTestBetZone = (host: HTMLElement, clientX: number, clientY: number): { readonly handId: HandId; readonly betType: BetType } | undefined => {
  const rect = host.getBoundingClientRect();
  const scale = Math.min(rect.width / tableSize.width, rect.height / tableSize.height);
  const renderedWidth = tableSize.width * scale;
  const renderedHeight = tableSize.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const xPercent = ((clientX - rect.left - offsetX) / renderedWidth) * 100;
  const yPercent = ((clientY - rect.top - offsetY) / renderedHeight) * 100;

  for (const hand of handLayouts) {
    for (const [betType, zone] of Object.entries(hand.zones) as [BetType, (typeof hand.zones)[BetType]][]) {
      const left = zone.x - zone.width / 2;
      const right = zone.x + zone.width / 2;
      const top = zone.y - zone.height / 2;
      const bottom = zone.y + zone.height / 2;
      if (xPercent >= left && xPercent <= right && yPercent >= top && yPercent <= bottom) {
        return { handId: hand.id, betType };
      }
    }
  }

  return undefined;
};
