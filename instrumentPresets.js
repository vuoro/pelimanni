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
   * @property {OscillatorType} type
   * @property {PeriodicWaveOptions=} periodicWave - used for custom oscillators
   * @property {number=} pitchMultiplier - multiplies the frequency of the note for this oscillator
   * @property {number=} gain - base volume of the oscillator (make sure all oscillators don't add to >1.0)
   * @property {Attack=} attack
   * @property {Decay=} decay
   * @property {Sustain=} sustain
   * @property {Release=} release
   * @property {Glide=} glide
   * @property {number=} decayImpactOnDuration - see below
   * @property {number=} durationImpactOnDecay - see below
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
  attack: 0.09,
  /** @type {Decay} */
  decay: 0.0,
  /** @type {Sustain} */
  sustain: 1.0,
  /** @type {Release} */
  release: 0.236,
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

  /** @type {number} resonance or "Q" of the low pass filter  */
  lowPassQ: Math.SQRT1_2,
  /** @type {number} resonance or "Q" of the high pass filter  */
  highPassQ: Math.SQRT1_2,

  /** @type {number} flattens pitches on the low end and sharpens on the high end, for pianos and the like */
  stretchedTuning: 0.0,

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
    {
      type: "custom",
      periodicWave: {
        // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
        // https://musiccrashcourses.com/lessons/harmonic_series.html
        imag: Float32Array.of(
          0.0,
          1.0,
          0.854,
          0.764,
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
          0.002,
          0.001,
        ),
      },
    },
  ],

  glide: 0.003,

  attack: 0.056,
  filterAttack: 0.034,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 1.0,
  release: 0.056,
  filterRelease: 0.09,

  highPassFrequency: 261.624,
  lowPassFrequency: 2349.312,
  lowPassPitchTracking: 0.382,

  vibratoEffectOnLowPass: 900.0,
  peakingFilters: [{ frequency: 810, gain: 2.0, Q: 2.0 }],
};

/** @type {Instrument} */
export const piccolo = {
  ...flute,
  highPassFrequency: 587.328,
  lowPassFrequency: 4185.984,
  lowPassPitchTracking: 0.382,
  peakingFilters: [{ frequency: 900, gain: 2.0, Q: 2.0 }],
};

/** @type {Instrument} */
export const oboe = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
        imag: Float32Array.of(
          0.0,
          0.618,
          0.5,
          0.8,
          1.0,
          0.7,
          0.6,
          0.65,
          0.586,
          0.3,
          0.2,
          0.18,
          0.45,
          0.17,
          0.2,
          0.16,
          0.25,
        ),
      },
    },
  ],
  glide: 0.003,

  attack: 0.056,
  filterAttack: 0.034,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 1.0,
  release: 0.056,
  filterRelease: 0.09,

  highPassFrequency: 233.08,
  lowPassFrequency: 1760.0,

  vibratoEffectOnLowPass: 700.0,
  peakingFilters: [
    { frequency: 1400, gain: 2.0, Q: 2.0 },
    { frequency: 2950, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const bassoon = {
  ...oboe,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
        // https://koppreeds.com/harmonic.html
        imag: Float32Array.of(
          0.0,
          0.586,
          0.764,
          1.0,
          0.5,
          0.618,
          0.55,
          0.854,
          0.382,
          0.333333,
          0.35,
          0.146,
          0.236,
          0.146,
          0.2,
        ),
      },
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

/** @type {Instrument} */
export const clarinet = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
        imag: Float32Array.of(
          0.0,
          1.0,
          0.2,
          0.9,
          0.4,
          0.764,
          0.1,
          0.5,
          0.1,
          0.4,
          0.15,
          0.3,
          0.05,
          0.2,
          0.02,
          0.15,
          0.01,
        ),
      },
    },
  ],

  glide: 0.003,

  attack: 0.056,
  filterAttack: 0.034,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 0.91,
  filterSustain: 1.0,
  release: 0.056,
  filterRelease: 0.09,

  highPassFrequency: 164.812,
  lowPassFrequency: 2092.992,
  vibratoEffectOnLowPass: 700.0,
  peakingFilters: [
    { frequency: 1180, gain: 2.0, Q: 2.0 },
    { frequency: 2700, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const saxophone = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://www.phys.unsw.edu.au/music/saxophone/soprano/Asharp3.html
        // https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-030-15046-4_2/MediaObjects/472011_1_En_2_Fig8_HTML.png
        // https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2007_reu/Impedance_Spectrum_for_a_Tenor_Sax_and_a_Bb_Trumpet.pdf
        // https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-53507-9_7/MediaObjects/539603_1_En_7_Fig13_HTML.png
        // https://www.physics.rutgers.edu/~jackph/2005s/sm_fft/sm_fft.html
        imag: Float32Array.of(
          0.0,
          0.618,
          0.91,
          1.0,
          0.854,
          0.382,
          0.5,
          0.382,
          0.618,
          0.09,
          0.034,
          0.056,
          0.056,
          0.034,
          0.021,
          0.013,
          0.008,
          0.005,
          0.003,
          0.002,
        ),
      },
    },
  ],
  glide: 0.003,
  initialInstability: 1.0,

  attack: 0.056,
  filterAttack: 0.021,
  decay: 0.236,
  filterDecay: 0.382,
  sustain: 0.854,
  filterSustain: 0.854,
  release: 0.056,
  filterRelease: 0.09,

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

