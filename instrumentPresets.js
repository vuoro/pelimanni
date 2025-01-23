/** @typedef {typeof genericInstrument} Instrument */

import { getNoise } from "./noise";

/**
 * @typedef {number} Attack - a `timeConstant`: how long the note takes to "fade in"
 * @typedef {number} Decay - a `timeConstant`: how long before the note reaches the `sustain` level after finishing its `attack`
 * @typedef {number} Sustain - a `timeConstant`: how loud the note after it has fully decayed
 * @typedef {number} Release - a `timeConstant`: how long the note takes to "fade out"
 * @typedef {number} Glide - a `timeConstant`: how slowly the oscillator moves to new note frequencies
 */

export const genericInstrument = Object.seal({
  group: "Misc.",

  /**
   * @typedef {object} Oscillator - creates the sound of the note
   * @property {OscillatorType} type
   * @property {PeriodicWaveOptions=} periodicWave - used for custom oscillators
   * @property {number=} gain - base volume of the oscillator (make sure all oscillators don't add to >1.0)
   * @property {"both" | "low" | "high"=} stage - should this oscillator play during "low" stage (start of attack, end of release, low sustain, low velocity), "high" stage (end of attack, high sustain, high velocity), or both
   * @property {Attack=} attack
   * @property {Decay=} decay
   * @property {Sustain=} sustain
   * @property {Release=} release
   * @property {Glide=} glide
   * @property {number=} decayImpactOnDuration - see below
   * @property {number=} durationImpactOnDecay - see below
   * @property {(pitch: Number) => Number=} getPitch - lets you modify the pitch before it gets played
   */
  /** @type {Oscillator[]} the main oscillators that create the sound of the instrument. */
  oscillators: [{ type: "triangle" }],

  /** @type {OscillatorType} the type of the oscillator for vibrato, LFO effects, and initialInstability */
  vibratoType: "triangle",
  /** @type {number} brass instrument style initial note vibration amount: causes the "braaap" */
  initialInstability: 0.0,

  // These are all `timeConstant`s passed to `setTargetAtTime`.
  // They will be dynamically adjusted based on things like note frequency, duration etc.
  /** @type {Attack} */
  attack: 0.0,
  /** @type {Decay} */
  decay: 0.0,
  /** @type {Sustain} */
  sustain: 1.0,
  /** @type {Release} */
  release: 0.0,
  /** @type {Glide} */
  glide: 0.0,

  /** @type {Attack=} */
  overtoneAttack: undefined,
  /** @type {Decay=} */
  overtoneDecay: undefined,
  /** @type {Sustain=} */
  overtoneSustain: undefined,
  /** @type {Release=} */
  overtoneRelease: undefined,

  /** @type {number} how much decay can extend the note's duration; 1.0 = by ~95% of the decay's duration */
  decayImpactOnDuration: 0.0,
  /** @type {number} how much note duration can extend decay's duration; 1.0 = similar to piano keys */
  durationImpactOnDecay: 0.0,

  // Controls the maximum and minimum frequencies of the notes and their harmonics.
  // I've taken my values from these sources:
  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm
  /** @type {number} maximum note and harmonics frequency */
  lowPassFrequency: 4186.009,
  /** @type {number} minimum note and harmonics frequency */
  highPassFrequency: 27.5,

  /** @type {number} resonance or "Q" of the low pass filter  */
  lowPassQ: Math.SQRT1_2,
  /** @type {number} resonance or "Q" of the high pass filter  */
  highPassQ: Math.SQRT1_2,

  /** @type {number} how much vibrato should affect lowPassFrequency (in cents) */
  vibratoEffectOnStage: 0.0,
  /** @type {number} how much vibrato should affect the note frequency (in cents) */
  vibratoEffectOnPitch: 0.0,
  /** @type {number} how much vibrato should affect volume (in gain) */
  vibratoEffectOnVolume: 0.0,

  /**
   * @typedef {object} PeakingFilter - a `peaking` type `BiquadFilterNode` that shapes the instrument's timbre
   * @property {BiquadFilterNode["frequency"]["value"]} frequency
   * @property {BiquadFilterNode["gain"]["value"]} gain
   * @property {BiquadFilterNode["Q"]["value"]} Q
   */
  /** @type {PeakingFilter[]} A set of `peaking` filters applied to the instrument to shape its timbre. The instrument's overall volume will be automatically lowered to compensate for the highest `gain` filter. */
  peakingFilters: [],
});

/** @param {number} v */
const defaultLowStageMapper = (v) => Math.min(1.0, v) ** (5.0 + Math.random());

const requiredSympatheticStringElements = 3 * 2;

