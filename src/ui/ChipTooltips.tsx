import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import { beatTheHouseChipsUrl } from '../assets/tableAssets/beatTheHouseChipsUrl';
import { chipCrops } from './chips/chipCrops';
import { chipSheetSize } from './chips/chipSheetSize';

export const ChipTooltips = (): ReactElement => {
  const firstCrop = chipCrops[0];
  if (!firstCrop) {
    throw new Error('Chip crops are empty.');
  }
  const chipFaceSize = 72;
  const chipScale = chipFaceSize / firstCrop.size;
  const chipBackgroundSize = `${chipSheetSize.width * chipScale}px ${chipSheetSize.height * chipScale}px`;

  return (
    <Tooltip.Provider delayDuration={120}>
      {chipCrops.map((crop, index) => (
        <Tooltip.Root key={crop.value}>
          <Tooltip.Trigger asChild>
            <button className={`chip-button chip-${index}`} data-chip={crop.value} type="button" aria-label={`£${crop.value} chip`}>
              <span
                className="chip-face"
                style={{
                  backgroundImage: `url('${beatTheHouseChipsUrl}')`,
                  backgroundSize: chipBackgroundSize,
                  backgroundPosition: `${-crop.x * chipScale}px ${-crop.y * chipScale}px`,
                }}
              />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="casino-tooltip" sideOffset={8}>
              £{crop.value} chip
              <Tooltip.Arrow className="casino-tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ))}
    </Tooltip.Provider>
  );
};
