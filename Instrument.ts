import InstrumentWorklet from "./InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "./notes.js";

export class Instrument {
  node: Promise<AudioWorkletNode>;
  audioContext: AudioContext;
  defaultSustain: number;

  constructor(
    audioContext: AudioContext,
    {
      partials,
      getNotes = defaultGetNotes,
      getFrequencies = defaultGetFrequencies,
      getFrequencyAmplitudes = defaultGetFrequencyAmplitudes,
      attack = 0.09,
      decay = 0.146,
      defaultSustain = 1.0,
      release = 0.618,
      velocityImpactOnAttack = 8.0,
      pitchEffectOnAttack = 0.005,
      pitchEffectOnDecay = 0.003,
      pitchEffectOnRelease = 0.003,
      inharmonicity = 0.0,
      formantFrequency = midiToFrequency(65),
      notesStartAt = 21,
      notesEndAt = 108,
    }: InstrumentPreset,
  ) {
    this.audioContext = audioContext;

    const notes = getNotes(notesStartAt, notesEndAt);
    const frequencies = getFrequencies(notesStartAt, audioContext.sampleRate, inharmonicity);
    const frequencyAmplitudes = getFrequencyAmplitudes(frequencies, formantFrequency);

    const partialOffsets = new Int16Array(partials.length);
    const partialAmplitudes = new Float64Array(partials.length);
    const partialAttacks = new Float64Array(partials.length);

    for (const [
      index,
      [amplitude = 1.0, partialRatio = index + 1, attack = partialRatio + (1.0 - amplitude)],
    ] of partials.entries()) {
      partialOffsets[index] = frequencyToMidi10(440 * partialRatio) - frequencyToMidi10(440);
      partialAmplitudes[index] = amplitude / audioContext.sampleRate;
      partialAttacks[index] = 1.0 / attack;
    }

    const processorOptions = {
      notesStartAt,
      partialOffsets,
      partialAmplitudes,
      partialAttacks,

      velocityImpactOnAttack,

      noteAttacks: Float64Array.from(notes).map((note) =>
        Math.min(
          1.0,
          1.0 /
            (attack / (1.0 + pitchEffectOnAttack * midiToFrequency(note - (notesStartAt - 1)))) /
            audioContext.sampleRate,
        ),
      ),
      noteDecays: Float64Array.from(notes).map(
        (note) =>
          1.0 -
          decay ** ((1.0 + pitchEffectOnDecay * midiToFrequency(note - (notesStartAt - 1))) / audioContext.sampleRate),
      ),

      frequencies: Float64Array.from(frequencies), // FIXME: getFrequencies might as well create this typedarray right away
      frequencyAmplitudes: Float64Array.from(frequencyAmplitudes),
      frequencyReleases: Float64Array.from(frequencies).map(
        (frequency) =>
          release **
          ((1.0 + pitchEffectOnRelease * (frequency - midiToFrequency(notesStartAt - 1))) / audioContext.sampleRate),
      ),
    };

    this.node = audioContext.audioWorklet.addModule(InstrumentWorklet).then(() => {
      const node = new AudioWorkletNode(audioContext, "Instrument", {
        processorOptions,
      });
      node.port.start();

      return node;
    });

    this.defaultSustain = defaultSustain;
  }

  async attack(note: number, velocity = 1.0, sustain = this.defaultSustain) {
    // TODO:
    // // /** how much vibrato should affect the note frequency (in cents) */
    // vibratoEffectOnPitch: 0.0;
    // // /** how much vibrato should affect volume (in gain) */
    // vibratoEffectOnVolume: 0.0;
    // // /** amount of brass instrument style initial note vibration: causes the "braaap" */
    // attackInstability: 0.0;

    // // /** detunes oscillator by this many cents * velocity */
    // attackDetune: 0.0;
    // // /** for how long `attackDetune` should occur */
    // attackDetuneDuration: 0.0;

    (await this.node).port.postMessage(Float32Array.of(0, note, velocity, sustain));
  }

  async release(note: number) {
    (await this.node).port.postMessage(Float32Array.of(1, note));
  }

  async mute(amount: number) {
    (await this.node).port.postMessage(Float32Array.of(2, amount / (this.audioContext.sampleRate / 10.0)));
  }

  async destroy() {
    (await this.node).disconnect();

    // FIXME: this can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
    // https://issues.chromium.org/issues/41435286
    (await this.node).port.postMessage(Float32Array.of(3));
  }

  async connect(where: AudioNode, output?: number, input?: number) {
    return (await this.node).connect(where, output, input);
  }

  // TODO: add command for reconfiguring the instrument
  // async configure(processorOptions) {
  //   (await this.node).port.postMessage(Float32Array.of(3, processorOptions));
  // }
}

const defaultGetNotes = (notesStartAt = 21, notesEndAt = 108) => {
  const notes = [];

  for (let index = notesStartAt; index <= notesEndAt; index++) {
    notes.push(index);
  }

  return notes;
};

const defaultGetFrequencies = (notesStartAt = 21, sampleRate: number, inharmonicity = 0.0) => {
  const frequencies = [];

  // There are 10 frequencies for every note. Best have enough to reach half the sampling rate, for overtone use.
  for (let index = notesStartAt * 10; index < 150 * 10; index++) {
    let frequency = midiToFrequency10(index);

    // Both strings and clarinets seem to have an inharmonicity curve like this?
    const fromMiddle = Math.log2(frequency) - Math.log2(midiToFrequency(65));
    frequency *= 1.0 + inharmonicity * fromMiddle;

    if (frequency > sampleRate / 2.0 || frequency > 20000) break;
    frequencies.push(frequency);
  }

  return frequencies;
};

const defaultGetFrequencyAmplitudes = (frequencies: number[], formantFrequency = midiToFrequency(65)) => {
  const amplitudes = [];

  // I get my values mostly from these sources:
  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm

  for (const frequency of frequencies) {
    amplitudes.push(0.764 + 0.236 * Math.cos((Math.log2(frequency) - Math.log2(formantFrequency)) * 4.0 * Math.PI));
    // amplitudes.push(1.0);
  }

  return amplitudes;
};

export type InstrumentPreset = {
  partials: [
    /** Partial amplitude */
    (number | undefined)?,
    /** Partial ratio to fundamental frequency: 2.0 = 2.0 * fundamentalFrequency */
    (number | undefined)?,
    /** Partial attack multiplier */
    (number | undefined)?,
  ][];

  notesStartAt?: number;
  notesEndAt?: number;

  getNotes?: typeof defaultGetNotes;
  getFrequencies?: typeof defaultGetFrequencies;
  getFrequencyAmplitudes?: typeof defaultGetFrequencyAmplitudes;

  attack?: number;
  decay?: number;
  defaultSustain?: number;
  release?: number;

  velocityImpactOnAttack?: number;
  pitchEffectOnAttack?: number;
  pitchEffectOnDecay?: number;
  pitchEffectOnRelease?: number;

  /** Passed to getFrequencies. */
  inharmonicity?: number;
  /** Passed to getFrequencyAmplitudes. */
  formantFrequency?: number;
};