/** @param {Float32Array} imag */
const addSympatheticStringsToImag = (imag, loudness = 0.146) => {
  const newImag = new Float32Array(imag.length * requiredSympatheticStringElements * 3);

  for (let index = 1; index < imag.length; index++) {
    newImag[index * requiredSympatheticStringElements * 3] += imag[index] * loudness;
    newImag[index * requiredSympatheticStringElements * 2] += imag[index] * loudness; // higher strings
    newImag[index * requiredSympatheticStringElements] += imag[index]; // real string
    newImag[index * requiredSympatheticStringElements * (1 / 2)] += imag[index] * loudness; // lower strings
    newImag[index * requiredSympatheticStringElements * (1 / 3)] += imag[index] * loudness;
  }

  return newImag;
};

const getSympatheticStringPitch = (pitch = 440.0) => pitch / requiredSympatheticStringElements;

/** @param {Oscillator} oscillator */
const copySympatheticStrings = (oscillator, loudness = 0.146) => {
  const { gain = 1.0, getPitch } = oscillator;
  const strings = [oscillator];

  strings.push({
    ...oscillator,
    getPitch: (pitch) => (getPitch ? getPitch(pitch) : pitch) * 2.0,
    gain: gain * loudness,
  });
  strings.push({
    ...oscillator,
    getPitch: (pitch) => (getPitch ? getPitch(pitch) : pitch) * 3.0,
    gain: gain * loudness,
  });

  strings.push({
    ...oscillator,
    getPitch: (pitch) => (getPitch ? getPitch(pitch) : pitch) * (1.0 / 2.0),
    gain: gain * loudness,
  });
  strings.push({
    ...oscillator,
    getPitch: (pitch) => (getPitch ? getPitch(pitch) : pitch) * (1.0 / 3.0),
    gain: gain * loudness,
  });

  return strings;
};

const inharmonicityPrecision = 512;
const inharmonicityReferenceFrequency = 349.228; // this should vary by note, but oh well
const a = 5.22964 * 10 ** -6;
const b = 1.21012 * 10 ** -6;
const c = 8.3666 * 10 ** -10;
const d = -0.007927;
const e = 0.429601;

const inharmonicityCoefficient =
  a +
  b * inharmonicityReferenceFrequency +
  c * inharmonicityReferenceFrequency ** 2 +
  d / inharmonicityReferenceFrequency +
  e / inharmonicityReferenceFrequency ** 2;

/** @param {Float32Array} imag */
const stretchOvertones = (imag) => {
  if (imag.length > 16)
    throw new Error("Can't safely stretch overtones in imags with more than 16 entries");
  const newImag = new Float32Array(imag.length * inharmonicityPrecision);

  // https://forum.pianoworld.com/ubbthreads.php/topics/2438314/Inharmonicity_Math.html
  // Fn = n * F (1 + 0.5(n^2 - 1) * B) (Fletcher, Blackham & Stratton 1962)
  // Fn = frequency of partial (n) in Hertz
  // n = partial number
  // B = inharmonicity coefficient
  // B values vary with note and fundamental frequency.

  // According to http://daffy.uah.edu/piano/page4/page3/index.html, the B curve can be approximated by
  // B = a + bx + cx^2 + d/x + e/x^2
  // where x = frequency of note, and
  // a = 5.22964 x 10^-6
  // b = 1.21012 x 10^-6
  // c = 8.3666 x 10^-10
  // d = -0.007927
  // e = 0.429601
  // produces an acceptable fit for a Steinway B.

  for (let index = 1; index < imag.length; index++) {
    const inharmonicityRatio = 0.5 * (index ** 2.0 - 1) * inharmonicityCoefficient;

    // FIXME: is this needed?
    const correctionForRatiosBetweenOvertones = index === 1 ? 1 : 1.0 / ((index - 1) / index);

    const offset = Math.round(
      inharmonicityPrecision * inharmonicityRatio * correctionForRatiosBetweenOvertones,
    );
    newImag[index * inharmonicityPrecision + offset] = imag[index];

    // console.log(index - 1, inharmonicityRatio, offset / inharmonicityPrecision, offset);
  }

  return newImag;
};

// Tries to match the above
const getStretchedOvertonesPitch = (pitch = 440.0) => {
  const fromReference = Math.log2(pitch / inharmonicityReferenceFrequency);
  const inharmonicityRatio =
    0.5 * (Math.abs(fromReference) ** 4.0 * Math.sign(fromReference)) * inharmonicityCoefficient;
  return (pitch * (1.0 + inharmonicityRatio)) / inharmonicityPrecision;
};