/** @type {Instrument} */
export const trumpet = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
        imag: Float32Array.of(
          0.0,
          0.65,
          1.0,
          0.6,
          0.586,
          0.4,
          0.2,
          0.414,
          0.25,
          0.2,
          0.15,
          0.2,
          0.16,
          0.18,
          0.17,
          0.16,
          0.18,
        ),
      },
    },
  ],
  glide: 0.003,

  initialInstability: 1.0,

  attack: 0.056,
  filterAttack: 0.013,
  decay: 0.236,
  filterDecay: 0.382,
  sustain: 0.854,
  filterSustain: 0.854,
  release: 0.056,
  filterRelease: 0.09,

  highPassFrequency: 184.996,
  lowPassFrequency: 1174.656 * 2.0,

  vibratoEffectOnPitch: 30,
  peakingFilters: [
    { frequency: 1200, gain: 2.0, Q: 2.0 },
    { frequency: 2200, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const trombone = {
  ...trumpet,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://www.researchgate.net/figure/Power-spectrum-of-flute-trombone-and-their-mixture_fig3_226825024
        imag: Float32Array.of(0.0, 0.764, 1.0, 0.91, 0.8, 0.7, 0.618, 0.6, 0.5, 0.4, 0.3, 0.2, 0.2, 0.1),
      },
    },
  ],
  highPassFrequency: 58.27,
  lowPassFrequency: 698.464 * 2.0,
  peakingFilters: [
    { frequency: 520, gain: 2.0, Q: 2.0 },
    { frequency: 1500, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const frenchHorn = {
  ...trombone,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://www.researchgate.net/figure/Spectrum-comparison-of-different-instrument-objects-On-the-left-hand-side-C-Trumpet-C_fig7_225163040
        imag: Float32Array.of(0.0, 0.854, 1.0, 0.91, 0.764, 0.666666, 0.5, 0.236, 0.2, 0.25, 0.146, 0.056, 0.09),
      },
    },
  ],
  highPassFrequency: 55.0,
  lowPassFrequency: 698.46 * 2.0,
  peakingFilters: [
    { frequency: 340, gain: 2.0, Q: 2.0 },
    { frequency: 750, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const tuba = {
  ...frenchHorn,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://www.rickdenney.com/the_tuba_sound.htm
        imag: Float32Array.of(0.0, 0.618, 1.0, 0.5, 0.8, 0.75, 0.7, 0.382, 0.333333, 0.146, 0.056, 0.146, 0.09),
      },
    },
  ],
  highPassFrequency: 36.71,
  lowPassFrequency: 349.23 * 2.0,
  peakingFilters: [
    { frequency: 230, gain: 2.0, Q: 2.0 },
    { frequency: 400, gain: 2.0, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const violin = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://musiccrashcourses.com/lessons/harmonic_series.html
        // https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
        // https://www.rickertmusicalinstruments.com/2017/11/amplified-violins-effects-processors-pickups.html
        // https://www.tremblingsandwarblings.com/2017/04/musical-sound-tone-quality-spectra/
        imag: Float32Array.of(
          0.0,
          1.0,
          0.854,
          0.666666,
          0.5,
          0.618, // 5
          0.382,
          0.414, // 3
          0.382,
          0.3,
          0.09,
          0.146, // 5
          0.124,
          0.146,
          0.124,
          0.146,
          0.034,
          0.056,
          0.09,
          0.005,
          0.09,
          0.034,
        ),
      },
    },
  ],

  glide: 0.003,

  // http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
  attack: 0.09,
  filterAttack: 0.056,
  decay: 0.236,
  filterDecay: 0.236,
  sustain: 1.056,
  filterSustain: 0.854,
  release: 0.146,
  filterRelease: 0.09,

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

