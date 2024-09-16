/** @typedef {typeof genericInstrument} Instrument */
export const genericInstrument = Object.seal({
  /** @type {{type: OscillatorType | "pulse", pulseWidth?: number, pitchMultiplier?: number, gain?: number, glide?: number}[]} */
  oscillators: [{ type: "triangle" }],
  /** @type {OscillatorType} */
  vibratoType: "triangle",
  initialInstability: 0.0,
  isPolyphonic: false,

  attack: 0.09,
  decay: 0.0,
  sustain: 1.0,
  release: 0.056,

  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm
  lowPassFrequency: 2100.0,
  highPassFrequency: 247.0,
  lowPassPitchTracking: 0.034,
  highPassPitchTracking: 0.034,

  lowPassSpeedMultiplier: 1.0,
  highPassSpeedMultiplier: 1.0,

  baseVibratoFrequency: 5.0,
  vibratoEffectOnLowPass: 0.0, // in cents
  vibratoEffectOnPitch: 0.0, // in cents
  vibratoEffectOnVolume: 0.0,

  peakingFilters: [],
});

/** @type {Instrument} */
export const flute = {
  ...genericInstrument,
  oscillators: [
    { type: "triangle", gain: 1 / 2 },
    { type: "triangle", gain: 1 / 2, glide: 0.005 },
  ],
  attack: 0.09,
  decay: 0.382,
  sustain: 0.91,
  release: 0.056,
  highPassFrequency: 261.624,
  lowPassFrequency: 2349.312,
  lowPassSpeedMultiplier: 0.764,
  highPassSpeedMultiplier: 0.91,
  vibratoEffectOnLowPass: 1200,
  vibratoEffectOnVolume: 0.008,
  peakingFilters: [{ frequency: 810, gain: 1.618, q: 2.0 }],
};

/** @type {Instrument} */
export const piccolo = {
  ...flute,
  highPassFrequency: 587.328,
  lowPassFrequency: 4185.984,
  peakingFilters: [{ frequency: 900, gain: 1.618, q: 2.0 }],
};

