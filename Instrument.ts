import InstrumentWorkletUrl from "./InstrumentWorklet?worker&url";
import type { InstrumentWorklet } from "./InstrumentWorklet.ts";
import { frequencyToMidi10, midiToFrequency, midiToFrequency10 } from "./notes.js";

export type InstrumentPreset = {
  /** List of partials: [amplitude, frequencyRatio]. */
  partials: [number, number?][];

  /** The lowest note this instrument can play, in MIDI numbers */
  notesStartAt?: number;
  /** The highest note this instrument can play, in MIDI numbers */
  notesEndAt?: number;

  /** Returns the list of frequencies the notes of this instrument can play */
  getFrequencies?: typeof defaultGetFrequencies;
  /** Returns the loudnesses of the frequencies this instrument can play */
  getFrequencyAmplitudes?: typeof defaultGetFrequencyAmplitudes;

  /** How quickly should notes reach full volume (larger number = faster) */
  attack?: number;
  /** How quickly should notes drop to sustain level (larger number = faster) */
  decay?: number;
  /** How quickly should notes die off after being released (larger number = faster) */
  release?: number;
  /** How loud should notes be, by default, after the initial attack (0.0–1.0) */
  defaultSustain?: number;

  /** Multiplies the frequency being played at the start of the note. Used to create a "transient" for most instruments. */
  attackDetune?: number;
  /** A triangle wave that multiplies the frequency being played at a start of the note. Used for the "brrrr" in brass instruments. */
  attackPitchInstability?: number;
  /** The frequency of the triangle wave in attack instability (80 is good) */
  attackInstabilityFrequency?: number;

  /** How much faster should higher notes attack */
  frequencyEffectOnAttack?: number;
  /** How much faster should higher notes decay */
  frequencyEffectOnDecay?: number;
  /** How much faster should higher notes release */
  frequencyEffectOnRelease?: number;
  /** How much louder should the overtones of higher notes be */
  frequencyEffectOnBrightness?: number;
  /** Minimum velocity notes should add this much to brightness */
  minimumVelocityBrightness?: number;
  /** Maximum velocity notes should add this much to brightness */
  maximumVelocityBrightness?: number;

  /** How much faster should overtones attack */
  partialEffectOnAttack?: number;
  /** How much faster should overtones decay */
  partialEffectOnDecay?: number;
  /** How much faster should overtones release */
  partialEffectOnRelease?: number;

  /** Passed to getFrequencies. */
  inharmonicity?: number;
  /** At this frequency the instrument's attack, decay, release, and brightness are at the specified levels. Above or below it `frequencyEffectOnAttack` etc. start taking effect. Also used as a formant frequency. Passed to getFrequencyAmplitudes. */
  homeFrequency?: number;

  /** Makes each partial of the note detune individually, instead of following the fundamental. */
  attackDetuneUsesPartialAmplitude?: boolean;
  /** Makes each partial of the note instabilise individually, instead of following the fundamental. */
  attackInstabilityUsesPartialAmplitude?: boolean;
};

export class Instrument {
  node: Promise<AudioWorkletNode>;
  audioContext: AudioContext;

  defaultSustain: number;
  velocityExponent = 0.8;

  constructor(
    audioContext: AudioContext,
    {
      partials: partialList,
      getFrequencies = defaultGetFrequencies,
      getFrequencyAmplitudes = defaultGetFrequencyAmplitudes,
      attack = Math.SQRT2,
      decay = Math.SQRT2,
      release = Math.SQRT2,
      defaultSustain = 1.0,
      frequencyEffectOnAttack = 0.1,
      frequencyEffectOnDecay = frequencyEffectOnAttack,
      frequencyEffectOnRelease = 0.618,
      frequencyEffectOnBrightness = -0.8,
      partialEffectOnAttack = -frequencyEffectOnAttack,
      partialEffectOnDecay = partialEffectOnAttack,
      partialEffectOnRelease = frequencyEffectOnRelease,
      minimumVelocityBrightness = -4.0,
      maximumVelocityBrightness = 0.125,
      attackDetune = 0.0,
      attackPitchInstability = 0.0,
      attackInstabilityFrequency = 80.0,
      inharmonicity = 0.0,
      homeFrequency = midiToFrequency(60),
      notesStartAt = 21,
      notesEndAt = 108,
      attackDetuneUsesPartialAmplitude = false,
      attackInstabilityUsesPartialAmplitude = false,
    }: InstrumentPreset,
  ) {
    this.audioContext = audioContext;

    const partialMap = new Map();

    for (let index = 0; index < partialList.length; index++) {
      const [amplitude, partialRatio = index + 1] = partialList[index];

      const midi10Number = frequencyToMidi10(440 * partialRatio) - frequencyToMidi10(440);

      partialMap.set(midi10Number, (partialMap.get(midi10Number) || 0.0) + amplitude);
    }

    const partialsSorted = [...partialMap.entries()].sort(([midi10NumberA], [midi10NumberB]) =>
      Math.abs(midi10NumberB - midi10NumberA),
    );
    const partials = new Float64Array(partialsSorted.length * 2);

    {
      let index = 0;
      for (const [midi10Number, amplitude] of partialsSorted) {
        partials[index * 2 + 0] = amplitude;
        partials[index * 2 + 1] = midi10Number;
        index++;
      }
    }

    const frequencyList = getFrequencies(notesStartAt, audioContext.sampleRate, inharmonicity);
    const frequencyAmplitudeList = getFrequencyAmplitudes(frequencyList, homeFrequency);

    const frequencies = new Float64Array(frequencyList.length * 2);

    for (let index = 0; index < frequencyList.length; index++) {
      frequencies[index * 2 + 0] = frequencyList[index];
      frequencies[index * 2 + 1] = frequencyAmplitudeList[index];
    }

    const processorOptions: Partial<InstrumentWorklet> = {
      partials,
      frequencies,

      notesStartAt,
      notesEndAt,
      attackDetune,
      attackPitchInstability,
      attackInstabilityFrequency,
      attackDetuneUsesPartialAmplitude,
      attackInstabilityUsesPartialAmplitude,

      attack,
      decay,
      release,
      frequencyEffectOnAttack,
      frequencyEffectOnDecay,
      frequencyEffectOnRelease,
      frequencyEffectOnBrightness,
      partialEffectOnAttack,
      partialEffectOnDecay,
      partialEffectOnRelease,
      minimumVelocityBrightness,
      maximumVelocityBrightness,
      homeFrequency,
    };

    this.node = audioContext.audioWorklet.addModule(InstrumentWorkletUrl).then(() => {
      const node = new AudioWorkletNode(audioContext, "Instrument", {
        processorOptions,
      });
      node.port.start();

      return node;
    });

    this.defaultSustain = defaultSustain;
  }