/** @type {Instrument} */
export const viola = {
  ...violin,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://musiccrashcourses.com/lessons/harmonic_series.html
        // https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
        // http://www.mathstudio.co.uk/pitch_perception.htm
        // https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1032&context=musicstudent
        imag: Float32Array.of(
          0.0,
          0.854,
          1.0,
          0.666666,
          0.5,
          0.618, // 5
          0.5,
          0.382,
          0.3,
          0.333333, // 5
          0.236,
          0.146, // 3
          0.09,
          0.034,
          0.056,
          0.056,
          0.034,
          0.09,
          0.021,
          0.034,
          0.056,
        ),
      },
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

/** @type {Instrument} */
export const cello = {
  ...viola,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // https://musiccrashcourses.com/lessons/harmonic_series.html
        // https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
        // http://www.mathstudio.co.uk/pitch_perception.htm
        // https://vobarian.com/celloanly/index.html
        imag: Float32Array.of(
          0.0,
          1.0,
          0.666666,
          0.382,
          0.618, // 4
          0.382,
          0.2,
          0.236, // 4
          0.09,
          0.2, // 3
          0.146,
          0.146,
          0.124,
          0.146,
          0.124,
          0.146,
          0.034,
          0.056,
          0.09,
          0.005,
          0.09,
          0.034,
        ),
      },
    },
  ],
  highPassFrequency: 65.4 * 1.6, // strings don't really emit fundamentals under 100 hz
  lowPassFrequency: 1760.0,

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
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // Guessed based on cello
        imag: Float32Array.of(
          0.0,
          1.0,
          0.618,
          0.382,
          0.5, // 4
          0.333333,
          0.146,
          0.236, // 4
          0.09,
          0.146, // 3
          0.09,
          0.09,
          0.056,
          0.09,
          0.056,
          0.09,
          0.021,
          0.034,
          0.056,
          0.003,
          0.056,
          0.021,
        ),
      },
    },
  ],
  highPassFrequency: 41.2 * 1.5, // strings don't really emit fundamentals under 100 hz
  lowPassFrequency: 523.25,

  peakingFilters: [
    { frequency: 70, gain: 3, Q: 3.5 },
    { frequency: 250, gain: 4, Q: 3.5 },
    { frequency: 750, gain: 4, Q: 3.0 },
    { frequency: 1100, gain: 5, Q: 2.0 },
  ],
};

/** @type {Instrument} */
export const piano = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        // Oh dear…
        // https://vibrationresearch.com/resources/overtone-comparison-obserview/
        // https://universe-review.ca/I13-17-timbre.jpg
        // https://www.acs.psu.edu/drussell/Piano/Dynamics.html
        // https://audiouniversityonline.com/why-do-instruments-sound-different/
        // https://www.lamadeguido.com/fundamentos/ecap2.htm
        // https://courses.physics.illinois.edu/phys398dlp/sp2019/documents/pianos_Quantitative%20Analysis%20on%20the%20Tonal%20Quality%20of%20Various%20Pianos.pdf
        // https://www.youtube.com/watch?v=5xjD6SRY8Pg
        // https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00768/full
        imag: Float32Array.of(
          0.0,
          // First 4 are quite high and often in a U shape
          1.0,
          0.854,
          0.618,
          0.764,

          // Then there's a pair arcing up
          0.236,
          0.382,

          // And down
          0.382,
          0.236,

          // And that repeats up to 16
          0.236 * 1.382 * 0.91,
          0.236 * 0.91,
          0.236 * 1.382 * 0.854,
          0.236 * 0.854,
          0.236 * 1.382 * 0.764,
          0.236 * 0.764,
          0.236 * 1.382 * 0.618,
          0.236 * 0.618,

          // Then a gap, and some more?
          0.013,
          0.09,
          0.056,
          0.034,
          0.021,
        ),
      },
      pitchMultiplier: 1.0,
    },
    {
      type: "custom",
      periodicWave: {
        imag: Float32Array.of(0.0, 1.0, 1.0),
        real: Float32Array.of(0.0, -1.0, 1.0),
      },
      gain: 0.034,
      pitchMultiplier: 1.0 / 2.0,

      attack: 0.008,
      decay: 0.013,

      decayImpactOnDuration: 0.0,
      durationImpactOnDecay: 0.0,
    },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.5,
  stretchedTuning: 0.005,

  attack: 0.013,
  filterAttack: 0.008,
  decay: 0.666666,
  filterDecay: 0.618,
  sustain: 0.0,
  release: 0.0,

  highPassFrequency: 27.5 * 4.0, // strings don't really emit fundamentals under 100 hz
  lowPassFrequency: 4186.009,
  highPassPitchTracking: 1.0,
  lowPassPitchTracking: 1.0,

  lowPassQ: 2.236,
  highPassQ: 2.236,
};

