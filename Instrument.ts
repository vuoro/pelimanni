import InstrumentWorklet from "./InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "./notes.js";

export type InstrumentPreset = {
  partials: [
    /** Partial amplitude */
    number,
    /** Partial ratio to fundamental frequency: 2.0 = 2.0 * fundamentalFrequency */
    number,
    /** Partial attack multiplier */
    number,
    /** Partial release multiplier */
    number,
  ][];

  transients?: [
    /** Transient amplitude */
    number,
    /** Transient midi10 number (midi number, but multiplied by 10) */
    number,
    /** Transient attack */
    number,
    /** Transient release */
    number,
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

  pitchEffectOnAttack?: number;
  pitchEffectOnDecay?: number;
  pitchEffectOnRelease?: number;
  pitchEffectOnBrightness?: number;

  /** Passed to getFrequencies. */
  inharmonicity?: number;
  /** Passed to getFrequencyAmplitudes. */
  formantFrequency?: number;
};

export class Instrument {
  node: Promise<AudioWorkletNode>;
  audioContext: AudioContext;
  defaultSustain: number;

  constructor(
    audioContext: AudioContext,
    {
      partials,
      transients,
      getNotes = defaultGetNotes,
      getFrequencies = defaultGetFrequencies,
      getFrequencyAmplitudes = defaultGetFrequencyAmplitudes,
      attack = 0.09,
      decay = 0.09,
      defaultSustain = 1.0,
      release = 0.618,
      pitchEffectOnAttack = 0.09,
      pitchEffectOnDecay = 0.09,
      pitchEffectOnRelease = 0.618,
      pitchEffectOnBrightness = 0.5,
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
    const partialReleases = new Float64Array(partials.length);

    const transientAmplitudes = new Float64Array(transients?.length ?? 0);
    const transientIndexes = new Int16Array(transients?.length ?? 0);
    const transientAttacks = new Float64Array(transients?.length ?? 0);
    const transientReleases = new Float64Array(transients?.length ?? 0);

    for (const [index, [amplitude, partialRatio, attack, release]] of partials.entries()) {
      partialOffsets[index] = frequencyToMidi10(440 * partialRatio) - frequencyToMidi10(440);
      partialAmplitudes[index] = amplitude;
      partialAttacks[index] = attack;
      partialReleases[index] = release;
    }

    if (transients) {
      for (const [index, [amplitude, frequency, attack, release]] of transients.entries()) {
        transientAmplitudes[index] = amplitude;
        transientIndexes[index] = frequencyToMidi10(frequency) - notesStartAt * 10;
        transientAttacks[index] = attack / audioContext.sampleRate;
        transientReleases[index] = release / audioContext.sampleRate;
      }
    }

    const processorOptions = {
      notesStartAt,

      noteAttacks: Float64Array.from(notes).map(
        (note) =>
          (attack *
            2.0 ** (pitchEffectOnAttack * (Math.log2(midiToFrequency(note)) - Math.log2(midiToFrequency(60))))) /
          audioContext.sampleRate,
      ),
      noteDecays: Float64Array.from(notes).map(
        (note) =>
          (decay * 2.0 ** (pitchEffectOnDecay * (Math.log2(midiToFrequency(note)) - Math.log2(midiToFrequency(60))))) /
          audioContext.sampleRate,
      ),
      noteReleases: Float64Array.from(notes).map(
        (note) =>
          (release *
            2.0 ** (pitchEffectOnRelease * (Math.log2(midiToFrequency(note)) - Math.log2(midiToFrequency(60))))) /
          audioContext.sampleRate,
      ),
      noteBrightnesses: Float64Array.from(notes).map(
        (note) =>
          2.0 ** (pitchEffectOnBrightness * (Math.log2(midiToFrequency(note)) - Math.log2(midiToFrequency(60)))),
      ),

      partialOffsets,
      partialAmplitudes,
      partialAttacks,
      partialReleases,

      transientIndexes,
      transientAmplitudes,
      transientAttacks,
      transientReleases,

      frequencies: Float64Array.from(frequencies), // FIXME: getFrequencies might as well create this typedarray right away
      frequencyAmplitudes: Float64Array.from(frequencyAmplitudes),
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

  async attack(note: number, velocity = 1.0, sustain = this.defaultSustain, attackMultiplier = 1.0, dynamics = 0.5) {
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

    (await this.node).port.postMessage(
      Float32Array.of(0, note, velocity, sustain, attackMultiplier * (1.0 + velocity), dynamics),
    );
  }

  async release(note: number, releaseMultiplier = 1.0) {
    (await this.node).port.postMessage(Float32Array.of(1, note, 0.0, 0.0, releaseMultiplier));
  }

  async destroy() {
    (await this.node).disconnect();

    // FIXME: this can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
    // https://issues.chromium.org/issues/41435286
    (await this.node).port.postMessage(Float32Array.of(666));
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

    // Both strings and clarinets seem to have an inharmonicity curve like this? Resembles the Railsback Curve.
    const fromMiddle = Math.log2(frequency) - Math.log2(midiToFrequency(60));
    frequency *= 1.0 + Math.abs(fromMiddle) ** 2.0 * Math.sign(fromMiddle) * inharmonicity;

    if (frequency > sampleRate / 2.0 || frequency > 20000) break;
    frequencies.push(frequency);
  }

  return frequencies;
};

const defaultGetFrequencyAmplitudes = (frequencies: number[], formantFrequency = midiToFrequency(60)) => {
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
