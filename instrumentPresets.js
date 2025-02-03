import { InstrumentPreset, OscillatorPreset } from "./instruments";

const requiredSympatheticStringElements = 3 * 2;
const makeDuller = (v = 1.0) => v ** 2.0;

/** @param {Float32Array} imag */
const addSympatheticStringsToImag = (imag, loudness = 0.09) => {
  const newImag = new Float32Array(imag.length * requiredSympatheticStringElements * 3 + 1);

  for (let index = 1; index < imag.length; index++) {
    const value = imag[index];
    const dulledValue = makeDuller(value);

    newImag[index * requiredSympatheticStringElements * 3] += dulledValue * loudness;
    newImag[index * requiredSympatheticStringElements * 2] += dulledValue * loudness; // higher strings
    newImag[index * requiredSympatheticStringElements] += value; // real string
    newImag[index * requiredSympatheticStringElements * (1 / 2)] += dulledValue * loudness; // lower strings
    newImag[index * requiredSympatheticStringElements * (1 / 3)] += dulledValue * loudness;
  }

  return newImag;
};

const getSympatheticStringPitch = (pitch = 440.0) => pitch / requiredSympatheticStringElements;

/** @param {Partial<OscillatorPreset>} oscillator */
const copySympatheticStrings = (oscillator, loudness = 0.09) => {
  const { gain = 1.0, getPitch } = oscillator;
  const strings = [oscillator];
  const dullerImag = oscillator.imag?.map(makeDuller);

  strings.push({
    ...oscillator,
    imag: dullerImag,
    getPitch: (pitch = 440.0) => (getPitch ? getPitch(pitch) : pitch) * 2.0,
    gain: gain * loudness,
    attackDetune: 0,
  });
  strings.push({
    ...oscillator,
    imag: dullerImag,
    getPitch: (pitch = 440.0) => (getPitch ? getPitch(pitch) : pitch) * 3.0,
    gain: gain * loudness,
    attackDetune: 0,
  });

  strings.push({
    ...oscillator,
    imag: dullerImag,
    getPitch: (pitch = 440.0) => (getPitch ? getPitch(pitch) : pitch) * (1.0 / 2.0),
    gain: gain * loudness,
    attackDetune: 0,
  });
  strings.push({
    ...oscillator,
    imag: dullerImag,
    getPitch: (pitch = 440.0) => (getPitch ? getPitch(pitch) : pitch) * (1.0 / 3.0),
    gain: gain * loudness,
    attackDetune: 0,
  });

  return strings;
};

const inharmonicityPrecision = 512;
const inharmonicityReferenceFrequency = 440.0; // this should vary by note, but oh well
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
  const newImag = new Float32Array(imag.length * inharmonicityPrecision + 1);

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

const windNoiseOscillator = new OscillatorPreset({
  type: "noise",
  noiseQ: 32,
  noiseType: "highpass",
  gain: 0.236 / 32,
  attack: 0.021,
  decay: 0.0034,
  sustain: 0.0,
  release: 0.001,
});

const getDrumNoiseOscillator = (
  detuneOctaves = 2,
  decay = 0.146,
  pitchMultiplier = 2.0,
  noiseQ = 2,
  attack = 0.008,
) =>
  new OscillatorPreset({
    type: "noise",
    noiseType: "lowpass",
    noiseQ,
    gain: 1.618,
    attack,
    decay,
    sustain: 0.0,
    release: 0.0,
    attackDetune: 1200 * detuneOctaves,
    attackDetuneDurationMultiplier: (attack + decay) / attack,
    getPitch: (pitch = 440.0) => pitch * pitchMultiplier,
    // getPitch: (pitch = 440.0) => {
    //   let closestPitch = pitch;

    //   if (pitch < 160.0) {
    //     while (closestPitch < 160.0) {
    //       closestPitch *= 2.0;
    //     }
    //   } else {
    //     while (closestPitch >= 160.0) {
    //       closestPitch *= 0.5;
    //     }
    //   }

    //   return closestPitch;
    // },
  });

