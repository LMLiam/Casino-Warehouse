import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { HandResult } from '../../game/types/HandResult';
import type { SideBetState } from '../../game/types/SideBetState';
import { COLORS } from './renderingConstants/COLORS';
import { MARKER_RENDERING } from './renderingConstants/MARKER_RENDERING';
import { TAG_RENDERING } from './renderingConstants/TAG_RENDERING';

export class TagRenderer {
  public constructor(private readonly layer: Container) {}

  public drawPayoutTag(text: string, x: number, y: number, state: 'win' | 'push' | 'lose', alpha = 1): void {
    const color = state === 'win' ? COLORS.win : state === 'lose' ? COLORS.lose : COLORS.push;
    const width = Math.max(TAG_RENDERING.minWidth, text.length * TAG_RENDERING.textWidthFactor);
    this.drawPill(text, x, y, width, color, alpha);
  }

  public drawSideState(state: SideBetState, x: number, y: number): void {
    const color = state === 'win' ? COLORS.win : COLORS.lose;
    this.drawPill(state.toUpperCase(), x, y, TAG_RENDERING.minWidth, color);
  }

  public drawMarker(text: string, x: number, y: number, result?: HandResult): void {
    if (!text) {
      return;
    }

    const color = result ? resultColor(result) : COLORS.gold;
    const width = Math.max(MARKER_RENDERING.minWidth, text.length * MARKER_RENDERING.textWidthFactor);
    const group = new Container();
    group.position.set(x, y);
    const backing = new Graphics()
      .roundRect(-width / 2, -MARKER_RENDERING.height / 2, width, MARKER_RENDERING.height, MARKER_RENDERING.radius)
      .fill({ color: COLORS.black, alpha: 0.82 })
      .stroke({ color, width: 2 });
    const label = new Text({
      text,
      style: new TextStyle({ fill: color, fontFamily: 'Arial', fontSize: MARKER_RENDERING.fontSize, fontWeight: 'bold' }),
    });
    label.anchor.set(0.5);
    group.addChild(backing, label);
    this.layer.addChild(group);
  }

  public drawResultPopup(title: string, subtitle: string, sideLines: readonly string[], x: number, y: number, result: HandResult, jackpot: boolean): void {
    const color = jackpot ? COLORS.jackpot : resultColor(result);
    const width = 260;
    const height = 92 + sideLines.length * 20;
    const group = new Container();
    group.position.set(x, y);

    const glow = new Graphics().roundRect(-width / 2 - 8, -height / 2 - 8, width + 16, height + 16, 22).fill({ color, alpha: jackpot ? 0.22 : 0.13 });
    const backing = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, 18)
      .fill({ color: COLORS.black, alpha: 0.88 })
      .stroke({ color, width: jackpot ? 5 : 3, alpha: 0.95 });
    const heading = new Text({
      text: title,
      style: new TextStyle({ fill: color, fontFamily: 'Arial', fontSize: jackpot ? 28 : 24, fontWeight: '900' }),
    });
    heading.anchor.set(0.5);
    heading.position.set(0, -height / 2 + 26);

    const detail = new Text({
      text: subtitle,
      style: new TextStyle({ fill: COLORS.white, fontFamily: 'Arial', fontSize: 15, fontWeight: 'bold' }),
    });
    detail.anchor.set(0.5);
    detail.position.set(0, -height / 2 + 53);

    group.addChild(glow, backing, heading, detail);
    sideLines.forEach((line, index) => {
      const label = new Text({
        text: line,
        style: new TextStyle({ fill: popupLineColor(line), fontFamily: 'Arial', fontSize: 13, fontWeight: 'bold' }),
      });
      label.anchor.set(0.5);
      label.position.set(0, -height / 2 + 77 + index * 20);
      group.addChild(label);
    });

    this.layer.addChild(group);
  }

  private drawPill(text: string, x: number, y: number, width: number, color: number, alpha = 1): void {
    const group = new Container();
    group.position.set(x, y);
    group.alpha = alpha;
    const backing = new Graphics()
      .roundRect(-width / 2, -TAG_RENDERING.height / 2, width, TAG_RENDERING.height, TAG_RENDERING.radius)
      .fill({ color: COLORS.black, alpha: 0.76 })
      .stroke({ color, width: 2 });
    const label = new Text({
      text,
      style: new TextStyle({ fill: color, fontFamily: 'Arial', fontSize: TAG_RENDERING.fontSize, fontWeight: 'bold' }),
    });
    label.anchor.set(0.5);
    group.addChild(backing, label);
    this.layer.addChild(group);
  }
}

const resultColor = (result: HandResult): number =>
  ({
    win: COLORS.win,
    lose: COLORS.lose,
    push: COLORS.push,
  })[result];

const popupLineColor = (line: string): number => {
  if (line.includes('WIN')) {
    return COLORS.win;
  }
  if (line.includes('PUSH') || line.includes('EVEN') || line.includes('NONE')) {
    return COLORS.push;
  }
  return COLORS.lose;
};
