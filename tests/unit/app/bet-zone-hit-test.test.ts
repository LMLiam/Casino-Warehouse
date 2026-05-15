import { describe, expect, it } from 'vitest';
import { hitTestBetZone } from '../../../src/app/input/betZoneHitTest';
import type { RectPercent } from '../../../src/ui/layout/RectPercent';
import { handLayouts } from '../../../src/ui/layout/handLayouts';
import { tableSize } from '../../../src/ui/layout/tableSize';

describe('Beat the House table hit testing', () => {
  it('matches updated main-bet and dealer-tip zones for all three seats', () => {
    const left = 10;
    const top = 20;
    const host = {
      getBoundingClientRect: () => ({
        left,
        top,
        width: tableSize.width,
        height: tableSize.height,
      }),
    } as HTMLElement;
    const centreOf = (zone: RectPercent) => ({
      clientX: left + (zone.x / 100) * tableSize.width,
      clientY: top + (zone.y / 100) * tableSize.height,
    });

    for (const hand of handLayouts) {
      expect(hitTestBetZone(host, centreOf(hand.zones.main).clientX, centreOf(hand.zones.main).clientY)).toEqual({
        handId: hand.id,
        betType: 'main',
      });
      expect(hitTestBetZone(host, centreOf(hand.tipZone).clientX, centreOf(hand.tipZone).clientY)).toEqual({
        handId: hand.id,
        dealerTip: true,
      });
    }
  });
});
