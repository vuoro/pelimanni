import InstrumentWorklet from "../InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "../notes.js";
import { AudioSystem } from "./AudioSystem.ts";
import { releaseWithController } from "./Keyboard.ts";
import { Magic } from "./magic.ts";

function onMIDIMessage(event: MIDIMessageEvent) {
  if (!event.data) return;

  const [command, midiNumber, velocity] = event.data;

  if (command === 248) return;

  // console.log(event.data);

  switch (command) {
    case 144: {
      if (velocity === 0) {
        releaseWithController(`midi-${midiNumber}`, false);
        tempInstrument.release(midiNumber);
      } else {
        tempInstrument.attack(midiNumber, velocity / 127.0, 0.382);
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

class Instrument {
  node: Promise<AudioWorkletNode>;

  constructor(
    audioContext: AudioContext,
    { partials, notes = createNotes(), frequencies = createFrequencies(audioContext) }: InstrumentPreset,
  ) {
    const notesStartAt = notes[0];
    const notePartialOffsets = new Int16Array(partials.length);
    const notePartialForces = new Float64Array(partials.length);

    for (const [index, [partialRatio, amplitude]] of partials.entries()) {
      notePartialOffsets[index] = frequencyToMidi10(440 * partialRatio) - frequencyToMidi10(440);
      notePartialForces[index] = amplitude;
    }

    const processorOptions = {
      notesStartAt,
      notePartialOffsets,
      notePartialForces,

      noteDecays: Float64Array.from(notes).map(
        (note) => (0.5 * Math.exp(-0.002 * midiToFrequency(note))) ** (1.0 / audioContext.sampleRate),
      ),
      partialDecays: Float64Array.from(frequencies).map(
        (frequency) => (0.618 * Math.exp(-0.002 * frequency)) ** (1.0 / audioContext.sampleRate),
      ),

      partialAttacks: Float64Array.from(frequencies).map(
        (frequency) => (Math.log2(frequency) / 10.0) * (1.0 / audioContext.sampleRate),
      ),
      partialFrequencies: Float64Array.from(frequencies),
    };

    this.node = audioContext.audioWorklet.addModule(InstrumentWorklet).then(() => {
      const node = new AudioWorkletNode(audioContext, "Instrument", {
        processorOptions,
      });
      node.port.start();

      return node;
    });
  }

  async attack(note: number, velocity = 1.0, sustain = 1.0) {
    (await this.node).port.postMessage(Float32Array.of(0, note, velocity, sustain));
  }

  async release(note: number) {
    (await this.node).port.postMessage(Float32Array.of(1, note));
  }

  async destroy() {
    (await this.node).disconnect();

    // FIXME: this can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
    // https://issues.chromium.org/issues/41435286
    (await this.node).port.postMessage(Float32Array.of(2));
  }

  async connect(where: AudioNode, output?: number, input?: number) {
    return (await this.node).connect(where, output, input);
  }

  // TODO: add command for reconfiguring the instrument
  // async configure(processorOptions) {
  //   (await this.node).port.postMessage(Float32Array.of(3, processorOptions));
  // }
}

const createNotes = (notesStartAt = 21, notesEndAt = 108) => {
  const notes = [];

  for (let index = 21; index <= 108; index++) {
    notes.push(index);
  }

  return notes;
};

const createFrequencies = (
  audioContext: AudioContext,
  inharmonicity = 0.0,
  inharmonicityRoot = 440.0,
  notesStartAt = 21,
) => {
  const frequencies = [];

  // There are 10 frequencies for every note, up to half the sampling rate.
  for (let index = notesStartAt * 10; index < 150 * 10; index++) {
    let frequency = midiToFrequency10(index);
    frequency = frequency * (1.0 + inharmonicity * Math.log2(frequency / inharmonicityRoot));
    if (frequency > audioContext.sampleRate / 2.0) break;
    frequencies.push(frequency);
  }

  return frequencies;
};

type InstrumentPreset = {
  partials: number[][];
  notes?: number[];
  frequencies?: number[];
};

const cello: InstrumentPreset = {
  partials: [
    [1, 1.0],
    [2, 0.618],
    [3, 0.382],
    [4, 0.618], // 4
    [5, 0.382],
    [6, 0.09],
    [7, 0.236], // 7
    [8, 0.146],
    [9, 0.09],
    [10, 0.056],
    [11, 0.034],
    [12, 0.021],
    [13, 0.013],
    [14, 0.008],
    [15, 0.005],
    [16, 0.003],
  ],
  frequencies: createFrequencies(AudioSystem.get().audioContext, 0.005, 440.0),

  // TODO: add equivalents for or discard these
  // /** a `timeConstant` for how long the note takes to "fade in"; values below ~0.008 hurt a bit */
  // attack = 0.008;
  // /** a `timeConstant` for how long before the note reaches the `sustain` level after finishing its `attack` */
  // decay = 0.0;
  // /** how loud the note after it has fully decayed */
  // sustain = 0.0;
  // /** a `timeConstant` for how long the note takes to "fade out" */
  // release = 0.0;

  // /** @type {number} determines how strongly the oscillator's dynamics respond to different velocities */
  // velocitySensitivity = 1.0;

  // /** @type {OscillatorType} the type of the oscillator used for vibrato and attackInstability */
  // vibratoType = "triangle";

  // /** @type {number} how much vibrato should affect the note frequency (in cents) */
  // vibratoEffectOnPitch = 0.0;
  // /** @type {number} how much vibrato should affect volume (in gain) */
  // vibratoEffectOnVolume = 0.0;
  // /** @type {number} amount of brass instrument style initial note vibration: causes the "braaap" */
  // attackInstability = 0.0;

  // /** @type {number} detunes oscillator by this many cents * velocity */
  // attackDetune = 0.0;
  // /** @type {number=} a `timeConstant` for how long `attackDetune` should occur, defaults to `attack` */
  // attackDetuneDuration = undefined;

  // /** @type {number} detunes oscillators by this many cents over time, using a low frequency oscillator */
  // pitchVariance = 0.0;

  // // Values mostly from these sources:
  // // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // // https://alexiy.nl/eq_chart/
  // // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // // https://euphonics.org/5-3-signature-modes-and-formants/
  // // https://sengpielaudio.com/VowelDiagram.htm
  // /** @type {number} applies to a lowpass filter at this frequency */
  // lowPassFrequency = 4186.009 * 1.059463;
  // /** @type {number} applies a highpass filter at this frequency */
  // highPassFrequency = 27.5 * 0.943874;

  // /** @type {number} the resonance or "Q factor" of the lowpass filter */
  // lowPassQ = Math.SQRT1_2;
  // /** @type {number} the resonance or "Q factor" of the highpass filter */
  // highPassQ = Math.SQRT1_2;

  // /** @type {FormantFilterPreset[]} */
  // formants = [];
};

const bell: InstrumentPreset = {
  partials: [
    [0.25, 0.382],
    [0.5, 0.618],
    [1.2, 0.382],
    [1.5, 0.146],
    [2.0, 1.0],
    [3.0, 0.382],
    [4.0, 0.618],
    [5.4, 0.382],
    [6.75, 0.236],
    [8, 0.382],
    [16, 0.236],
    [32, 0.146],
  ],
};

const tempInstrument = new Instrument(AudioSystem.get().audioContext, cello);
tempInstrument.connect(AudioSystem.get().output);