  async attack(
    /** MIDI number */
    note: number,
    velocity: number,
    /** uses `defaultSustain` if left undefined */
    sustain = this.defaultSustain,
    /** multiplies attack and decay speed */
    multiplier = 1.0,
    /** vibrates all partials in unison */
    amplitudeVibrato = 0.0,
    /** vibrates only overtones */
    brightnessVibrato = 0.0,
    /** vibrates frequency, in cents: 200 = 2 semitones and so on */
    frequencyVibrato = 0.0,
    /** in hertz: 6.0 by default */
    vibratoFrequency = 6.0,
    /** how much velocity affects loudness: 0.5 means all notes are quite loud, 2.0 means quite quiet */
    dynamics = 1.0,
  ) {
    const message = Float32Array.of(
      0,
      note,
      velocity ** this.velocityExponent,
      sustain,
      multiplier,
      amplitudeVibrato * 4.0,
      brightnessVibrato * 6.0,
      2.0 ** (frequencyVibrato / 100.0 / 12.0) - 1.0, // convert cents to ratio (worklet handles the +/- conversion)
      vibratoFrequency,
      dynamics,
    );
    (await this.node).port.postMessage(message, [message.buffer]);
  }

  async release(
    /** MIDI number */
    note: number,
    /** multiplies release speed */
    releaseMultiplier = 1.0,
  ) {
    const message = Float32Array.of(1, note, 0.0, 0.0, releaseMultiplier);
    (await this.node).port.postMessage(message, [message.buffer]);
  }

  async destroy() {
    // FIXME: this can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
    // https://issues.chromium.org/issues/41435286
    const message = Float32Array.of(666);
    (await this.node).port.postMessage(message, [message.buffer]);
    (await this.node).disconnect();
  }

  async connect(where: AudioNode, output?: number, input?: number) {
    return (await this.node).connect(where, output, input);
  }

  // TODO: add command for reconfiguring the instrument
  // async configure(processorOptions) {
  //   const messageFloat32Array.of(3, processorOptions)
  //   (await this.node).port.postMessage(message, [message.buffer]);
  // }
}

const defaultGetFrequencies = (notesStartAt = 21, sampleRate: number, inharmonicity = 0.0) => {
  const frequencies = [];

  // There are 10 frequencies for every note. All played notes and their partials are rounded to these frequencies.
  // This causes slight rounding errors in overtones, the worst being -3.910002 cents for the 9th overtone.
  for (let index = notesStartAt * 10; index < 150 * 10; index++) {
    let frequency = midiToFrequency10(index);

    // Both strings and clarinets seem to have an inharmonicity curve like this? Resembles the Railsback Curve.
    const fromMiddle = Math.log2(frequency) - Math.log2(midiToFrequency(60));
    frequency *= 1.0 + Math.abs(fromMiddle) ** 2.0 * Math.sign(fromMiddle) * inharmonicity;

    // Best have enough to reach half the sampling rate, or the common human hearing limit.
    if (frequency > sampleRate / 2.0 || frequency > 20000) break;
    frequencies.push(frequency);
  }

  return frequencies;
};

const defaultGetFrequencyAmplitudes = (frequencies: number[], homeFrequency = midiToFrequency(60)) => {
  const amplitudes = [];

  // Sets up a repeating "formant" using the home frequency. The home frequency whichever ones the `formantRatio` wave hits are louder.
  // As a result the instrument "body" kind of "resonates" a harmonic chord, I think? Sounds nice anyway.
  const formantAmplitude = 0.5 / 2.0;

  // const formantRatio = 1.0; // every octave, sounds rational but boring
  const formantRatio = 2.0; // every octave and every perfect fifth, sounds great
  // const formantRatio = 2.0 / 3.0; // every octave + perfect fifth, sounds nice but hollow

  // I guesstimate homeFrequencies mostly from these sources:
  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm

  for (const frequency of frequencies) {
    amplitudes.push(
      1.0 -
        formantAmplitude +
        formantAmplitude * Math.cos((Math.log2(frequency) - Math.log2(homeFrequency)) * formantRatio * 2.0 * Math.PI),
    );
  }

  return amplitudes;
};
