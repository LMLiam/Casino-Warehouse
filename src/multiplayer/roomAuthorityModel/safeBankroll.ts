export const safeBankroll = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
