import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { HandResult } from '../../game/types/HandResult';
import type { SideBetState } from '../../game/types/SideBetState';
import { COLORS } from './renderingConstants/COLORS';
import { MARKER_RENDERING } from './renderingConstants/MARKER_RENDERING';
import { TAG_RENDERING } from './renderingConstants/TAG_RENDERING';

export class TagRenderer {
  private static readonly resultPopupWidth = 260;
  private static readonly resultPopupBaseHeight = 92;
  private static readonly resultPopupSideLineHeight = 20;
  private static readonly resultPopupGlowPadding = 8;
  private static readonly resultPopupGlowRadius = 22;
  private static readonly resultPopupBackingRadius = 18;
  private static readonly jackpotStrokeWidth = 5;
  private static readonly standardStrokeWidth = 3;
  private static readonly jackpotHeadingFontSize = 28;
  private static readonly standardHeadingFontSize = 24;
  private static readonly headingOffsetY = 26;
  private static readonly detailFontSize = 15;
  private static readonly detailOffsetY = 53;
  private static readonly sideLineFontSize = 13;
  private static readonly sideLineStartOffsetY = 77;

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

    const color = result ? TagRenderer.resultColor(result) : COLORS.gold;
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
    const color = jackpot ? COLORS.jackpot : TagRenderer.resultColor(result);
    const width = TagRenderer.resultPopupWidth;
    const height = TagRenderer.resultPopupBaseHeight + sideLines.length * TagRenderer.resultPopupSideLineHeight;
    const group = new Container();
    group.position.set(x, y);

    const glow = new Graphics()
      .roundRect(
        -width / 2 - TagRenderer.resultPopupGlowPadding,
        -height / 2 - TagRenderer.resultPopupGlowPadding,
        width + TagRenderer.resultPopupGlowPadding * 2,
        height + TagRenderer.resultPopupGlowPadding * 2,
        TagRenderer.resultPopupGlowRadius,
      )
      .fill({ color, alpha: jackpot ? 0.22 : 0.13 });
    const backing = new Graphics()
      .roundRect(-width / 2, -height / 2, width, height, TagRenderer.resultPopupBackingRadius)
      .fill({ color: COLORS.black, alpha: 0.88 })
      .stroke({ color, width: jackpot ? TagRenderer.jackpotStrokeWidth : TagRenderer.standardStrokeWidth, alpha: 0.95 });
    const heading = new Text({
      text: title,
      style: new TextStyle({
        fill: color,
        fontFamily: 'Arial',
        fontSize: jackpot ? TagRenderer.jackpotHeadingFontSize : TagRenderer.standardHeadingFontSize,
        fontWeight: '900',
      }),
    });
    heading.anchor.set(0.5);
    heading.position.set(0, -height / 2 + TagRenderer.headingOffsetY);

    const detail = new Text({
      text: subtitle,
      style: new TextStyle({ fill: COLORS.white, fontFamily: 'Arial', fontSize: TagRenderer.detailFontSize, fontWeight: 'bold' }),
    });
    detail.anchor.set(0.5);
    detail.position.set(0, -height / 2 + TagRenderer.detailOffsetY);

    group.addChild(glow, backing, heading, detail);
    sideLines.forEach((line, index) => {
      const label = new Text({
        text: line,
        style: new TextStyle({ fill: TagRenderer.popupLineColor(line), fontFamily: 'Arial', fontSize: TagRenderer.sideLineFontSize, fontWeight: 'bold' }),
      });
      label.anchor.set(0.5);
      label.position.set(0, -height / 2 + TagRenderer.sideLineStartOffsetY + index * TagRenderer.resultPopupSideLineHeight);
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

  private static resultColor(result: HandResult): number {
    return {
      win: COLORS.win,
      lose: COLORS.lose,
      push: COLORS.push,
    }[result];
  }

  private static popupLineColor(line: string): number {
    if (line.includes('WIN')) {
      return COLORS.win;
    }
    if (line.includes('PUSH') || line.includes('EVEN') || line.includes('NONE')) {
      return COLORS.push;
    }
    return COLORS.lose;
  }
}