const getStretchedOvertonesPitchWithoutTuning = (pitch = 440.0) => {
  return pitch / inharmonicityPrecision;
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://musiccrashcourses.com/lessons/harmonic_series.html
const fluteImag = Float32Array.of(
  0.0,
  1.0,
  0.854,
  0.382,
  0.618,
  0.236,
  0.09,
  0.034,
  0.013,
  0.005,
  0.002,
);

/** @type {Instrument} */
export const flute = {
  ...genericInstrument,
  group: "Woodwinds & flutes",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: fluteImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: fluteImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],

  glide: 0.001,

  attack: 0.034,
  overtoneAttack: 0.021,
  decay: 0.146,
  overtoneDecay: 0.236,
  sustain: 0.854,
  overtoneSustain: 0.764,
  release: 0.034,
  overtoneRelease: 0.021,

  highPassFrequency: 261.624,
  lowPassFrequency: 2349.312,

  vibratoEffectOnStage: 1.0,
  peakingFilters: [{ frequency: 810, gain: 2.0, Q: 2.0 }],
};

/** @type {Instrument} */
export const piccolo = {
  ...flute,
  highPassFrequency: 587.328,
  lowPassFrequency: 4185.984,
  peakingFilters: [{ frequency: 900, gain: 2.0, Q: 2.0 }],
};

// https://people.ece.cornell.edu/land/courses/ece5760/FinalProjects/f2011/emr76_jmm536/emr76_jmm536/index.html
// https://www.physicsforums.com/threads/origin-of-harmonics-in-helmholts-type-resonators.799974/
const ocarinaImag = Float32Array.of(
  0.0,
  1.0,
  0.0,
  0.09,
  0.0,
  0.382,
  0.0,
  0.0,
  0.236,
  0.0,
  0.0,
  0.0,
  0.146,
);

/** @type {Instrument} */
export const ocarina = {
  ...flute,
  oscillators: [
    {
      type: "custom",
      periodicWave: { imag: stretchOvertones(ocarinaImag) },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    },
    {
      type: "custom",
      periodicWave: { imag: stretchOvertones(ocarinaImag).map(defaultLowStageMapper) },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    },
  ],
  overtoneDecay: flute.decay * 0.618,
  highPassFrequency: 261.6,
  lowPassFrequency: 2793.826,
  vibratoEffectOnStage: 0.0,
  vibratoEffectOnPitch: 30,
  peakingFilters: [],
};

// Sources are very conflicting, must be wide variance between notes
// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
const oboeImag = Float32Array.of(
  0.0,
  0.618,
  0.764,
  0.382,
  0.854,
  1.0,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
);

