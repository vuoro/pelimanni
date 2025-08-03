import { Instrument } from "../Instrument.ts";
import { piano } from "../presets.ts";
import { AudioSystem } from "./AudioSystem.ts";
import { Magic } from "./magic.ts";

function onMIDIMessage(event: MIDIMessageEvent) {
  if (!event.data) return;

  const [command, midiNumber, velocity] = event.data;

  if (command === 248) return;

  // console.log(event.data);

  switch (command) {
    case 144: {
      if (velocity === 0) {
        tempInstrument.release(midiNumber);
      } else {
        tempInstrument.attack(midiNumber, velocity / 127.0, undefined, 1.0);
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
            console.log(midiAccess);

            for (const [, input] of midiAccess.inputs) {
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

const tempInstrument = new Instrument(AudioSystem.get().audioContext, piano);
tempInstrument.connect(AudioSystem.get().output);
