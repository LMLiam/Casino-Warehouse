export const money = (value: number): string => `£${Math.round(value).toLocaleString('en-GB')}`;