/** @type {Instrument} */
export const oboe = {
  ...genericInstrument,
  group: "Woodwinds & flutes",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: oboeImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: oboeImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  glide: 0.001,

  attack: 0.034,
  overtoneAttack: 0.034,
  decay: 0.236,
  overtoneDecay: 0.236,
  sustain: 0.91,
  overtoneSustain: 0.764,
  release: 0.034,
  overtoneRelease: 0.021,

  highPassFrequency: 233.08,
  lowPassFrequency: 1760.0,

  vibratoEffectOnStage: 0.618,
  peakingFilters: [
    { frequency: 1400, gain: 2.0, Q: 2.0 },
    { frequency: 2950, gain: 2.0, Q: 2.0 },
  ],
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://koppreeds.com/harmonic.html
const bassoonImag = Float32Array.of(
  0.0,
  0.764,
  1.0,
  0.854,
  0.91,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

/** @type {Instrument} */
export const bassoon = {
  ...oboe,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: bassoonImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: bassoonImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  highPassFrequency: 58.27,
  lowPassFrequency: 622.368,
  peakingFilters: [
    { frequency: 440, gain: 2.0, Q: 2.0 },
    { frequency: 1180, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const contrabassoon = {
  ...bassoon,
  highPassFrequency: 58.27,
  lowPassFrequency: 466.16,
  peakingFilters: [
    { frequency: 250, gain: 2.0, Q: 2.0 },
    { frequency: 450, gain: 2.0, Q: 2.0 },
  ],
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
const clarinetImag = stretchOvertones(
  Float32Array.of(
    0.0,
    1.0,
    0.236,
    0.854,
    0.382,
    0.618,
    0.146,
    0.236,
    0.056,
    0.09,
    0.021,
    0.034,
    0.008,
    0.013,
    0.003,
    0.005,
  ),
);

/** @type {Instrument} */
export const clarinet = {
  ...genericInstrument,
  group: "Woodwinds & flutes",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: clarinetImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitchWithoutTuning,
    },
    {
      type: "custom",
      periodicWave: {
        imag: clarinetImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitchWithoutTuning,
    },
  ],

  glide: 0.001,

  attack: 0.034,
  overtoneAttack: 0.034,
  decay: 0.236,
  overtoneDecay: 0.236,
  sustain: 0.91,
  overtoneSustain: 0.764,
  release: 0.034,
  overtoneRelease: 0.021,

  highPassFrequency: 164.812,
  lowPassFrequency: 2092.992,
  vibratoEffectOnStage: 0.618,
  peakingFilters: [
    { frequency: 1180, gain: 2.0, Q: 2.0 },
    { frequency: 2700, gain: 2.0, Q: 2.0 },
  ],
};

// https://www.phys.unsw.edu.au/music/saxophone/soprano/Asharp3.html
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-030-15046-4_2/MediaObjects/472011_1_En_2_Fig8_HTML.png
// https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2007_reu/Impedance_Spectrum_for_a_Tenor_Sax_and_a_Bb_Trumpet.pdf
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-53507-9_7/MediaObjects/539603_1_En_7_Fig13_HTML.png
// https://www.physics.rutgers.edu/~jackph/2005s/sm_fft/sm_fft.html
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// TODO: revise these since there are now separate high and low oscillators
const saxophoneImag = stretchOvertones(
  Float32Array.of(
    0.0,
    0.854,
    1.0,
    0.236,
    0.618,
    0.382,
    0.236,
    0.146,
    0.09,
    0.056,
    0.034,
    0.021,
    0.013,
    0.008,
    0.005,
    0.003,
  ),
);

/** @type {Instrument} */
export const saxophone = {
  ...genericInstrument,
  group: "Woodwinds & flutes",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: saxophoneImag,
      },
      getPitch: getStretchedOvertonesPitchWithoutTuning,
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: saxophoneImag.map(defaultLowStageMapper),
      },
      getPitch: getStretchedOvertonesPitchWithoutTuning,
      stage: "low",
    },
  ],
  glide: 0.003,
  initialInstability: 0.764,

  attack: 0.034,
  overtoneAttack: 0.09,
  decay: 0.236,
  overtoneDecay: 0.146,
  sustain: 0.854,
  overtoneSustain: 0.618,
  release: 0.034,
  overtoneRelease: 0.056,

  // FIXME: are these sensible? There are too many saxophone variants.
  highPassFrequency: 116.0,
  lowPassFrequency: 1244.0 * 2.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 670, gain: 2.0, Q: 2.0 },
    { frequency: 2050, gain: 2.0, Q: 2.0 },
    { frequency: 3100, gain: 2.0, Q: 2.0 },
  ],
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
const trumpetImag = Float32Array.of(
  0.0,
  0.618,
  1.0,
  0.764,
  0.854,
  0.764,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
);

/** @type {Instrument} */
export const trumpet = {
  ...genericInstrument,
  group: "Brass",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: trumpetImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: trumpetImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  glide: 0.003,
  initialInstability: 0.764,

  attack: 0.034,
  overtoneAttack: 0.09,
  decay: 0.236,
  overtoneDecay: 0.382,
  sustain: 0.854,
  overtoneSustain: 0.618,
  release: 0.056,
  overtoneRelease: 0.09,

  highPassFrequency: 184.996,
  lowPassFrequency: 1174.656 * 2.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 1200, gain: 2.0, Q: 2.0 },
    { frequency: 2200, gain: 2.0, Q: 2.0 },
  ],
};

// https://www.researchgate.net/figure/Power-spectrum-of-flute-trombone-and-their-mixture_fig3_226825024
// http://hyperphysics.phy-astr.gsu.edu/hbase/Music/tromw.html
const tromboneImag = Float32Array.of(
  0.0,
  0.618,
  1.0,
  0.854,
  0.764,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

/** @type {Instrument} */
export const trombone = {
  ...trumpet,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: tromboneImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: tromboneImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  highPassFrequency: 58.27,
  lowPassFrequency: 698.464 * 2.0,
  peakingFilters: [
    { frequency: 520, gain: 2.0, Q: 2.0 },
    { frequency: 1500, gain: 2.0, Q: 2.0 },
  ],
};

// https://www.researchgate.net/figure/Spectrum-comparison-of-different-instrument-objects-On-the-left-hand-side-C-Trumpet-C_fig7_225163040
const frenchHornImag = Float32Array.of(
  0.0,
  0.854,
  1.0,
  0.91,
  0.764,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

/** @type {Instrument} */
export const frenchHorn = {
  ...trombone,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: frenchHornImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: frenchHornImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  highPassFrequency: 55.0,
  lowPassFrequency: 698.46 * 2.0,
  peakingFilters: [
    { frequency: 340, gain: 2.0, Q: 2.0 },
    { frequency: 750, gain: 2.0, Q: 2.0 },
  ],
};

// https://www.rickdenney.com/the_tuba_sound.htm
const tubaImag = Float32Array.of(
  0.0,
  0.764,
  0.91,
  0.764,
  1.0,
  0.764,
  0.91,
  0.618,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
);

/** @type {Instrument} */
export const tuba = {
  ...frenchHorn,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: tubaImag,
      },
      stage: "high",
    },
    {
      type: "custom",
      periodicWave: {
        imag: tubaImag.map(defaultLowStageMapper),
      },
      stage: "low",
    },
  ],
  highPassFrequency: 36.71,
  lowPassFrequency: 349.23 * 2.0,
  peakingFilters: [
    { frequency: 230, gain: 2.0, Q: 2.0 },
    { frequency: 400, gain: 2.0, Q: 2.0 },
  ],
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// https://www.rickertmusicalinstruments.com/2017/11/amplified-violins-effects-processors-pickups.html
// https://www.tremblingsandwarblings.com/2017/04/musical-sound-tone-quality-spectra/
// https://vibrationresearch.com/resources/overtone-comparison-obserview/
const violinImag = Float32Array.of(
  0.0,
  1.0,
  0.854,
  0.618,
  0.5,
  0.618, // 5
  0.238,
  0.382,
  0.5,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
);

