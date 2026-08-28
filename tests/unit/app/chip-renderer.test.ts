import { afterEach, describe, expect, it, vi } from 'vitest';

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
    public readonly children: Container[] = [];
    public readonly position = new Point();
    public readonly scale = new Point();
    public alpha = 1;
    public rotation = 0;

    public addChild(...children: Container[]): void {
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
    public readonly text: string;

    public constructor(options: { readonly text?: string } = {}) {
      super();
      this.text = options.text ?? '';
    }
  }

  class TextStyle {}
  class Texture {}

  return { Container, Graphics, Sprite, Text, TextStyle, Texture };
});

describe('ChipRenderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    gsapMocks.fromTo.mockClear();
    gsapMocks.to.mockClear();
  });

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

  it('draws capped chip stacks with an amount tag and only animates a keyed stack once', async () => {
    const { Container, Graphics, Text, Texture } = await import('pixi.js');
    const { ChipRenderer } = await import('../../../src/ui/renderers/ChipRenderer');
    const layer = new Container();
    const texture = new Texture();
    const textures = new Map([
      [10000, texture],
      [5000, texture],
      [1000, texture],
      [500, texture],
      [100, texture],
      [25, texture],
      [5, texture],
      [1, texture],
    ]) as ConstructorParameters<typeof ChipRenderer>[1];
    const renderer = new ChipRenderer(layer, textures);

    renderer.drawStack(99999, 120, 320, 20, 'chip-pop');
    renderer.drawStack(99999, 140, 320, 20, 'chip-pop');

    const firstStack = layer.children[0] as { readonly children: InstanceType<typeof Container>[] };
    const amountTag = firstStack.children.at(-1) as { readonly children: InstanceType<typeof Container>[] };

    expect(firstStack.children).toHaveLength(11);
    expect(amountTag.children[0]).toBeInstanceOf(Graphics);
    expect(amountTag.children[1]).toBeInstanceOf(Text);
    expect(amountTag.children[1]).toMatchObject({ text: '£99,999' });
    expect(gsapMocks.fromTo).toHaveBeenCalledOnce();
  });

  it('skips motion when the user prefers reduced motion and can replay after clearing animation keys', async () => {
    const { Container, Texture } = await import('pixi.js');
    const { ChipRenderer } = await import('../../../src/ui/renderers/ChipRenderer');
    vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: true })) });
    const layer = new Container();
    const textures = new Map([[5, new Texture()]]) as ConstructorParameters<typeof ChipRenderer>[1];
    const renderer = new ChipRenderer(layer, textures);

    renderer.drawStack(5, 120, 320, 20, 'reduced');
    expect(gsapMocks.fromTo).not.toHaveBeenCalled();

    vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) });
    renderer.drawStack(5, 120, 320, 20, 'reduced');
    expect(gsapMocks.fromTo).toHaveBeenCalledOnce();

    renderer.clearAnimations();
    renderer.drawStack(5, 120, 320, 20, 'reduced');
    expect(gsapMocks.fromTo).toHaveBeenCalledTimes(2);
  });

  it('still renders amount labels when chip textures are unavailable', async () => {
    const { Container, Text } = await import('pixi.js');
    const { ChipRenderer } = await import('../../../src/ui/renderers/ChipRenderer');
    const layer = new Container();
    const renderer = new ChipRenderer(layer, new Map() as ConstructorParameters<typeof ChipRenderer>[1]);

    renderer.drawStack(99999, 120, 320);

    const stack = layer.children[0] as { readonly children: InstanceType<typeof Container>[] };
    const amountTag = stack.children[0] as { readonly children: InstanceType<typeof Container>[] };
    expect(stack.children).toHaveLength(1);
    expect(amountTag.children[1]).toBeInstanceOf(Text);
    expect(amountTag.children[1]).toMatchObject({ text: '£99,999' });
  });
});