/** @type {Instrument} */
export const organ = structuredClone(piano);
organ.lowPassQ = genericInstrument.lowPassQ;
organ.highPassQ = genericInstrument.highPassQ;
organ.stretchedTuning = genericInstrument.stretchedTuning;
organ.oscillators[0].periodicWave.imag = organ.oscillators[0].periodicWave.imag.map((v) => v ** 2.618);

/** @type {Instrument} */
export const hammeredDulcimer = {
  ...genericInstrument,
  oscillators: [
    {
      type: "custom",
      periodicWave: {
        imag: piano.oscillators[0].periodicWave.imag.map((v) => v ** 1.09),
      },
    },
    {
      ...piano.oscillators[1],
      attack: 0.013,
    },
  ],
  decayImpactOnDuration: 1.0,
  durationImpactOnDecay: 0.382,
  stretchedTuning: 0.00125,

  attack: 0.018,
  filterAttack: 0.013,
  decay: 0.666666,
  filterDecay: 0.618,
  sustain: 0.0,
  release: 0.0,

  highPassFrequency: 73.42 * 1.5, // strings don't really emit fundamentals under 100 hz
  lowPassFrequency: 1244.51 * 2.0,
  highPassPitchTracking: 0.0,
  lowPassPitchTracking: 0.618,

  lowPassQ: 2.236,
  highPassQ: 2.236,
};

// String instruments cause sympathetic vibration.
// Using extra oscillators in unison to kind of emulate this.
/** @param {Instrument} instrument */
const addSympatheticStrings = (instrument, gainMultiplier = 0.021, attackOffset = 10.0 / 34300.0) => {
  const mainOscillator = instrument.oscillators[0];
  const gain = (mainOscillator.gain ?? 1.0) * gainMultiplier;
  const attack = mainOscillator.attack ?? instrument.attack;

  instrument.oscillators.push({
    ...mainOscillator,
    attack: attack + attackOffset,
    gain,
    pitchMultiplier: (1.0 / 2.0) * (mainOscillator.pitchMultiplier ?? 1.0),
  });

  instrument.oscillators.push({
    ...mainOscillator,
    attack: attack + attackOffset,
    gain,
    pitchMultiplier: (2.0 / 1.0) * (mainOscillator.pitchMultiplier ?? 1.0),
  });

  return instrument;
};

for (const instrument of [violin, viola, cello, contrabass]) {
  addSympatheticStrings(instrument, 0.034, 5.5 / 34300.0);
}

for (const instrument of [piano, hammeredDulcimer]) {
  addSympatheticStrings(instrument, 0.056, 16.5 / 34300.0);
}

// Plucked versions of string instruments
/** @param {Instrument} instrument */
const makePlucked = (instrument) => {
  const plucked = {
    ...instrument,
    oscillators: [],

    decayImpactOnDuration: 1.0,
    durationImpactOnDecay: 0.236,

    glide: 0.0,
    attack: 0.013,
    filterAttack: 0.013,
    decay: 0.666666,
    filterDecay: 0.618,
    sustain: 0.0,
    filterSustain: 0.0,
    release: 0.0,
    filterRelease: 0.0,

    vibratoEffectOnPitch: 20.0,
    vibratoEffectOnVolume: 0.0,
    vibratoEffectOnLowpass: 0.0,

    lowPassQ: 2.236,
    highPassQ: 2.236,
  };

  for (const oscillator of instrument.oscillators) {
    plucked.oscillators.push({
      ...oscillator,
      glide: undefined,
      attack: undefined,
      decay: undefined,
      sustain: undefined,
      release: undefined,
    });
  }

  return plucked;
};

/** @type {Instrument} */
export const pluckedViolin = makePlucked(violin);

/** @type {Instrument} */
export const pluckedViola = makePlucked(viola);

/** @type {Instrument} */
export const pluckedCello = makePlucked(cello);

/** @type {Instrument} */
export const pluckedContrabass = makePlucked(contrabass);