const idiophoneNoiseOscillator = new OscillatorPreset({
  type: "noise",
  noiseType: "lowpass",
  noiseQ: 32,
  gain: 1.0 / 32,
  attack: 0.008,
  decay: 0.013,
  sustain: 0.0,
  release: 0.0,
  attackDetune: 100,
});

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://www.youtube.com/watch?v=hfS7mDvrZ7g
export const flute = new InstrumentPreset({
  group: "Woodwinds & flutes",
  oscillators: [
    {
      imag: Float32Array.of(0.0, 1.0, 0.236, 0.146, 0.09),
    },
    {
      imag: Float32Array.of(
        0.0,
        0.0,
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
        0.002,
      ),
      attack: 0.09,
      decay: 0.146,
      release: 0.021,
      velocitySensitivity: -1,
      vibratoEffectOnVolume: 0.382,
    },
    windNoiseOscillator,
  ],

  attack: 0.056,
  decay: 0.236,
  sustain: 1.0,
  release: 0.034,

  highPassFrequency: 261.624,
  lowPassFrequency: 4185.984,

  formants: [{ frequency: 880 }],
});

// https://people.ece.cornell.edu/land/courses/ece5760/FinalProjects/f2011/emr76_jmm536/emr76_jmm536/index.html
// https://www.physicsforums.com/threads/origin-of-harmonics-in-helmholts-type-resonators.799974/
export const ocarina = new InstrumentPreset({
  ...flute,
  oscillators: [
    {
      type: "sine",
    },
    {
      ...flute.oscillators[1],
      imag: stretchOvertones(
        Float32Array.of(0.0, 0.0, 0.0, 0.034, 0.0, 0.021, 0.0, 0.013, 0.0, 0.008),
      ),
      getPitch: getStretchedOvertonesPitchWithoutTuning,
    },
    windNoiseOscillator,
  ],

  highPassFrequency: 261.6,
  lowPassFrequency: 2793.826,
  vibratoEffectOnPitch: 30,
});

// // https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// // https://www.youtube.com/watch?v=a0-ysmiQTss
export const oboe = new InstrumentPreset({
  group: "Woodwinds & flutes",
  oscillators: [
    {
      imag: Float32Array.of(0.0, 0.618, 0.764 * 0.236, 1.0 * 0.236),
    },
    {
      imag: Float32Array.of(
        0.0,
        0.0,
        0.764 * 0.764,
        1.0 * 0.764,
        0.618,
        0.764,
        0.618,
        0.382,
        0.236,
        0.146,
        0.056,
        0.034,
        0.021,
        0.013,
        0.008,
      ),
      attack: 0.09,
      decay: 0.09,
      sustain: 0.854,
      release: 0.021,
      velocitySensitivity: -1,
    },
    windNoiseOscillator,
  ],

  attack: 0.056,
  decay: 0.146,
  sustain: 0.91,
  release: 0.034,

  highPassFrequency: 233.08,
  lowPassFrequency: 2793.83,

  vibratoEffectOnPitch: 30,
  formants: [{ frequency: 1396.91 }, { frequency: 2793.83 }],
});

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://koppreeds.com/harmonic.html
export const bassoon = new InstrumentPreset({
  ...oboe,
  oscillators: [
    {
      imag: Float32Array.of(0.0, 0.764, 1.0 * 0.236, 0.854 * 0.236, 0.91 * 0.236),
    },
    {
      ...oboe.oscillators[1],
      imag: Float32Array.of(
        0.0,
        0.0,
        1.0 * 0.764,
        0.854 * 0.764,
        0.91 * 0.764,
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
      ),
    },
    windNoiseOscillator,
  ],
  highPassFrequency: 58.27,
  lowPassFrequency: 1108.73,
  formants: [{ frequency: 440 }, { frequency: 1108.73 }],
});

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// https://www.youtube.com/watch?v=lhvJUU9Js-U
export const clarinet = new InstrumentPreset({
  group: "Woodwinds & flutes",
  oscillators: [
    {
      imag: stretchOvertones(
        Float32Array.of(
          0.0,
          1.0,
          0.0, // evens are very weak
          0.618 * 0.236, // odds are strong
          0.0,
          0.382 * 0.236,
          0.0,
          0.09 * 0.236, // weaker
          0.0,
          0.0,
          0.056, // oddly strong at start
        ),
      ),
      getPitch: getStretchedOvertonesPitchWithoutTuning,
    },
    {
      imag: stretchOvertones(
        Float32Array.of(
          0.0,
          0.0,
          0.056, // evens are very weak
          0.618 * 0.764, // odds are strong
          0.034,
          0.382 * 0.764,
          0.021,
          0.09 * 0.764, // weaker
          0.013,
          0.146,
          0.008,
          0.09,
          0.005,
          0.056,
          0.003,
          0.034,
        ),
      ),
      getPitch: getStretchedOvertonesPitchWithoutTuning,
      attack: 0.09,
      decay: 0.146,
      sustain: 0.764,
      release: 0.021,
      velocitySensitivity: -1,
    },
    windNoiseOscillator,
  ],

  attack: 0.056,
  decay: 0.236,
  sustain: 0.91,
  release: 0.034,

  highPassFrequency: 164.812,
  lowPassFrequency: 2349.32,
  vibratoEffectOnPitch: 30,
  formants: [{ frequency: 1174.66 }, { frequency: 2349.32 }],
});

