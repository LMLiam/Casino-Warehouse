export const cleanName = (name?: string): string => (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);