/** @type {Instrument} */
export const violin = {
  ...genericInstrument,
  group: "Strings (bowed)",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(violinImag),
      },
      stage: "high",
      getPitch: getSympatheticStringPitch,
    },
    {
      type: "custom",
      periodicWave: {
        // TODO: manually adjust low stage, based on
        // http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
        imag: addSympatheticStringsToImag(violinImag.map(defaultLowStageMapper)),
      },
      stage: "low",
      getPitch: getSympatheticStringPitch,
    },
  ],

  glide: 0.001,

  // http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
  attack: 0.09,
  overtoneAttack: 0.056,
  decay: 0.236,
  overtoneDecay: 0.382,
  sustain: 1.056,
  overtoneSustain: 0.618,
  release: 0.146,
  overtoneRelease: 0.09,

  highPassFrequency: 196.0,
  lowPassFrequency: 3520.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 300, gain: 3, Q: 3.5 },
    { frequency: 700, gain: 4, Q: 3.5 },
    { frequency: 1000, gain: 4, Q: 3.5 },
    { frequency: 2900, gain: 5, Q: 2.0 },
  ],
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1032&context=musicstudent
const violaImag = Float32Array.of(
  0.0,
  0.854,
  1.0,
  0.854,
  0.764, // 4
  0.382,
  0.238,
  0.382,
  0.5,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
);

/** @type {Instrument} */
export const viola = {
  ...violin,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(violaImag),
      },
      stage: "high",
      getPitch: getSympatheticStringPitch,
    },
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(violaImag.map(defaultLowStageMapper)),
      },
      stage: "low",
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 130.8,
  lowPassFrequency: 2093.005,

  peakingFilters: [
    { frequency: 220, gain: 3, Q: 3.5 },
    { frequency: 350, gain: 4, Q: 3.5 },
    { frequency: 600, gain: 4, Q: 3.5 },
    { frequency: 1600, gain: 5, Q: 2.0 },
  ],
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://vobarian.com/celloanly/index.html
const celloImag = Float32Array.of(
  0.0,
  1.0,
  0.618,
  0.382,
  0.618, // 4
  0.382,
  0.236,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

/** @type {Instrument} */
export const cello = {
  ...viola,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(celloImag),
      },
      stage: "high",
      getPitch: getSympatheticStringPitch,
    },
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(celloImag.map(defaultLowStageMapper)),
      },
      stage: "low",
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 65.4,
  lowPassFrequency: 1760.0,

  peakingFilters: [
    { frequency: 250, gain: 3, Q: 3.5 },
    { frequency: 400, gain: 4, Q: 3.5 },
    { frequency: 600, gain: 4, Q: 3.5 },
    { frequency: 900, gain: 5, Q: 2.0 },
  ],
};

// Guessed based on cello
const contrabassImag = Float32Array.of(
  0.0,
  1.0,
  0.618,
  0.382,
  0.5, // 4
  0.333333,
  0.146,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
  0.003,
);

/** @type {Instrument} */
export const contrabass = {
  ...cello,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(contrabassImag),
      },
      stage: "high",
      getPitch: getSympatheticStringPitch,
    },
    {
      type: "custom",
      periodicWave: {
        imag: addSympatheticStringsToImag(contrabassImag.map(defaultLowStageMapper)),
      },
      stage: "low",
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 41.2,
  lowPassFrequency: 523.25,

  peakingFilters: [
    { frequency: 70, gain: 3, Q: 3.5 },
    { frequency: 250, gain: 4, Q: 3.5 },
    { frequency: 750, gain: 4, Q: 3.0 },
    { frequency: 1100, gain: 5, Q: 2.0 },
  ],
};

