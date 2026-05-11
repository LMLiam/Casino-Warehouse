import { describe, expect, it, vi } from 'vitest';

const gsapMocks = vi.hoisted(() => ({
  fromTo: vi.fn(),
  to: vi.fn(),
}));

vi.mock('gsap', () => ({ gsap: gsapMocks }));

vi.mock('pixi.js', () => {
  class Point {
    public x = 0;
    public y = 0;

    public set(x: number, y = x): void {
      this.x = x;
      this.y = y;
    }
  }

  class Container {
    public readonly children: unknown[] = [];
    public readonly position = new Point();
    public readonly scale = new Point();
    public alpha = 1;
    public rotation = 0;

    public addChild(...children: unknown[]): void {
      this.children.push(...children);
    }
  }

  class Sprite extends Container {
    public readonly anchor = new Point();
    public width = 0;
    public height = 0;
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

  class Text extends Container {
    public readonly anchor = new Point();
  }

  class TextStyle {}
  class Texture {}

  return { Container, Graphics, Sprite, Text, TextStyle, Texture };
});

describe('ChipRenderer', () => {
  it('slides losing chips to the dealer bank and payouts from the dealer bank', async () => {
    const { Container, Texture } = await import('pixi.js');
    const { ChipRenderer } = await import('../../../src/ui/renderers/ChipRenderer');
    const layer = new Container();
    const textures = new Map([[5, new Texture()]]) as ConstructorParameters<typeof ChipRenderer>[1];
    const renderer = new ChipRenderer(layer, textures);
    const dealerBank = { x: 836, y: 82 };

    renderer.drawStack(10, 120, 320, 20, { key: 'loss-left-main-10', to: dealerBank });
    const losingStack = layer.children[0] as { readonly position: { readonly x: number; readonly y: number } };
    expect(losingStack.position).toMatchObject({ x: 120, y: 320 });
    expect(gsapMocks.to).toHaveBeenCalledWith(losingStack, expect.objectContaining({ x: dealerBank.x, y: dealerBank.y }));

    renderer.drawStack(10, 180, 320, 20, { key: 'payout-left-main-10', from: dealerBank });
    const payoutStack = layer.children[1] as { readonly position: { readonly x: number; readonly y: number } };
    expect(payoutStack.position).toMatchObject(dealerBank);
    expect(gsapMocks.to).toHaveBeenCalledWith(payoutStack, expect.objectContaining({ x: 180, y: 320 }));
  });
});