// https://www.phys.unsw.edu.au/music/saxophone/soprano/Asharp3.html
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-030-15046-4_2/MediaObjects/472011_1_En_2_Fig8_HTML.png
// https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2007_reu/Impedance_Spectrum_for_a_Tenor_Sax_and_a_Bb_Trumpet.pdf
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-53507-9_7/MediaObjects/539603_1_En_7_Fig13_HTML.png
// https://www.physics.rutgers.edu/~jackph/2005s/sm_fft/sm_fft.html
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// FIXME: this is very terrible
export const saxophone = new InstrumentPreset({
  group: "Woodwinds & flutes",
  oscillators: [
    {
      imag: Float32Array.of(
        0.0,
        0.382, // weak at start
        1.0, // full power already already
        0.146, // notable already
        0.0,
        0.146, // notable already
      ),
    },
    {
      imag: Float32Array.of(
        0.0,
        0.382, // a bit stronger now
        0.0, // already at full power
        0.382, // quite strong now
        0.09, // weak
        0.382, // quite strong now
        0.236, // weak?
        0.146, // weak
        0.146,
        0.09,
        0.146, // weak from here on
        0.09,
        0.056,
        0.034,
      ),
      attack: 0.09,
      decay: 0.146,
      release: 0.09,
      velocitySensitivity: -1,
      attackInstability: 0.09,
    },
  ],

  attackDetune: 30, // FIXME: is this a thing?
  attackDetuneDurationMultiplier: 5.0,

  attack: 0.056,
  decay: 0.236,
  sustain: 0.764,
  release: 0.056,

  highPassFrequency: 69.3,
  lowPassFrequency: 1975.53,
  vibratoEffectOnPitch: 30,
  formants: [{ frequency: 659.25 }, { frequency: 1975.53 }],
});

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trumpet = new InstrumentPreset({
  group: "Brass",
  oscillators: [
    {
      imag: Float32Array.of(
        0.0,
        0.764, // only strong at start
        0.618,
        0.056,
        0.021,
        0.008,
        0.003,
      ),
    },
    {
      imag: Float32Array.of(
        0.0,
        0.0, // only strong at start
        0.382, // strongest at all but low volumes
        0.618, // stronger
        0.382,
        0.382, // stronger
        0.146,
        0.09,
        0.056,
        0.056, // stronger
        0.021,
        0.013,
        0.008,
      ),
      attack: 0.146,
      decay: 0.146,
      sustain: 0.764,
      release: 0.056,
      velocitySensitivity: -1,
      attackInstability: 0.09,
    },
  ],

  attack: 0.056,
  decay: 0.236,
  sustain: 0.854,
  release: 0.09,

  highPassFrequency: 184.996,
  lowPassFrequency: 2349.32,

  vibratoEffectOnPitch: 30,
  formants: [{ frequency: 1174.66 }, { frequency: 2349.32 }],
});

// https://www.researchgate.net/figure/Power-spectrum-of-flute-trombone-and-their-mixture_fig3_226825024
// http://hyperphysics.phy-astr.gsu.edu/hbase/Music/tromw.html
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trombone = new InstrumentPreset({
  ...trumpet,
  oscillators: [
    {
      imag: Float32Array.of(0.0, 0.764, 0.382, 0.236),
    },
    {
      ...trumpet.oscillators[1],
      imag: Float32Array.of(0.0, 0.0, 0.618, 0.618, 0.618, 0.236, 0.09, 0.034, 0.013, 0.005, 0.002),
    },
  ],
  highPassFrequency: 58.27,
  lowPassFrequency: 1046.5,
  formants: [{ frequency: 523.25 }, { frequency: 1046.5 }],
});

