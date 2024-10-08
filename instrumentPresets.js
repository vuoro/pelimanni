/** @typedef {typeof genericInstrument} Instrument */

/**
 * @typedef {number} Attack - a `timeConstant`: how long the note takes to "fade in"
 * @typedef {number} Decay - a `timeConstant`: how long before the note reaches the `sustain` level after finishing its `attack`
 * @typedef {number} Sustain - a `timeConstant`: how loud the note after it has fully decayed
 * @typedef {number} Release - a `timeConstant`: how long the note takes to "fade out"
 * @typedef {number} Glide - a `timeConstant`: how slowly the oscillator moves to new note frequencies
 */

export const genericInstrument = Object.seal({
  /**
   * @typedef {object} Oscillator - creates the sound of the note
   * @property {OscillatorType | "pulse"} type
   * @property {number=} pulseWidth - duty cycle of the pulse; only used when `type` is `pulse`
   * @property {number=} pitchMultiplier - multiplies the frequency of the note for this oscillator
   * @property {number=} gain - base volume of the oscillator (make sure all oscillators don't add to >1.0)
   * @property {Attack=} attack
   * @property {Decay=} decay
   * @property {Sustain=} sustain
   * @property {Release=} release
   * @property {Glide=} glide
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

  /** @type {Attack} */
  filterAttack: undefined,
  /** @type {Decay} */
  filterDecay: undefined,
  /** @type {Sustain} */
  filterSustain: undefined,
  /** @type {Release} */
  filterRelease: undefined,

  /** @type {number} how much decay can extend the note's duration; 1.0 = by ~95% of the decay's duration */
  decayImpactOnDuration: 0.0,
  /** @type {number} how much note duration can extend decay's duration; 1.0 = similar to piano keys */
  durationImpactOnDecay: 0.09,

  // Controls the maximum and minimum frequencies of the notes and their harmonics.
  // I've taken my values from these sources:
  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm
  /** @type {number} maximum note and harmonics frequency */
  lowPassFrequency: 2100.0,
  /** @type {number} minimum note and harmonics frequency */
  highPassFrequency: 247.0,

  /** @type {number} makes lowPassFrequency track the pitch: 1.0 = doubles lowPassFrequency when playing a pitch at lowPassFrequency */
  lowPassPitchTracking: 0.056,
  /** @type {number} makes highPassFrequency track the pitch: 1.0 = halves highPassFrequency when playing a pitch at highPassFrequency */
  highPassPitchTracking: 0.056,

  /** @type {number} how much vibrato should affect lowPassFrequency (in cents) */
  vibratoEffectOnLowPass: 0.0,
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

/** @type {Instrument} */
export const flute = {
  ...genericInstrument,
  oscillators: [
    { type: "sawtooth", gain: 1 / 2, glide: 0.003 },
    { type: "sawtooth", gain: 1 / 2, glide: 0.003 },
  ],

  attack: 0.09,
  filterAttack: 0.056,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 0.91,
  release: 0.056,
  filterRelease: 0.034,

  highPassFrequency: 261.624 * 2.0,
  lowPassFrequency: 2349.312 / 2.0,

  // The tracking helps create the right overtones
  highPassPitchTracking: 1.0,
  lowPassPitchTracking: 1.0,

  vibratoEffectOnLowPass: 900.0,
  peakingFilters: [{ frequency: 810, gain: 2.0, Q: 3.0 }],
};

/** @type {Instrument} */
export const piccolo = {
  ...flute,
  highPassFrequency: 587.328,
  lowPassFrequency: 4185.984,
  peakingFilters: [{ frequency: 900, gain: 2.0, Q: 3.0 }],
};

/** @type {Instrument} */
export const oboe = {
  ...genericInstrument,
  oscillators: [
    { type: "triangle", gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 3, gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 9, gain: 1 / 3, glide: 0.003 },
  ],

  attack: 0.09,
  filterAttack: 0.056,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 0.91,
  release: 0.056,
  filterRelease: 0.034,

  highPassFrequency: 233.08,
  lowPassFrequency: 1760.0,

  vibratoEffectOnLowPass: 700.0,
  peakingFilters: [
    { frequency: 1400, gain: 2.0, Q: 3.0 },
    { frequency: 2950, gain: 3.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const bassoon = {
  ...oboe,
  attack: 0.146,
  filterAttack: 0.09,
  release: 0.09,
  filterRelease: 0.056,
  highPassFrequency: 58.27,
  lowPassFrequency: 622.368,
  peakingFilters: [
    { frequency: 440, gain: 2.0, Q: 3.0 },
    { frequency: 1180, gain: 2.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const contrabassoon = {
  ...bassoon,
  highPassFrequency: 58.27,
  lowPassFrequency: 466.16,
  peakingFilters: [
    { frequency: 250, gain: 2.0, Q: 3.0 },
    { frequency: 450, gain: 2.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const clarinet = {
  ...genericInstrument,
  oscillators: [
    { type: "square", gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 4, gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 6, gain: 1 / 3, glide: 0.003 },
  ],

  attack: 0.09,
  filterAttack: 0.056,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 0.91,
  release: 0.056,
  filterRelease: 0.034,

  highPassFrequency: 164.812,
  lowPassFrequency: 2092.992,
  vibratoEffectOnLowPass: 700.0,
  peakingFilters: [
    { frequency: 1180, gain: 2.0, Q: 3.0 },
    { frequency: 2700, gain: 3.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const saxophone = {
  ...genericInstrument,
  oscillators: [
    { type: "triangle", gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 5, gain: 1 / 3, glide: 0.003 },
    { type: "pulse", pulseWidth: 1 / 9, gain: 1 / 3, glide: 0.003 },
  ],
  initialInstability: 1.0,

  attack: 0.09,
  filterAttack: 0.034,
  decay: 0.236,
  filterDecay: 0.382,
  sustain: 0.764,
  filterSustain: 0.764,
  release: 0.056,
  filterRelease: 0.09,

  // FIXME: are these sensible? There are too many saxophone variants.
  highPassFrequency: 116.0,
  lowPassFrequency: 1244.0 * 2.0,

  // See note about trumpet high notes below
  lowPassPitchTracking: -1.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 1100, gain: 2.0, Q: 3.0 },
    { frequency: 1900, gain: 3.0, Q: 3.0 },
    { frequency: 3100, gain: 3.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const trumpet = {
  ...genericInstrument,
  oscillators: [
    { type: "pulse", pulseWidth: 1 / 6, gain: 2 / 3, glide: 0.003 },
    { type: "triangle", gain: 1 / 3, glide: 0.003 },
  ],
  initialInstability: 1.0,

  attack: 0.09,
  filterAttack: 0.034,
  decay: 0.236,
  filterDecay: 0.382,
  sustain: 0.764,
  filterSustain: 0.764,
  release: 0.056,
  filterRelease: 0.146,

  highPassFrequency: 184.996,
  lowPassFrequency: 1174.656 * 2.0,

  // Trumpet high notes are apparently less bright. Assuming it applies to all brass?
  lowPassPitchTracking: -1.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 1200, gain: 2.0, Q: 3.0 },
    { frequency: 2200, gain: 3.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const trombone = {
  ...trumpet,
  attack: 0.146,
  filterAttack: 0.056,
  release: 0.09,
  filterRelease: 0.236,
  highPassFrequency: 58.27,
  lowPassFrequency: 698.464 * 2.0,
  peakingFilters: [
    { frequency: 370, gain: 2.0, Q: 3.0 },
    { frequency: 520, gain: 2.0, Q: 3.0 },
    { frequency: 720, gain: 2.0, Q: 3.0 },
    { frequency: 1500, gain: 2.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const frenchHorn = {
  ...trombone,
  highPassFrequency: 55.0,
  lowPassFrequency: 698.46 * 2.0,
  peakingFilters: [{ frequency: 340, gain: 2.0, Q: 3.0 }],
};

/** @type {Instrument} */
export const tuba = {
  ...frenchHorn,
  highPassFrequency: 36.71,
  lowPassFrequency: 349.23 * 2.0,
  peakingFilters: [
    { frequency: 230, gain: 2.0, Q: 3.0 },
    { frequency: 400, gain: 2.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const violin = {
  ...genericInstrument,
  oscillators: [
    { type: "sawtooth", gain: 1 / 2, glide: 0.002 },
    { type: "sawtooth", gain: 1 / 2, glide: 0.003 },
  ],

  attack: 0.09,
  filterAttack: 0.146,
  decay: 0.236,
  filterDecay: 0.2,
  sustain: 0.854,
  filterSustain: 0.854,
  release: 0.056,
  filterRelease: 0.034,

  highPassFrequency: 196.0,
  lowPassFrequency: 4186.01 / 2.0,

  lowPassPitchTracking: 1.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 300, gain: 3, Q: 3.5 },
    { frequency: 700, gain: 4, Q: 3.5 },
    { frequency: 1000, gain: 4, Q: 3.5 },
    { frequency: 2900, gain: 5, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const viola = {
  ...violin,
  highPassFrequency: 130.8,
  lowPassFrequency: 2093.005 / 2.0,

  lowPassPitchTracking: 1.0,

  peakingFilters: [
    { frequency: 220, gain: 3, Q: 3.5 },
    { frequency: 350, gain: 4, Q: 3.5 },
    { frequency: 600, gain: 4, Q: 3.5 },
    { frequency: 1600, gain: 5, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const cello = {
  ...viola,
  attack: 0.146,
  filterAttack: 0.09,
  release: 0.09,
  filterRelease: 0.056,
  highPassFrequency: 65.4,
  lowPassFrequency: 1046.5, // intentionally not divided for tracking

  lowPassPitchTracking: 1.0,

  peakingFilters: [
    { frequency: 250, gain: 3, Q: 3.5 },
    { frequency: 400, gain: 4, Q: 3.5 },
    { frequency: 600, gain: 4, Q: 3.5 },
    { frequency: 900, gain: 5, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const contrabass = {
  ...cello,
  highPassFrequency: 41.2,
  lowPassFrequency: 523.25, // intentionally not divided for tracking

  lowPassPitchTracking: 1.0,

  peakingFilters: [
    { frequency: 70, gain: 3, Q: 3.0 },
    { frequency: 250, gain: 4, Q: 2.5 },
    { frequency: 750, gain: 4, Q: 3.5 },
    { frequency: 1100, gain: 5, Q: 2.0 },
  ],
};

const plucked = {
  /** @type {Instrument["oscillators"]} */
  oscillators: [
    { type: "pulse", pulseWidth: 1 / 3, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 1 / 5, gain: 1 / 2 },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.146,

  attack: 0.013,
  filterAttack: 0.003,
  decay: 0.5,
  filterDecay: 0.5,
  sustain: 0.0,
  release: 0.0,

  vibratoEffectOnPitch: 0.0,
  vibratoEffectOnVolume: 0.0,
  vibratoEffectOnLowpass: 0.0,
};

/** @type {Instrument} */
export const pluckedViolin = {
  ...violin,
  ...plucked,
};

/** @type {Instrument} */
export const pluckedViola = {
  ...viola,
  ...plucked,
};

/** @type {Instrument} */
export const pluckedCello = {
  ...cello,
  ...plucked,
};

/** @type {Instrument} */
export const pluckedContrabass = {
  ...contrabass,
  ...plucked,
};

/** @type {Instrument} */
export const hammeredDulcimer = {
  ...genericInstrument,
  oscillators: [
    { type: "pulse", pulseWidth: 1 / 5, glide: 0.001, gain: 1 / 2, pitchMultiplier: 1.005 },
    { type: "pulse", pulseWidth: 1 / 6, glide: 0.001, gain: 1 / 2, pitchMultiplier: 1.005 },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.5,

  attack: 0.013,
  filterAttack: 0.056,
  decay: 0.5,
  filterDecay: 0.5,
  sustain: 0.0,
  release: 0.0,

  // highPassPitchTracking: 0.0,
  // lowPassPitchTracking: 0.333333,

  highPassFrequency: 73.42,
  lowPassFrequency: 1244.51 * 2.0,

  peakingFilters: [
    { frequency: 400, gain: 2.0, Q: 3.0 },
    { frequency: 700, gain: 2.0, Q: 3.0 },
    { frequency: 900, gain: 2.0, Q: 3.0 },
    { frequency: 1300, gain: 2.0, Q: 3.0 },
    { frequency: 2700, gain: 2.0, Q: 3.0 },
    { frequency: 4000, gain: 2.0, Q: 3.0 },
  ],
};

/** @type {Instrument} */
export const piano = {
  ...genericInstrument,
  oscillators: [
    { type: "square", gain: 2 / 4, glide: 0.001, pitchMultiplier: 1.005 },
    { type: "pulse", pulseWidth: 1 / 4, gain: 1 / 4, glide: 0.001, pitchMultiplier: 1.005 },
    { type: "pulse", pulseWidth: 1 / 5, gain: 1 / 4, glide: 0.001, pitchMultiplier: 1.005 },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 1.0,

  attack: 0.013,
  filterAttack: 0.09,
  decay: 0.5,
  filterDecay: 0.5,
  sustain: 0.0,
  release: 0.0,

  // highPassPitchTracking: 0.0,
  lowPassPitchTracking: 1.0,

  highPassFrequency: 27.5,
  lowPassFrequency: 4186.009 / (1.0 + 1.0),

  peakingFilters: [
    { frequency: 400, gain: 2.0, Q: 3.0 },
    { frequency: 700, gain: 2.0, Q: 3.0 },
    { frequency: 900, gain: 2.0, Q: 3.0 },
    { frequency: 1300, gain: 2.0, Q: 3.0 },
    { frequency: 2700, gain: 2.0, Q: 3.0 },
    { frequency: 4000, gain: 2.0, Q: 3.0 },
  ],
};
