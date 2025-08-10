import InstrumentWorklet from "./InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "./notes.js";

export type InstrumentPreset = {
  /** List of partials: [amplitude, frequencyRatio, attackMultiplier, releaseMultiplier]. */
  partials: [number, number, number, number][];

  /** The lowest note this instrument can play, in MIDI numbers */
  notesStartAt?: number;
  /** The highest note this instrument can play, in MIDI numbers */
  notesEndAt?: number;

  /** Returns the list of notes this instrument can play */
  getNotes?: typeof defaultGetNotes;
  /** Returns the list of frequencies the notes of this instrument can play */
  getFrequencies?: typeof defaultGetFrequencies;
  /** Returns the loudnesses of the frequencies this instrument can play */
  getFrequencyAmplitudes?: typeof defaultGetFrequencyAmplitudes;

  /** How quickly should notes reach full volume */
  attack?: number;
  /** How quickly should notes drop to sustain level */
  decay?: number;
  /** How quickly should notes die off after being released */
  release?: number;
  /** How loud should notes be, by default, after the initial attack (0.0–1.0) */
  defaultSustain?: number;

  /** Multiplies the frequency being played at the start of the note. Used to create a "transient" for most instruments. */
  attackDetune?: number;
  /** A triangle wave that multiplies the frequency being played at a start of the note. Used for the "brrrr" in brass instruments. */
  attackPitchInstability?: number;
  /** A triangle wave that affects partial amplitudes at the start of a note. Used for the "brrrr" in brass instruments. */
  attackBrightnessInstability?: number;
  /** The frequency of the triangle wave in attack instability (80 is good) */
  attackInstabilityFrequency?: number;

  /** How much faster should higher notes attack */
  pitchEffectOnAttack?: number;
  /** How much faster should higher notes decay */
  pitchEffectOnDecay?: number;
  /** How much faster should higher notes release */
  pitchEffectOnRelease?: number;
  /** How much much louder should the overtones of higher notes be */
  pitchEffectOnBrightness?: number;

  /** Passed to getFrequencies. */
  inharmonicity?: number;
  /** Passed to getFrequencyAmplitudes. */
  formantFrequency?: number;

  /** Applies attack effects like detune and instability on release too */
  shouldApplyAttackEffectsOnReleaseToo?: boolean;
};

export class Instrument {
  node: Promise<AudioWorkletNode>;
  audioContext: AudioContext;

  defaultSustain: number;

  constructor(
    audioContext: AudioContext,
    {
      partials,
      // transients,
      getNotes = defaultGetNotes,
      getFrequencies = defaultGetFrequencies,
      getFrequencyAmplitudes = defaultGetFrequencyAmplitudes,
      attack = 0.09,
      decay = 0.09,
      release = 0.618,
      defaultSustain = 1.0,
      pitchEffectOnAttack = 0.09,
      pitchEffectOnDecay = 0.09,
      pitchEffectOnRelease = 0.618,
      pitchEffectOnBrightness = 0.5,
      attackDetune = 0.0,
      attackPitchInstability = 0.0,
      attackBrightnessInstability = 0.0,
      attackInstabilityFrequency = 80.0,
      inharmonicity = 0.0,
      formantFrequency = midiToFrequency(65),
      notesStartAt = 21,
      notesEndAt = 108,
      shouldApplyAttackEffectsOnReleaseToo = false,
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

    // const transientAmplitudes = new Float64Array(transients?.length ?? 0);
    // const transientIndexes = new Int16Array(transients?.length ?? 0);
    // const transientAttacks = new Float64Array(transients?.length ?? 0);
    // const transientReleases = new Float64Array(transients?.length ?? 0);

    for (const [index, [amplitude, partialRatio, attack, release]] of partials.entries()) {
      partialOffsets[index] = frequencyToMidi10(440 * partialRatio) - frequencyToMidi10(440);
      partialAmplitudes[index] = amplitude;
      partialAttacks[index] = attack;
      partialReleases[index] = release;
    }

    // if (transients) {
    //   for (const [index, [amplitude, frequency, attack, release]] of transients.entries()) {
    //     transientAmplitudes[index] = amplitude;
    //     transientIndexes[index] = frequencyToMidi10(frequency) - notesStartAt * 10;
    //     transientAttacks[index] = attack / audioContext.sampleRate;
    //     transientReleases[index] = release / audioContext.sampleRate;
    //   }
    // }

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

      // transientIndexes,
      // transientAmplitudes,
      // transientAttacks,
      // transientReleases,

      attackDetune,
      attackPitchInstability,
      attackBrightnessInstability,
      attackInstabilityFrequency,

      frequencies: Float64Array.from(frequencies), // FIXME: getFrequencies might as well create this typedarray right away
      frequencyAmplitudes: Float64Array.from(frequencyAmplitudes),

      shouldApplyAttackEffectsOnReleaseToo,
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

  async attack(
    note: number,
    velocity = 1.0,
    sustain = this.defaultSustain,
    attackMultiplier = 1.0,
    amplitudeVibrato = 0.0,
    brightnessVibrato = 0.0,
    pitchVibrato = 0.0,
    vibratoFrequency = 5.5,
    dynamics = 0.5,
  ) {
    (await this.node).port.postMessage(
      Float32Array.of(
        0,
        note,
        velocity,
        sustain,
        attackMultiplier,
        amplitudeVibrato,
        brightnessVibrato,
        pitchVibrato,
        vibratoFrequency,
        dynamics,
      ),
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
    // Make all the frequencies matching the chosen formant note stronger, and also the frequencies exactly between them.
    // As a result the instrument "body" itself "resonates" a harmonic chord.
    amplitudes.push(0.764 + 0.236 * Math.cos((Math.log2(frequency) - Math.log2(formantFrequency)) * 4.0 * Math.PI));
    // amplitudes.push(1.0);
  }

  return amplitudes;
};
