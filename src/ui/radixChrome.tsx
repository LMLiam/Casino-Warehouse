import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChipTooltips } from './ChipTooltips';
import { SetupDialogs } from './SetupDialogs';

export const mountRadixChrome = (): void => {
  const setupMount = document.querySelector<HTMLElement>('#setupRadixDialogs');
  if (setupMount) {
    flushSync(() => {
      createRoot(setupMount).render(<SetupDialogs />);
    });
  }

  const chipMount = document.querySelector<HTMLElement>('#chipRail');
  if (chipMount) {
    flushSync(() => {
      createRoot(chipMount).render(<ChipTooltips />);
    });
  }
};