// Oh dear…
// https://vibrationresearch.com/resources/overtone-comparison-obserview/
// https://universe-review.ca/I13-17-timbre.jpg
// https://www.acs.psu.edu/drussell/Piano/Dynamics.html
// https://audiouniversityonline.com/why-do-instruments-sound-different/
// https://www.lamadeguido.com/fundamentos/ecap2.htm
// https://courses.physics.illinois.edu/phys398dlp/sp2019/documents/pianos_Quantitative%20Analysis%20on%20the%20Tonal%20Quality%20of%20Various%20Pianos.pdf
// https://www.youtube.com/watch?v=5xjD6SRY8Pg
// https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00768/full
const pianoImag = Float32Array.of(
  0.0,
  // First 4 are quite high and often in a U shape
  1.0,
  0.854,
  0.5,
  0.618,
  // Then there's a pair arcing up
  0.236,
  0.382,
  // And down
  0.236,
  0.146,

  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

const stretchedPianoImag = stretchOvertones(pianoImag);

// Piano transients
// https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=624e7d25054fb6f5e9ab864e48f432d7dc5871fd
// initial key noise, finger tap: 290 and 445 Hz, lasts 20–30ms, weak, more audible at low velocity
// later key/hammer noise: 914 hz, 10–20ms attack, strong
// also body, soundboard, and keybed noises: 38, 100 and 250 Hz (xylophone-like?)
// const hammerAndLowKeyNoiseImag = new Float32Array(25);
// hammerAndLowKeyNoiseImag[1] = 1.0; // 38 hz
// hammerAndLowKeyNoiseImag[3] = 0.618; // ~100 hz
// hammerAndLowKeyNoiseImag[7] = 0.382; // ~250 hz
// hammerAndLowKeyNoiseImag[24] = 1.0; // ~914 hz

/** @type {Instrument} */
export const piano = {
  ...genericInstrument,
  group: "Strings (hammered)",
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedPianoImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedPianoImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
    // TODO: is it worth having this in a digital instrument?
    // {
    //   type: "custom",
    //   periodicWave: { imag: hammerAndLowKeyNoiseImag },
    //   getPitch: () => 38.0,
    //   gain: 0.056,
    //   attack: 0.005,
    //   decay: 0.056,
    //   durationImpactOnDecay: 0.005,
    // },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.618,

  attack: 0.008,
  overtoneAttack: 0.021,
  decay: 0.618,
  overtoneDecay: 0.382,
  sustain: 0.0,
  release: 0.0,
};

/** @type {Instrument} */
export const hammeredDulcimer = {
  ...genericInstrument,
  group: "Strings (hammered)",
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedPianoImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedPianoImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
    // {
    //   type: "custom",
    //   periodicWave: {
    //     // FIXME: this sounds more like an anvil than anything…
    //     imag: Float32Array.of(
    //       0.0,
    //       ...Float32Array.of(0.0, 0.146, 0.0, 0.0, 0.0, 0.09, 0.0, 0.056, 0.0, 0.0), // body noise around 80 hz?
    //       ...Float32Array.of(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.146), // bounce noise around 900 hz
    //       ...Float32Array.of(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.382),
    //       ...Float32Array.of(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.236), // hammer overtones
    //     ),
    //   },
    //   getPitch: () => 44.0,
    //   gain: 0.236,
    //   attack: 0.008,
    //   decay: 0.056,

    //   decayImpactOnDuration: 0.0,
    //   durationImpactOnDecay: 0.0,
    // },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.382,

  attack: 0.008,
  overtoneAttack: 0.016,
  decay: 0.618,
  overtoneDecay: 0.382,
  sustain: 0.0,
  release: 0.0,

  highPassFrequency: 73.42,
  lowPassFrequency: 1244.51 * 3.0,
};

const taikoImag = new Float32Array(20 * 9.3);
taikoImag[20 * 1] = 0.618;
taikoImag[20 * 2.1] = 1.0; // 2.11
taikoImag[20 * 2.9] = 0.618; // 2.92
taikoImag[20 * 3.75] = 0.382;
taikoImag[20 * 4.4] = 0.236;
taikoImag[20 * 5.6] = 0.146; // 5.57
taikoImag[20 * 7.6] = 0.09;
taikoImag[20 * 8.5] = 0.056;
taikoImag[20 * 9.3] = 0.034;

/** @param {Instrument} instrument */
export const taikoDrum = {
  ...genericInstrument,
  group: "Percussion (drums)",
  oscillators: [
    {
      type: "custom",
      periodicWave: getNoise(
        (value, index) =>
          (value * Math.min(1.0, Math.max(0.0, index - 18.0))) / Math.max(1.0, index - 18.0),
      ),
      getPitch: () => 5.0,
      gain: 0.618,
      attack: 0.008,
      decay: 0.056,
      durationImpactOnDecay: 0.005,
    },
    {
      type: "custom",
      periodicWave: {
        imag: taikoImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: taikoImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.618,

  attack: 0.008,
  overtoneAttack: 0.013,
  decay: 0.382,
  overtoneDecay: 0.618,
  sustain: 0.0,
  release: 0.0,

  lowPassFrequency: 3080, // FIXME: no idea what this should be on any percussion
};

const timpaniImag = new Float32Array(20 * 3.15);
timpaniImag[20 * 1] = 0.618;
timpaniImag[20 * 1.5] = 1.0;
timpaniImag[20 * 2.0] = 0.618; // 1.98
timpaniImag[20 * 2.45] = 0.382; // 2.44
timpaniImag[20 * 3.15] = 0.236; // 3.16

/** @param {Instrument} instrument */
export const timpani = {
  ...taikoDrum,
  oscillators: [
    {
      ...taikoDrum.oscillators[0],
      periodicWave: getNoise(
        (value, index) =>
          (value * Math.min(1.0, Math.max(0.0, index - 27.0))) / Math.max(1.0, index - 27.0),
      ),
    },
    {
      type: "custom",
      periodicWave: {
        imag: timpaniImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: timpaniImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],
};

const bassDrumImag = new Float32Array(20 * 5.45);
bassDrumImag[20 * 1] = 0.618;
bassDrumImag[20 * 1.85] = 1.0; // 1.86
bassDrumImag[20 * 2.7] = 0.618; // 2.72
bassDrumImag[20 * 3.65] = 0.382; // 3.64
bassDrumImag[20 * 4.5] = 0.236;
bassDrumImag[20 * 5.45] = 0.146; // 5.46

/** @param {Instrument} instrument */
export const bassDrum = {
  ...taikoDrum,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: bassDrumImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: bassDrumImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      ...taikoDrum.oscillators[0],
    },
  ],
};

const snareImag = new Float32Array(20 * 3.45);
snareImag[20 * 1] = 0.618;
snareImag[20 * 1.5] = 1.0;
snareImag[20 * 1.8] = 0.618;
snareImag[20 * 2.25] = 0.382;
snareImag[20 * 2.4] = 0.236;
snareImag[20 * 2.85] = 0.146;
snareImag[20 * 3.45] = 0.09;

/** @param {Instrument} instrument */
export const snareDrum = {
  ...taikoDrum,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: snareImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: snareImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      ...taikoDrum.oscillators[0],
    },
  ],
};

// Tuned so that the 2nd harmonic is at about 4.0
const marimbaImag = new Float32Array(20 * 43);
marimbaImag[20 * 1] = 1.0;
marimbaImag[20 * 4] = 0.236; // 3.92
marimbaImag[20 * 10] = 0.146; // 9.24
marimbaImag[20 * 16.25] = 0.618; // 16.27
marimbaImag[20 * 24.2] = 0.146; // 24.22
marimbaImag[20 * 33.55] = 0.09; // 33.56
marimbaImag[20 * 43] = 0.056; // 42.97

/** @param {Instrument} instrument */
export const marimba = {
  ...genericInstrument,
  group: "Percussion (idiophones)",
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: marimbaImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: marimbaImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],

  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.618,

  attack: 0.008,
  overtoneAttack: 0.013,
  decay: 0.382,
  overtoneDecay: 0.236,
  sustain: 0.0,
  release: 0.0,

  lowPassFrequency: 20000,
};

// Tuned so that the 2nd harmonic is at about 3.0
const xylophoneImag = new Float32Array(20 * 24);
xylophoneImag[20 * 1] = 1.0;
xylophoneImag[20 * 3] = 0.236;
xylophoneImag[20 * 6] = 0.5; // 6.16
xylophoneImag[20 * 10] = 0.146; // 10.29
xylophoneImag[20 * 14] = 0.618; // 14.01
xylophoneImag[20 * 19.65] = 0.382; // 19.66
xylophoneImag[20 * 24] = 0.236; // 24.02

/** @param {Instrument} instrument */
export const xylophone = {
  ...marimba,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: xylophoneImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: xylophoneImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],

  durationImpactOnDecay: 0.236,
};

