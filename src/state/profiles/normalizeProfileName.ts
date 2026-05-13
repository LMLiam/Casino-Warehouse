export const normalizeProfileName = (name: string): string => name.trim().slice(0, 32) || 'Player';
