import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Card } from '../../game/cards/Card';
import { cardLabel } from '../../game/cards/cardLabel';
import { isRed } from '../../game/cards/isRed';
import { CARD_ANIMATION } from './renderingConstants/CARD_ANIMATION';
import { CARD_SIZE } from './renderingConstants/CARD_SIZE';
import { COLORS } from './renderingConstants/COLORS';

export class CardRenderer {
  private readonly animatedCards = new Set<string>();
  private readonly activeAnimations = new Set<string>();
  private readonly cards = new Map<string, Container>();
  private readonly renderedKeys = new Set<string>();

  public constructor(private readonly layer: Container) {}

  public clearAnimations(): void {
    this.animatedCards.clear();
    this.activeAnimations.clear();
    this.cards.forEach((card) => {
      gsap.killTweensOf(card);
      gsap.killTweensOf(card.scale);
      card.destroy({ children: true });
    });
    this.cards.clear();
  }

  public beginFrame(): void {
    this.renderedKeys.clear();
  }

  public endFrame(): void {
    this.cards.forEach((card, key) => {
      if (!this.renderedKeys.has(key)) {
        gsap.killTweensOf(card);
        gsap.killTweensOf(card.scale);
        card.destroy({ children: true });
        this.cards.delete(key);
        this.activeAnimations.delete(key);
      }
    });
  }

  public drawCard(card: Card, x: number, y: number, isWinner: boolean, animationKey: string | undefined, animationOrder: number | undefined): void {
    const key = animationKey ?? `card-${x}-${y}-${card.rank}-${card.suit}`;
    const container = this.drawCardFace(key, card, isWinner);
    this.animateIfNeeded(container, animationKey, animationOrder, x, y);
  }

  public drawRevealedCard(
    card: Card,
    x: number,
    y: number,
    isWinner: boolean,
    renderKey: string,
    animationKey: string | undefined,
    animationOrder: number | undefined,
  ): void {
    const hadRenderedCard = this.cards.has(renderKey);
    const container = this.drawCardFace(renderKey, card, isWinner);
    if (hadRenderedCard) {
      this.animateFlipIfNeeded(container, animationKey, animationOrder, x, y);
      return;
    }
    this.animateIfNeeded(container, animationKey, animationOrder, x, y);
  }

  public drawBack(x: number, y: number, animationKey: string | undefined, animationOrder: number | undefined): void {
    const key = animationKey ?? `back-${x}-${y}`;
    const back = this.getCardContainer(key);
    back.removeChildren();
    const face = new Graphics()
      .roundRect(-CARD_SIZE.width / 2, -CARD_SIZE.height / 2, CARD_SIZE.width, CARD_SIZE.height, CARD_SIZE.radius)
      .fill({ color: COLORS.cardBack })
      .stroke({ color: COLORS.gold, width: 4 });
    back.addChild(face);
    this.renderedKeys.add(key);
    this.animateIfNeeded(back, animationKey, animationOrder, x, y);
  }

  private getCardContainer(key: string): Container {
    const existing = this.cards.get(key);
    if (existing) {
      return existing;
    }

    const container = new Container();
    this.cards.set(key, container);
    this.layer.addChild(container);
    return container;
  }

  private drawCardFace(key: string, card: Card, isWinner: boolean): Container {
    const container = this.getCardContainer(key);
    container.removeChildren();

    const face = new Graphics()
      .roundRect(-CARD_SIZE.width / 2, -CARD_SIZE.height / 2, CARD_SIZE.width, CARD_SIZE.height, CARD_SIZE.radius)
      .fill({ color: COLORS.cardFace })
      .stroke({ color: isWinner ? COLORS.gold : COLORS.cardBorder, width: isWinner ? 4 : 2 });

    const label = new Text({
      text: cardLabel(card),
      style: new TextStyle({
        fill: isRed(card) ? COLORS.cardRed : COLORS.cardText,
        fontFamily: 'Arial',
        fontSize: CARD_SIZE.labelSize,
        fontWeight: 'bold',
      }),
    });
    label.position.set(CARD_SIZE.labelX, CARD_SIZE.labelY);
    container.addChild(face, label);
    this.renderedKeys.add(key);
    return container;
  }

  private animateIfNeeded(
    displayObject: Container,
    animationKey: string | undefined,
    animationOrder: number | undefined,
    targetX: number,
    targetY: number,
  ): void {
    if (!animationKey || animationOrder === undefined || this.animatedCards.has(animationKey)) {
      if (!animationKey || !this.activeAnimations.has(animationKey)) {
        displayObject.position.set(targetX, targetY);
        displayObject.alpha = 1;
        displayObject.rotation = 0;
        displayObject.scale.set(1);
      }
      return;
    }

    this.animatedCards.add(animationKey);

    if (prefersReducedMotion()) {
      displayObject.position.set(targetX, targetY);
      displayObject.alpha = 1;
      displayObject.rotation = 0;
      displayObject.scale.set(1);
      return;
    }

    this.activeAnimations.add(animationKey);
    displayObject.position.set(CARD_ANIMATION.shoeX, CARD_ANIMATION.shoeY);
    displayObject.alpha = CARD_ANIMATION.startAlpha;
    displayObject.scale.set(CARD_ANIMATION.startScale);
    displayObject.rotation = CARD_ANIMATION.startRotation;

    gsap.to(displayObject, {
      x: targetX,
      y: targetY,
      alpha: 1,
      rotation: 0,
      duration: CARD_ANIMATION.duration,
      delay: animationOrder * CARD_ANIMATION.delayStep,
      ease: 'power2.out',
      onComplete: () => {
        displayObject.position.set(targetX, targetY);
        displayObject.alpha = 1;
        displayObject.rotation = 0;
        this.activeAnimations.delete(animationKey);
      },
    });
    gsap.to(displayObject.scale, {
      x: 1,
      y: 1,
      duration: CARD_ANIMATION.duration,
      delay: animationOrder * CARD_ANIMATION.delayStep,
      ease: 'back.out(1.35)',
    });
  }

  private animateFlipIfNeeded(
    displayObject: Container,
    animationKey: string | undefined,
    animationOrder: number | undefined,
    targetX: number,
    targetY: number,
  ): void {
    if (!animationKey || animationOrder === undefined || this.animatedCards.has(animationKey)) {
      if (!animationKey || !this.activeAnimations.has(animationKey)) {
        displayObject.position.set(targetX, targetY);
        displayObject.alpha = 1;
        displayObject.rotation = 0;
        displayObject.scale.set(1);
      }
      return;
    }

    this.animatedCards.add(animationKey);

    if (prefersReducedMotion()) {
      displayObject.position.set(targetX, targetY);
      displayObject.alpha = 1;
      displayObject.rotation = 0;
      displayObject.scale.set(1);
      return;
    }

    this.activeAnimations.add(animationKey);
    displayObject.position.set(targetX, targetY);
    displayObject.alpha = 1;
    displayObject.rotation = 0;
    displayObject.scale.set(0.08, 1);

    gsap.to(displayObject.scale, {
      x: 1,
      duration: CARD_ANIMATION.duration * 0.65,
      delay: animationOrder * CARD_ANIMATION.delayStep,
      ease: 'power2.out',
      onComplete: () => {
        displayObject.position.set(targetX, targetY);
        displayObject.alpha = 1;
        displayObject.rotation = 0;
        displayObject.scale.set(1);
        this.activeAnimations.delete(animationKey);
      },
    });
  }
}

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