/** @type {Instrument} */
export const oboe = {
  ...genericInstrument,
  oscillators: [
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2, glide: 0.004 },
  ],
  attack: 0.09,
  decay: 0.382,
  sustain: 0.91,
  release: 0.056,
  lowPassSpeedMultiplier: 0.764,
  highPassSpeedMultiplier: 0.91,
  highPassFrequency: 233.08,
  lowPassFrequency: 1760.0,
  vibratoEffectOnLowPass: 1200.0,
  vibratoEffectOnVolume: 0.008,
  peakingFilters: [
    { frequency: 1400, gain: 1.618, q: 2.0 },
    { frequency: 2950, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const bassoon = {
  ...oboe,
  highPassFrequency: 58.27,
  lowPassFrequency: 622.368,
  peakingFilters: [
    { frequency: 440, gain: 1.618, q: 2.0 },
    { frequency: 1180, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const contrabassoon = {
  ...bassoon,
  highPassFrequency: 58.27,
  lowPassFrequency: 466.16,
  peakingFilters: [
    { frequency: 250, gain: 1.618, q: 2.0 },
    { frequency: 450, gain: 1.618, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const clarinet = {
  ...genericInstrument,
  oscillators: [
    { type: "pulse", pulseWidth: 0.4, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 0.4, gain: 1 / 2, glide: 0.003 },
  ],
  attack: 0.09,
  decay: 0.382,
  sustain: 0.91,
  release: 0.056,
  lowPassSpeedMultiplier: 0.764,
  highPassSpeedMultiplier: 0.91,
  highPassFrequency: 164.812,
  lowPassFrequency: 2092.992,
  vibratoEffectOnLowPass: 1200.0,
  vibratoEffectOnVolume: 0.008,
  peakingFilters: [
    { frequency: 1180, gain: 1.618, q: 2.0 },
    { frequency: 2700, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const saxophone = {
  ...genericInstrument,
  oscillators: [
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2, glide: 0.005 },
  ],
  // kind of halfway between woodwind and brass
  initialInstability: 0.764,
  attack: 0.09,
  decay: 0.382,
  sustain: 0.8,
  release: 0.056,
  lowPassSpeedMultiplier: 0.854,
  highPassSpeedMultiplier: 0.618,
  highPassFrequency: 233.08,
  lowPassFrequency: 1567.968,
  vibratoEffectOnLowPass: 1200.0,
  peakingFilters: [
    { frequency: 1100, gain: 1.618, q: 2.0 },
    { frequency: 1900, gain: 2.0, q: 1.0 },
    { frequency: 3100, gain: 2.0, q: 1.0 },
  ],
};

/** @type {Instrument} */
export const trumpet = {
  ...genericInstrument,
  oscillators: [
    { type: "sawtooth", gain: 1 / 2 },
    { type: "sawtooth", gain: 1 / 2, glide: 0.004 },
  ],
  initialInstability: 1.0,
  attack: 0.09,
  decay: 0.382,
  sustain: 0.8,
  release: 0.056,
  lowPassFrequency: 1174.656,
  highPassFrequency: 184.996,
  lowPassPitchTracking: -0.056,
  lowPassSpeedMultiplier: 0.91,
  highPassSpeedMultiplier: 0.618,
  vibratoEffectOnLowPass: 700,
  vibratoEffectOnVolume: 0.021,
  peakingFilters: [
    { frequency: 1200, gain: 1.618, q: 2.0 },
    { frequency: 2200, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const trombone = {
  ...trumpet,
  highPassFrequency: 82.406,
  lowPassFrequency: 698.464,
  peakingFilters: [
    { frequency: 520, gain: 1.618, q: 2.0 },
    { frequency: 1500, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const bassTrombone = {
  ...trombone,
  highPassFrequency: 58.27,
  lowPassFrequency: 466.16,
  peakingFilters: [
    { frequency: 370, gain: 1.618, q: 2.0 },
    { frequency: 720, gain: 2.0, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const frenchHorn = {
  ...bassTrombone,
  highPassFrequency: 55.0,
  lowPassFrequency: 698.46,
  peakingFilters: [{ frequency: 450, gain: 1.618, q: 2.0 }],
};

/** @type {Instrument} */
export const tuba = {
  ...frenchHorn,
  highPassFrequency: 36.71,
  lowPassFrequency: 349.23,
  peakingFilters: [
    { frequency: 230, gain: 1.618, q: 2.0 },
    { frequency: 400, gain: 1.618, q: 2.0 },
  ],
};

/** @type {Instrument} */
export const violin = {
  ...genericInstrument,
  oscillators: [
    { type: "sawtooth", gain: 1 / 2 },
    { type: "sawtooth", gain: 1 / 2, glide: 0.004 },
  ],
  attack: 0.09,
  decay: 0.382,
  sustain: 0.854,
  release: 0.056,

  highPassFrequency: 196.0,
  lowPassFrequency: 4186.01,

  vibratoEffectOnPitch: 30,
  vibratoEffectOnVolume: 0.013,

  lowPassSpeedMultiplier: 0.854,
  highPassSpeedMultiplier: 0.618,

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
  lowPassFrequency: 2093.005, // not sure what this should be, exactly
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
  release: 0.09,
  highPassFrequency: 65.4,
  lowPassFrequency: 1046.5,
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
  lowPassFrequency: 523.25,
  peakingFilters: [
    { frequency: 70, gain: 3, Q: 3.0 },
    { frequency: 250, gain: 4, Q: 2.5 },
    { frequency: 750, gain: 4, Q: 3.5 },
    { frequency: 1100, gain: 5, Q: 2.0 },
  ],
};

const plucked = {
  isPolyphonic: true,
  /** @type {Instrument["oscillators"]} */
  oscillators: [
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 4, glide: 0.004 * Math.SQRT1_2 },
    { type: "pulse", pulseWidth: 0.3, gain: -1 / 4, glide: 0.004 },
  ],
  attack: 0.013,
  decay: 0.91,
  sustain: 0.034,
  release: 0.056,
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
  isPolyphonic: true,
  oscillators: [
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 2 },
    { type: "pulse", pulseWidth: 0.3, gain: -1 / 4, glide: 0.004 },
    { type: "pulse", pulseWidth: 0.3, gain: 1 / 4, glide: 0.008 },
  ],
  attack: 0.013,
  decay: 1.0,
  sustain: 0.034,
  release: 0.056,

  lowPassPitchTracking: 0.236,
  highPassPitchTracking: 0.034,

  highPassFrequency: 73.42,
  lowPassFrequency: 1244.51 * 1.618,

  lowPassSpeedMultiplier: 0.618,
  highPassSpeedMultiplier: 0.854,

  peakingFilters: [
    { frequency: 400, gain: 2.0, Q: 3.0 },
    { frequency: 700, gain: 2.0, Q: 3.0 },
    { frequency: 900, gain: 2.0, Q: 3.0 },
    { frequency: 1300, gain: 2.0, Q: 2.0 },
    { frequency: 2700, gain: 3.0, Q: 2.0 },
    { frequency: 4000, gain: 3.0, Q: 2.0 },
  ],
};