const glockenspielImag = new Float32Array(20 * 32);

// Pure idiophone overtones
// glockenspielImag[20 * 1] = 1.0;
// glockenspielImag[20 * 2.75] = 0.618; // 2.756
// glockenspielImag[20 * 5.4] = 0.382;
// glockenspielImag[20 * 8.9] = 0.618;
// glockenspielImag[20 * 13.35] = 0.382; // 13.34
// glockenspielImag[20 * 18.65] = 0.236; // 18.64
// glockenspielImag[20 * 31.85] = 0.146; // 31.87

// https://www.physics.mcgill.ca/~grant/224/19-224.pdf
glockenspielImag[20 * 1] = 1.0;
glockenspielImag[20 * 2.7] = 0.618;
glockenspielImag[20 * 3.25] = 0.382;
glockenspielImag[20 * 5.55] = 0.618;
glockenspielImag[20 * 5.15] = 0.382;
glockenspielImag[20 * 7.05] = 0.236;
glockenspielImag[20 * 8] = 0.146;
glockenspielImag[20 * 8.45] = 0.09;
glockenspielImag[20 * 10.6] = 0.056;
glockenspielImag[20 * 11.25] = 0.034;
glockenspielImag[20 * 12.2] = 0.021;
glockenspielImag[20 * 13.95] = 0.013;