// https://www.researchgate.net/figure/Spectrum-comparison-of-different-instrument-objects-On-the-left-hand-side-C-Trumpet-C_fig7_225163040
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const frenchHorn = new InstrumentPreset({
  ...trombone,
  oscillators: [
    {
      imag: Float32Array.of(0.0, 1.0, 0.236, 0.146, 0.09),
    },
    {
      ...trombone.oscillators[1],
      imag: Float32Array.of(
        0.0,
        0.0,
        0.382,
        0.236,
        0.146,
        0.146,
        0.09,
        0.056,
        0.034,
        0.021,
        0.013,
        0.008,
        0.005,
      ),
    },
  ],
  highPassFrequency: 55.0,
  lowPassFrequency: 987.77,
  formants: [{ frequency: 349.23 }, { frequency: 698.46 }],
});

// https://www.rickdenney.com/the_tuba_sound.htm
export const tuba = new InstrumentPreset({
  ...frenchHorn,
  oscillators: [
    {
      imag: Float32Array.of(0.0, 0.764, 0.236, 0.146, 0.618),
    },
    {
      ...frenchHorn.oscillators[1],
      imag: Float32Array.of(
        0.0,
        0.0,
        0.618,
        0.618,
        0.382,
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
      ),
    },
  ],
  highPassFrequency: 36.71,
  lowPassFrequency: 466.16,
  formants: [{ frequency: 233.08 }, { frequency: 349.23 }],
});

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// https://www.rickertmusicalinstruments.com/2017/11/amplified-violins-effects-processors-pickups.html
// https://www.tremblingsandwarblings.com/2017/04/musical-sound-tone-quality-spectra/
// https://vibrationresearch.com/resources/overtone-comparison-obserview/
// http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
const violinLowImag = Float32Array.of(
  0.0,
  1.0,
  0.382,
  0.236,
  0.146,
  0.236, // 5
  0.09,
  0.09, // 7
);
const violinHighImag = Float32Array.of(
  0.0,
  0.0,
  0.382,
  0.382,
  0.146,
  0.382, // 5
  0.09,
  0.236, // 7
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
);

export const violin = new InstrumentPreset({
  group: "Strings (bowed)",
  oscillators: [
    {
      imag: addSympatheticStringsToImag(violinLowImag),
      getPitch: getSympatheticStringPitch,
    },
    {
      imag: addSympatheticStringsToImag(violinHighImag),
      getPitch: getSympatheticStringPitch,
      attack: 0.146,
      sustain: 0.854,
      velocitySensitivity: -1,
    },
  ],

  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
  attack: 0.09,
  decay: 0.146,
  sustain: 1.0,
  release: 0.236,

  highPassFrequency: 174.61,
  lowPassFrequency: 4186.01,

  // FIXME: there should be some of this, but `attackDetuneDurationMultiplier` ends up bad with slow attacks
  // attackDetune: 30,
  // attackDetuneDurationMultiplier: 0.236,

  vibratoEffectOnPitch: 30,
  formants: [
    { frequency: 349.23, Q: 3.450463, gain: 1 + 3 / 6 }, // half wood resonance
    { frequency: 698.46, Q: 3.450463, gain: 1 + 4 / 6 }, // wood resonance
    { frequency: 1046.5, Q: 3.450463, gain: 1 + 4 / 6 }, // air resonance, perfect fifth from the above
    { frequency: 3139.505, Q: Math.SQRT2, gain: 1 + 1 }, // in the middle of double and quadruple air resonance
  ],
});

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1032&context=musicstudent
const violaLowImag = Float32Array.of(
  0.0,
  1.0,
  0.236,
  0.09,
  0.236, // 4
  0.0,
  0.0,
  0.146, // 7
  0.09,
);
const violaHighImag = Float32Array.of(
  0.0,
  0.0,
  0.618,
  0.236,
  0.382, // 4
  0.236,
  0.236,
  0.236, // 7
  0.382,
  0.382,
  0.236,
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
);

