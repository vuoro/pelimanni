import { Instrument } from "../Instrument.ts";
import { piano } from "../presets.ts";
import { AudioSystem } from "./AudioSystem.ts";
import { Magic } from "./magic.ts";

let sustainPedal = 0.0;
let vibrato = 0.0;

function onMIDIMessage(event: MIDIMessageEvent) {
  if (!event.data) return;

  const [command] = event.data;

  if (command === 248) return;

  switch (command) {
    case 144: {
      // Note
      const [, midiNumber, velocity] = event.data;
      if (velocity === 0) {
        tempInstrument.release(midiNumber, 1.0 + (1.0 - sustainPedal) * 6.0);
      } else {
        tempInstrument.attack(
          midiNumber,
          velocity / 127.0,
          undefined,
          undefined,
          undefined,
          undefined,
          vibrato * 200.0,
        );
      }
      break;
    }
    case 176: {
      // Control change
      const [, channel, value] = event.data;
      switch (channel) {
        case 64: {
          sustainPedal = value / 127.0;
          break;
        }
        case 1: {
          vibrato = value / 127.0;
          break;
        }
      }
      break;
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
tempInstrument.connect(AudioSystem.get().input);
