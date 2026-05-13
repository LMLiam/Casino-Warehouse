import * as Dialog from '@radix-ui/react-dialog';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export const SetupDialogs = (): ReactElement => {
  const [audioOpen, setAudioOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setAudioOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="radix-action-row">
      <Dialog.Root modal={audioOpen} open={audioOpen} onOpenChange={setAudioOpen}>
        <Dialog.Trigger className="casino-button" type="button">
          Audio
        </Dialog.Trigger>
        <Dialog.Overlay className="casino-dialog-overlay" />
        <Dialog.Content
          forceMount
          className="casino-dialog-content casino-scroll-surface"
          aria-describedby="audioDialogDescription"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setAudioOpen(false);
            }
          }}
        >
          <Dialog.Title className="casino-dialog-title">Audio</Dialog.Title>
          <Dialog.Description id="audioDialogDescription" className="casino-dialog-description">
            Tune the fictional casino audio mix.
          </Dialog.Description>
          <ScrollArea.Root className="casino-scroll-area">
            <ScrollArea.Viewport className="casino-scroll-viewport">
              <div className="settings-panel">
                <label className="toggle-row">
                  <input id="muteToggle" type="checkbox" /> Mute
                </label>
                <label>
                  Master <input id="masterVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Music <input id="musicVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Effects <input id="effectsVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Dealing <input id="dealingVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Chips <input id="chipsVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Slots <input id="slotsVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Wins <input id="winsVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Bonus <input id="bonusVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  UI <input id="uiVolume" type="range" min="0" max="1" step="0.05" />
                </label>
                <label>
                  Ambience <input id="ambienceVolume" type="range" min="0" max="1" step="0.05" />
                </label>
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="casino-scrollbar" orientation="vertical">
              <ScrollArea.Thumb className="casino-scroll-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
          <Dialog.Close className="casino-dialog-close" type="button" aria-label="Close audio dialog">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
};
