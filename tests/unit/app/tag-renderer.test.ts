import { describe, expect, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class Point {
    public x = 0;
    public y = 0;

    public set(x: number, y?: number): void {
      this.x = x;
      this.y = y ?? x;
    }
  }

  class Container {
    public readonly children: Container[] = [];
    public readonly position = new Point();

    public addChild(...children: Container[]): void {
      this.children.push(...children);
    }
  }

  class Graphics extends Container {
    public roundRect(): this {
      return this;
    }

    public fill(): this {
      return this;
    }

    public stroke(): this {
      return this;
    }
  }

  class TextStyle {
    public readonly fill?: number | undefined;

    public constructor(options: { readonly fill?: number | undefined } = {}) {
      this.fill = options.fill;
    }
  }

  class Text extends Container {
    public readonly anchor = new Point();
    public readonly style: TextStyle;
    public readonly text: string;

    public constructor(options: { readonly style?: TextStyle; readonly text?: string } = {}) {
      super();
      this.style = options.style ?? new TextStyle();
      this.text = options.text ?? '';
    }
  }

  return { Container, Graphics, Text, TextStyle };
});

describe('TagRenderer', () => {
  it("colors Dealer's Thanks settlement detail lines as rewards while keeping repayments red", async () => {
    const { Container, Text } = await import('pixi.js');
    const { COLORS } = await import('../../../src/ui/renderers/renderingConstants/COLORS');
    const { TagRenderer } = await import('../../../src/ui/renderers/TagRenderer');
    const layer = new Container();
    const renderer = new TagRenderer(layer);

    renderer.drawResultPopup(
      'Main LOSE -£10',
      'Side bets NONE +£0',
      ['Gameplay LOSE -£10', 'House Advance payment -£2', "Dealer's Thanks +£2", 'Net LOSE -£10'],
      120,
      160,
      'lose',
      false,
    );

    const group = layer.children[0] as { readonly children: readonly InstanceType<typeof Container>[] };
    const labels = group.children.filter((child) => child instanceof Text);

    expect(labels.find((label) => label.text === "Dealer's Thanks +£2")?.style.fill).toBe(COLORS.win);
    expect(labels.find((label) => label.text === 'House Advance payment -£2')?.style.fill).toBe(COLORS.lose);
    expect(labels.find((label) => label.text === 'Gameplay LOSE -£10')?.style.fill).toBe(COLORS.lose);
    expect(labels.find((label) => label.text === 'Side bets NONE +£0')?.style.fill).toBe(COLORS.white);
  });
});