/** @param {Instrument} instrument */
export const glockenspiel = {
  ...marimba,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: glockenspielImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: glockenspielImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],

  attack: 0.013,
  overtoneAttack: 0.013,
  decay: 0.382,
  overtoneDecay: 0.09,
};

// https://www.hibberts.co.uk/the-upper-partials-of-bells/
const bellImag = new Float32Array(20 * 32);
bellImag[20 * 0.25] = 0.382;
bellImag[20 * 0.5] = 0.618;
bellImag[20 * 1.2] = 0.382;
bellImag[20 * 1.5] = 0.146;
bellImag[20 * 2.0] = 1.0;
bellImag[20 * 3.0] = 0.382;
bellImag[20 * 4.0] = 0.618;
bellImag[20 * 5.4] = 0.382;
bellImag[20 * 6.75] = 0.236;
bellImag[20 * 8] = 0.382;
bellImag[20 * 16] = 0.236;
bellImag[20 * 32] = 0.146;

/** @param {Instrument} instrument */
export const bell = {
  ...glockenspiel,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: bellImag,
      },
      stage: "high",
      getPitch: (pitch) => pitch / 20.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: bellImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: (pitch) => pitch / 20.0,
    },
  ],

  overtoneDecay: 1.0,
};

// Plucked string transients
// https://quod.lib.umich.edu/cgi/p/pod/dod-idx/synthesis-of-transients-in-guitar-sounds.pdf?c=icmc&format=pdf&idno=bbp2372.1997.051
// body tap: 104, ~562 (5.4x), and ~780 (7.5x) hz
// const pluckedStringBodyTapImag = new Float32Array(8 * 10);
// pluckedStringBodyTapImag[1 * 10] = 1.0;
// pluckedStringBodyTapImag[5.4 * 10] = 1.0;
// pluckedStringBodyTapImag[7.5 * 10] = 1.0;

// TODO: is it worth having this in a digital instrument?
// /** @type {Oscillator} */
// const pluckedTransientOscillator = {
//   type: "custom",
//   periodicWave: { imag: pluckedStringBodyTapImag },
//   getPitch: () => 104.0 / 10,
//   gain: 0.09,
//   attack: 0.005,
//   decay: 0.034,
//   durationImpactOnDecay: 0.005,
// };

const plucked = {
  group: "Strings (plucked)",
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.764,

  glide: 0.0,
  attack: 0.008,
  overtoneAttack: 0.013,
  decay: 0.618,
  overtoneDecay: 0.382,
  sustain: 0.0,
  overtoneSustain: 0.0,
  release: 0.0,
  overtoneRelease: 0.0,

  vibratoEffectOnPitch: 30.0,
  vibratoEffectOnVolume: 0.0,
  vibratoEffectOnStage: 0.0, // FIXME: should there be some of this?
};

const stretchedViolinImag = stretchOvertones(violinImag);
const stretchedViolaImag = stretchOvertones(violaImag);
const stretchedCelloImag = stretchOvertones(celloImag);
const stretchedContrabassImag = stretchOvertones(contrabassImag);

/** @type {Instrument} */
export const pluckedViolin = {
  ...violin,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedViolinImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedViolinImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
};

/** @type {Instrument} */
export const pluckedViola = {
  ...viola,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedViolaImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedViolaImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
};

/** @type {Instrument} */
export const pluckedCello = {
  ...cello,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedCelloImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedCelloImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
    // pluckedTransientOscillator,
  ],
};

/** @type {Instrument} */
export const pluckedContrabass = {
  ...contrabass,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedContrabassImag,
      },
      stage: "high",
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      type: "custom",
      periodicWave: {
        imag: stretchedContrabassImag.map(defaultLowStageMapper),
      },
      stage: "low",
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
};
