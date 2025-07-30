import InstrumentWorklet from "../InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "../notes.js";
import { AudioSystem } from "./AudioSystem.ts";
import { releaseWithController } from "./Keyboard.ts";
import { Magic } from "./magic.ts";

function onMIDIMessage(event: MIDIMessageEvent) {
  if (!event.data) return;

  const [command, midiNumber, velocity] = event.data;

  switch (command) {
    case 144: {
      if (velocity === 0) {
        releaseWithController(`midi-${midiNumber}`, false);
        postMessageToInstrument(1, midiNumber, velocity / 127.0, 0.0);
      } else {
        postMessageToInstrument(0, midiNumber, velocity / 127.0, 0.382);
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

let postMessageToInstrument: (type: 0 | 1 | 2, note: number, velocity?: number, sustain?: number) => void;

const { audioContext, output } = AudioSystem.get();

audioContext.audioWorklet
  .addModule(InstrumentWorklet)
  .then(() => {
    const notes = [];
    const frequencies = [];
    const partials = [];

    const notesStartAt = 21;
    const notesEndAt = 108;

    for (let index = 21; index <= notesEndAt; index++) {
      notes.push(index);
    }

    console.log(notes);

    const inharmonicity = 0.005;
    const inharmonicityRoot = 440.0;

    for (let index = notesStartAt * 10; index < 150 * 10; index++) {
      let frequency = midiToFrequency10(index);
      frequency = frequency * (1.0 + inharmonicity * Math.log2(frequency / inharmonicityRoot));
      if (frequency > audioContext.sampleRate / 2.0) break;
      frequencies.push(frequency);
    }

    // const partialRatios = [0.25, 0.5, 1.2, 1.5, 2.0, 3.0, 4.0, 5.4, 6.75, 8, 16, 32];
    // const partialAmplitudes = [0.382, 0.618, 0.382, 0.146, 1.0, 0.382, 0.618, 0.382, 0.236, 0.382, 0.236, 0.146];

    const partialRatios = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const partialAmplitudes = [
      1.0,
      0.618,
      0.382,
      0.618, // 4
      0.382,
      0.09,
      0.236, // 7
      0.146,
      0.09,
      0.056,
      0.034,
      0.021,
      0.013,
      0.008,
      0.005,
      0.003,
    ];

    // const partialRatios = [1, 2];
    // const partialAmplitudes = [1.0, 0.618];

    for (let index = 0; index < partialRatios.length; index++) {
      partials.push(frequencyToMidi10(440 * partialRatios[index]) - frequencyToMidi10(440));
    }

    // for (let index = 0; index < notes.length; index++) {
    //   console.log(partials.map((offset) => frequencies[offset + index * 10]));
    // }

    const cello = new AudioWorkletNode(audioContext, "Instrument", {
      processorOptions: {
        notesStartAt,
        notePartialOffsets: Uint16Array.from(partials),
        notePartialAttacks: Float64Array.from(partialAmplitudes),

        noteDecays: Float64Array.from(notes).map(
          (note) => (0.146 * Math.exp(-0.002 * midiToFrequency(note))) ** (1.0 / audioContext.sampleRate),
        ),
        partialDecays: Float64Array.from(frequencies).map(
          (frequency) => (0.618 * Math.exp(-0.002 * frequency)) ** (1.0 / audioContext.sampleRate),
        ),

        partialAttacks: Float64Array.from(frequencies).map(
          (frequency) => (Math.log2(frequency) / 10.0) * (1.0 / audioContext.sampleRate),
        ),
        partialFrequencies: Float64Array.from(frequencies),
      },
    });
    cello.port.start();
    cello.connect(output);

    postMessageToInstrument = (type: 0 | 1 | 2, note: number, velocity = 1.0, sustain = 0.0) => {
      cello.port.postMessage(Float32Array.of(type, note, velocity, sustain));
    };
  })
  .catch(console.error);
