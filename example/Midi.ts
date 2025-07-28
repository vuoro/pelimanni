import { attackWithController, releaseWithController } from "./Keyboard.ts";
import { Magic } from "./magic.ts";

function onMIDIMessage(event: MIDIMessageEvent) {
  if (!event.data) return;

  const [command, midiNumber, velocity] = event.data;

  switch (command) {
    case 144: {
      if (velocity === 0) {
        releaseWithController(`midi-${midiNumber}`, false);
      } else {
        attackWithController(`midi-${midiNumber}`, midiNumber, velocity / 128);
      }
    }
  }
}

export const Midi = new Magic(
  (
    state: { enabled: boolean; midiAccess: null | MIDIAccess } = { enabled: false, midiAccess: null },
    message?: true | false,
  ) => {
    if (message !== undefined && state.enabled !== message) {
      if (message === true) {
        navigator.requestMIDIAccess?.().then(
          (midiAccess) => {
            state.midiAccess = midiAccess;
            state.enabled = true;

            for (const [key, input] of midiAccess.inputs) {
              input.addEventListener("midimessage", onMIDIMessage);
            }
          },
          (msg) => console.error(`Failed to get MIDI access - ${msg}`),
        );
      } else if (message === false && state.midiAccess) {
        state.enabled = false;

        for (const [, input] of state.midiAccess.inputs) {
          input.removeEventListener("midimessage", onMIDIMessage);
        }
      }
    }

    return state;
  },
);
