/**
 * Type-safe DOM element selector with required element validation.
 * Throws if element is not found.
 */
export const selectElement = <T extends Element = Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
};