export const viola = new InstrumentPreset({
  ...violin,
  oscillators: [
    {
      imag: addSympatheticStringsToImag(violaLowImag),
      getPitch: getSympatheticStringPitch,
    },
    {
      ...violin.oscillators[1],
      imag: addSympatheticStringsToImag(violaHighImag),
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 130.8,
  lowPassFrequency: 2637.02,

  formants: [
    { frequency: 220, Q: 3.5, gain: 1 + 3 / 6 }, // half wood resonance
    { frequency: 440, Q: 3.5, gain: 1 + 4 / 6 }, // wood resonance
    { frequency: 659.25, Q: 3.5, gain: 1 + 4 / 6 }, // air resonance, perfect fifth from the above
    { frequency: 1975.53, Q: Math.SQRT2, gain: 2 }, // in the middle of double and quadruple air resonance
  ],
});

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://vobarian.com/celloanly/index.html
const celloLowImag = Float32Array.of(
  0.0,
  1.0,
  0.236,
  0.146,
  0.236, // 4
  0.146,
  0.0,
  0.09, // 7
);
const celloHighImag = Float32Array.of(
  0.0,
  0.0,
  0.382,
  0.236,
  0.382, // 4
  0.236,
  0.09,
  0.146, // 7
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

export const cello = new InstrumentPreset({
  ...viola,
  oscillators: [
    {
      imag: addSympatheticStringsToImag(celloLowImag),
      getPitch: getSympatheticStringPitch,
    },
    {
      ...viola.oscillators[1],
      imag: addSympatheticStringsToImag(celloHighImag),
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 65.4,
  lowPassFrequency: 2959.96,

  formants: [
    { frequency: 246.94, Q: 3.5, gain: 1 + 3 / 6 }, // half wood resonance
    { frequency: 493.88, Q: 3.5, gain: 1 + 4 / 6 }, // wood resonance
    { frequency: 739.99, Q: 3.5, gain: 1 + 4 / 6 }, // air resonance, perfect fifth from the above
    { frequency: 2217.46, Q: Math.SQRT2, gain: 1 * 2 }, // in the middle of double and quadruple air resonance
  ],
});

// Guessed based on cello
const contrabassLowImag = Float32Array.of(
  0.0,
  1.0,
  0.236,
  0.146,
  0.236, // 4
  0.146,
  0.0,
  0.056, // 7
);
const contrabassHighImag = Float32Array.of(
  0.0,
  0.0,
  0.382,
  0.236,
  0.382, // 4
  0.236,
  0.09,
  0.09, // 7
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
  0.003,
);

export const contrabass = new InstrumentPreset({
  ...cello,
  oscillators: [
    {
      imag: addSympatheticStringsToImag(contrabassLowImag),
      getPitch: getSympatheticStringPitch,
    },
    {
      ...cello.oscillators[1],
      imag: addSympatheticStringsToImag(contrabassHighImag),
      getPitch: getSympatheticStringPitch,
    },
  ],
  highPassFrequency: 41.2,
  lowPassFrequency: 783.99,

  formants: [
    { frequency: 65.41, Q: 3.5, gain: 1 + 3 / 6 }, // half wood resonance
    { frequency: 130.81, Q: 3.5, gain: 1 + 4 / 6 }, // wood resonance
    { frequency: 196, Q: 3.5, gain: 1 + 4 / 6 }, // air resonance, perfect fifth from the above
    { frequency: 587.33, Q: Math.SQRT2, gain: 2 }, // in the middle of double and quadruple air resonance
  ],
});

// Oh dear…
// https://vibrationresearch.com/resources/overtone-comparison-obserview/
// https://universe-review.ca/I13-17-timbre.jpg
// https://www.acs.psu.edu/drussell/Piano/Dynamics.html
// https://audiouniversityonline.com/why-do-instruments-sound-different/
// https://www.lamadeguido.com/fundamentos/ecap2.htm
// https://courses.physics.illinois.edu/phys398dlp/sp2019/documents/pianos_Quantitative%20Analysis%20on%20the%20Tonal%20Quality%20of%20Various%20Pianos.pdf
// https://www.youtube.com/watch?v=5xjD6SRY8Pg
// https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00768/full
// Piano transients
// https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=624e7d25054fb6f5e9ab864e48f432d7dc5871fd
// initial key noise, finger tap: 290 and 445 Hz, lasts 20–30ms, weak, more audible at low velocity
// later key/hammer noise: 914 hz, 10–20ms attack, strong
// also body, soundboard, and keybed noises: 38, 100 and 250 Hz (xylophone-like?)

const pianoLowImag = Float32Array.of(
  0.0,
  // First 4 are quite high and often in a U shape
  1.0,
  0.146,
  0.146,
  0.236,
);

const pianoHighImag = Float32Array.of(
  0.0,
  // First 4 are quite high and often in a U shape
  0.0,
  0.618,
  0.382,
  0.382,
  // Then there's a pair arcing up
  0.146,
  0.236,
  // And down
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

export const piano = new InstrumentPreset({
  group: "Strings (hammered)",
  oscillators: [
    ...copySympatheticStrings(
      {
        imag: stretchOvertones(pianoLowImag),
        getPitch: getStretchedOvertonesPitch,
      },
      0.236,
    ),
    ...copySympatheticStrings(
      {
        imag: stretchOvertones(pianoHighImag),
        getPitch: getStretchedOvertonesPitch,
        attack: 0.018,
        decay: 0.146,
        release: 0.056,
        velocitySensitivity: -1,
      },
      0.236,
    ),
  ],

  attack: 0.008,
  decay: 0.382,
  sustain: 0.0,
  release: 0.09,

  attackDetune: 100,
  attackDetuneDurationMultiplier: 0.236,

  vibratoEffectOnPitch: 30.0, // Fake vibrato
});

// Very much like piano, but less bassy? Dunno really. Sounds a bit like a harp right now.
const hammeredDulcimerLowImag = Float32Array.of(
  0.0,
  // These 4 are quite high and often in a U shape
  0.382,
  0.146,
  0.146,
  0.236,
);

const hammeredDulcimerHighImag = Float32Array.of(
  0.0,
  // These 4 are quite high and often in a U shape
  0.618,
  0.382,
  0.236,
  0.382,
  // Then there's a pair arcing up
  0.146,
  0.236,
  // And down
  0.146,
  0.09,
  0.056,
  0.034,
  0.021,
  0.013,
  0.008,
  0.005,
);

export const hammeredDulcimer = new InstrumentPreset({
  ...piano,
  group: "Strings (hammered)",
  oscillators: [
    ...copySympatheticStrings(
      {
        imag: stretchOvertones(hammeredDulcimerLowImag),
        getPitch: getStretchedOvertonesPitch,
      },
      0.146,
    ),
    ...copySympatheticStrings(
      {
        imag: stretchOvertones(hammeredDulcimerHighImag),
        getPitch: getStretchedOvertonesPitch,
        attack: 0.021,
        decay: 0.146,
        release: 0.09,
        velocitySensitivity: -1,
      },
      0.146,
    ),
  ],

  attack: 0.013,
  decay: 0.382,
  sustain: 0.0,
  release: 0.146,

  attackDetune: 100,
  attackDetuneDurationMultiplier: 0.333333,
});

// https://www.youtube.com/watch?v=0_WJbOpG0Fg
const taikoImag = new Float32Array(20 * 9.3 + 1);
taikoImag[20 * 1] = 0.618;
taikoImag[20 * 2.1] = 1.0; // 2.11
taikoImag[20 * 2.9] = 0.618; // 2.92
taikoImag[20 * 3.75] = 0.236;
taikoImag[20 * 4.4] = 0.146;
taikoImag[20 * 5.6] = 0.09; // 5.57
taikoImag[20 * 7.6] = 0.056;
taikoImag[20 * 8.5] = 0.034;
taikoImag[20 * 9.3] = 0.021;

export const taikoDrum = new InstrumentPreset({
  group: "Percussion (drums)",
  oscillators: [
    {
      imag: taikoImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    getDrumNoiseOscillator(),
  ],

  attack: 0.008,
  decay: 0.146,
  sustain: 0.0,
  release: 0.09,

  attackDetune: 200,
  attackDetuneDurationMultiplier: 0.013 / 0.008,

  highPassFrequency: 38.89,
  lowPassFrequency: 1320, // FIXME: no idea what this should be on any percussion
  vibratoEffectOnPitch: 30.0, // Fake vibrato
});

const timpaniImag = new Float32Array(20 * 3.15 + 1);
timpaniImag[20 * 1] = 0.618;
timpaniImag[20 * 1.5] = 1.0;
timpaniImag[20 * 2.0] = 0.618; // 1.98
timpaniImag[20 * 2.45] = 0.236; // 2.44
timpaniImag[20 * 3.15] = 0.146; // 3.16

export const timpani = new InstrumentPreset({
  ...taikoDrum,
  oscillators: [
    {
      imag: timpaniImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    getDrumNoiseOscillator(),
  ],
});

const bassDrumImag = new Float32Array(20 * 5.45 + 1);
bassDrumImag[20 * 1] = 0.618;
bassDrumImag[20 * 1.85] = 1.0; // 1.86
bassDrumImag[20 * 2.7] = 0.618; // 2.72
bassDrumImag[20 * 3.65] = 0.236; // 3.64
bassDrumImag[20 * 4.5] = 0.146;
bassDrumImag[20 * 5.45] = 0.09; // 5.46

export const bassDrum = new InstrumentPreset({
  ...taikoDrum,
  oscillators: [
    {
      imag: bassDrumImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    getDrumNoiseOscillator(),
  ],
});

const snareImag = new Float32Array(20 * 3.45 + 1);
snareImag[20 * 1] = 0.618;
snareImag[20 * 1.5] = 1.0;
snareImag[20 * 1.8] = 0.618;
snareImag[20 * 2.25] = 0.382;
snareImag[20 * 2.4] = 0.236;
snareImag[20 * 2.85] = 0.146;
snareImag[20 * 3.45] = 0.09;

export const snareDrum = new InstrumentPreset({
  ...taikoDrum,
  oscillators: [
    {
      imag: snareImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    getDrumNoiseOscillator(),
  ],
});

// https://orchestrationonline.com/orchestration-tip-harmonic-spectra-of-xylophone-vs-marimba/
const marimbaLowImag = new Float32Array(20 * 1 + 1);
const marimbaHighImag = new Float32Array(20 * 43 + 1);
marimbaLowImag[20 * 1] = 1.0;
marimbaHighImag[20 * 4] = 0.618; // 3.92
marimbaHighImag[20 * 10] = 0.236; // 9.24
marimbaHighImag[20 * 16] = 0.034; // 16.27
marimbaHighImag[20 * 24] = 0.021; // 24.22
marimbaHighImag[20 * 33.55] = 0.013; // 33.56
marimbaHighImag[20 * 43] = 0.008; // 42.97

export const marimba = new InstrumentPreset({
  group: "Percussion (idiophones)",
  oscillators: [
    {
      imag: marimbaLowImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    {
      imag: marimbaHighImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
      attack: 0.018,
      decay: 0.146,
      release: 0.056,
      velocitySensitivity: -1,
    },
    idiophoneNoiseOscillator,
  ],

  attack: 0.008,
  decay: 0.236,
  sustain: 0.0,
  release: 0.09,

  vibratoEffectOnPitch: 30.0, // Fake vibrato
});

// https://orchestrationonline.com/orchestration-tip-harmonic-spectra-of-xylophone-vs-marimba/
const xylophoneLowImag = new Float32Array(20 * 1 + 1);
const xylophoneHighImag = new Float32Array(20 * 24 + 1);
xylophoneLowImag[20 * 1] = 1.0;
xylophoneHighImag[20 * 3] = 0.382;
xylophoneHighImag[20 * 5] = 0.5;
// xylophoneHighImag[20 * 6] = 0.5; // 6.16
xylophoneHighImag[20 * 7] = 0.146;
xylophoneHighImag[20 * 10] = 0.034; // 10.29
xylophoneHighImag[20 * 14] = 0.021; // 14.01
xylophoneHighImag[20 * 19.65] = 0.013; // 19.66
xylophoneHighImag[20 * 24] = 0.008; // 24.02

export const xylophone = new InstrumentPreset({
  ...marimba,
  oscillators: [
    {
      imag: xylophoneLowImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    {
      ...marimba.oscillators[1],
      imag: xylophoneHighImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
      attack: 0.013,
      decay: 0.09,
    },
    idiophoneNoiseOscillator,
  ],

  decay: 0.146,
});

// Pure idiophone overtones
// imag[20 * 1] = 1.0;
// imag[20 * 2.75] = 0.618; // 2.756
// imag[20 * 5.4] = 0.382;
// imag[20 * 8.9] = 0.618;
// imag[20 * 13.35] = 0.382; // 13.34
// imag[20 * 18.65] = 0.236; // 18.64
// imag[20 * 31.85] = 0.146; // 31.87

// https://www.physics.mcgill.ca/~grant/224/19-224.pdf
const glockenspielLowImag = new Float32Array(20 * 1 + 1);
const glockenspielHighImag = new Float32Array(20 * 32 + 1);
glockenspielLowImag[20 * 1] = 1.0;
glockenspielHighImag[20 * 2.7] = 0.382;
glockenspielHighImag[20 * 3.25] = 0.236;
glockenspielHighImag[20 * 5.55] = 0.382;
glockenspielHighImag[20 * 5.15] = 0.236;
glockenspielHighImag[20 * 7.05] = 0.146;
glockenspielHighImag[20 * 8] = 0.09;
glockenspielHighImag[20 * 8.45] = 0.056;
glockenspielHighImag[20 * 10.6] = 0.034;
glockenspielHighImag[20 * 11.25] = 0.021;
glockenspielHighImag[20 * 12.2] = 0.013;
glockenspielHighImag[20 * 13.95] = 0.008;

export const glockenspiel = new InstrumentPreset({
  ...marimba,
  oscillators: [
    {
      imag: glockenspielLowImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    {
      imag: glockenspielHighImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
      attack: 0.008,
      decay: 0.056,
      release: 0.021,
    },
    idiophoneNoiseOscillator,
  ],

  decay: 0.382,
});

// https://www.hibberts.co.uk/the-upper-partials-of-bells/
const bellLowImag = new Float32Array(20 * 32 + 1);
const bellHighImag = new Float32Array(20 * 32 + 1);
bellHighImag[20 * 0.25] = 0.382;
bellHighImag[20 * 0.5] = 0.618;
bellHighImag[20 * 1.2] = 0.382;
bellHighImag[20 * 1.5] = 0.146;
bellLowImag[20 * 2.0] = 1.0;
bellHighImag[20 * 3.0] = 0.382;
bellHighImag[20 * 4.0] = 0.618;
bellHighImag[20 * 5.4] = 0.382;
bellHighImag[20 * 6.75] = 0.236;
bellHighImag[20 * 8] = 0.382;
bellHighImag[20 * 16] = 0.236;
bellHighImag[20 * 32] = 0.146;

export const bell = new InstrumentPreset({
  ...glockenspiel,
  oscillators: [
    {
      imag: bellLowImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
    },
    {
      ...glockenspiel.oscillators[1],
      imag: bellHighImag,
      getPitch: (pitch = 440.0) => pitch / 20.0,
      decay: 0.382,
    },
    idiophoneNoiseOscillator,
  ],
  decay: 0.5,
});

// Plucked string transients
// https://quod.lib.umich.edu/cgi/p/pod/dod-idx/synthesis-of-transients-in-guitar-sounds.pdf?c=icmc&format=pdf&idno=bbp2372.1997.051
// body tap: 104, ~562 (5.4x), and ~780 (7.5x) hz

const plucked = {
  group: "Strings (plucked)",

  glide: 0.0,
  attack: 0.008,
  decay: 0.236,
  sustain: 0.0,
  release: 0.056,

  attackDetune: 100,
  attackDetuneDurationMultiplier: 0.236,

  vibratoEffectOnPitch: 30.0,
  vibratoEffectOnVolume: 0.0,
  vibratoEffectOnStage: 0.0,
};

const pluckedHighEnvelope = {
  attack: 0.013,
  decay: 0.09,
  sustain: 0.0,
  release: 0.034,
};

export const pluckedViolin = new InstrumentPreset({
  ...violin,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      imag: stretchOvertones(violinLowImag),
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      ...pluckedHighEnvelope,
      imag: stretchOvertones(violinHighImag),
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
});

export const pluckedViola = new InstrumentPreset({
  ...viola,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      imag: stretchOvertones(violaLowImag),
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      ...pluckedHighEnvelope,
      imag: stretchOvertones(violaHighImag),
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
});

export const pluckedCello = new InstrumentPreset({
  ...cello,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      imag: stretchOvertones(celloLowImag),
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      ...pluckedHighEnvelope,
      imag: stretchOvertones(celloHighImag),
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
});

export const pluckedContrabass = new InstrumentPreset({
  ...contrabass,
  ...plucked,
  oscillators: [
    ...copySympatheticStrings({
      imag: stretchOvertones(contrabassLowImag),
      getPitch: getStretchedOvertonesPitch,
    }),
    ...copySympatheticStrings({
      ...pluckedHighEnvelope,
      imag: stretchOvertones(contrabassHighImag),
      getPitch: getStretchedOvertonesPitch,
    }),
  ],
});
