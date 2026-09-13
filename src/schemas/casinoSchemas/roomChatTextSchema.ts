import { z } from 'zod';

export const roomChatTextSchema = (() => {
  const maxRoomChatTextCodePoints = 280;
  return z
    .string()
    .trim()
    .min(1, 'Chat text is required.')
    .refine((value) => Array.from(value).length <= maxRoomChatTextCodePoints, 'Chat text must not exceed 280 Unicode code points.');
})();
