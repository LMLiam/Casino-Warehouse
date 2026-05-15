import type { BetType } from '../../game/types/BetType';
import type { HandId } from '../../game/types/HandId';
import { handLayouts } from '../../ui/layout/handLayouts';
import { tableSize } from '../../ui/layout/tableSize';

export const hitTestBetZone = (
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { readonly handId: HandId; readonly betType: BetType } | { readonly handId: HandId; readonly dealerTip: true } | undefined => {
  const contains = (
    zone: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    xPercent: number,
    yPercent: number,
  ): boolean => {
    const left = zone.x - zone.width / 2;
    const right = zone.x + zone.width / 2;
    const top = zone.y - zone.height / 2;
    const bottom = zone.y + zone.height / 2;
    return xPercent >= left && xPercent <= right && yPercent >= top && yPercent <= bottom;
  };

  const rect = host.getBoundingClientRect();
  const scale = Math.min(rect.width / tableSize.width, rect.height / tableSize.height);
  const renderedWidth = tableSize.width * scale;
  const renderedHeight = tableSize.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const xPercent = ((clientX - rect.left - offsetX) / renderedWidth) * 100;
  const yPercent = ((clientY - rect.top - offsetY) / renderedHeight) * 100;

  for (const hand of handLayouts) {
    if (contains(hand.tipZone, xPercent, yPercent)) {
      return { handId: hand.id, dealerTip: true };
    }
    for (const [betType, zone] of Object.entries(hand.zones) as [BetType, (typeof hand.zones)[BetType]][]) {
      if (contains(zone, xPercent, yPercent)) {
        return { handId: hand.id, betType };
      }
    }
  }

  return undefined;
};
