/**
 * Selects all elements that match a selector.
 *
 * @param selector CSS selector for the required elements.
 * @returns Matching elements, or an empty array when no elements match.
 */
export const selectElements = <T extends Element = Element>(selector: string): T[] => {
  return [...document.querySelectorAll<T>(selector)];
};
