import type { InstrumentPreset } from "./Instrument.ts";
import { midiToFrequency } from "./notes.js";

const addBasicEnvelope = (
  partials: [number, number?, number?, number?][],
  attackSlowness = 1.0,
  releaseSlowness = 1.0,
) => {
  const newPartials: [number, number, number, number][] = [];

  for (let index = 0; index < partials.length; index++) {
    const [amplitude, partialRatio = index + 1.0] = partials[index];

    newPartials[index] = [
      amplitude,
      partialRatio,
      1.0 / (1.0 + attackSlowness * (partialRatio - 1.0 + (1.0 - amplitude))),
      1.0 + (partialRatio - 1.0 + (1.0 - amplitude)) / releaseSlowness,
    ];
  }

  return newPartials;
};

// attack: 1.0,
// decay: 1.618,
// release: 1.618,

// attack: 2.0,
// decay: Math.SQRT2,
// release: 2.0,

const fluteEnvelope = {
  attack: 3.0,
  decay: Math.SQRT2,
  defaultSustain: 0.91,
  release: 3.0,
  defaultDetune: -(2.0 ** -4.0),
};
const reedEnvelope = { ...fluteEnvelope, defaultSustain: 0.854, release: 2.618 };
const brassEnvelope = { ...reedEnvelope, defaultSustain: 0.764, release: 2.618 };

// https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
// http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
const bowedStringEnvelope = {
  attack: 2.0,
  decay: Math.SQRT2,
  release: 2.0,
  defaultSustain: 0.91,
};

// Guitar transients
// https://quod.lib.umich.edu/cgi/p/pod/dod-idx/synthesis-of-transients-in-guitar-sounds.pdf?c=icmc&format=pdf&idno=bbp2372.1997.051
// body tap: 104, ~562 (5.4x), and ~780 (7.5x) hz
const pluckedStringEnvelope = {
  attack: 19.0,
  decay: 19.0,
  release: 2.0,
  defaultSustain: 0.0,
  inharmonicity: 0.0008,
  // transients: [
  //   [0.034, 104, 8.0, 8.0],
  //   [0.021, 562, 8.0, 8.0],
  //   [0.013, 780, 8.0, 8.0],
  // ],
  defaultDetune: 2.0 ** -4.0,
};

const hammeredStringEnvelope = {
  ...pluckedStringEnvelope,
  attack: 18.0,
  decay: 18.0,
  release: 1.0,
  inharmonicity: 0.0008,
  defaultDetune: 2.0 ** -5.0,
};

export const drumEnvelope = {
  attack: 20.0,
  decay: 20.0,
  defaultSustain: 0.0,
  release: 1.618,
  defaultDetune: 2.0 ** -3.0,
};

export const idiophoneEnvelope = {
  attack: 18.0,
  decay: 18.0,
  defaultSustain: 0.0,
  release: 1.618,
  defaultDetune: 2.0 ** -4.0,
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://www.youtube.com/watch?v=hfS7mDvrZ7g
export const flute: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.382],
    [0.618],
    [0.146],
    [0.236],
    [0.056],
    [0.09],
    [0.013],
    [0.034],
    [0.005],
    [0.013],
    [0.002],
  ]),
  ...fluteEnvelope,
  inharmonicity: 0.0003,
  formantFrequency: midiToFrequency(69),
};

// https://people.ece.cornell.edu/land/courses/ece5760/FinalProjects/f2011/emr76_jmm536/emr76_jmm536/index.html
// https://www.physicsforums.com/threads/origin-of-harmonics-in-helmholts-type-resonators.799974/
export const ocarina: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0, 1],
    [0.034, 3],
    [0.021, 5],
    [0.013, 7],
    [0.008, 9],
  ]),
  ...fluteEnvelope,
  inharmonicity: 0.0003,
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://www.youtube.com/watch?v=a0-ysmiQTss
export const oboe: InstrumentPreset = {
  partials: addBasicEnvelope([
    [0.618],
    [0.382],
    [0.764],
    [1.0],
    [0.618],
    [0.236],
    [0.382],
    [0.146],
    [0.056],
    [0.021],
    [0.008],
    [0.003],
  ]),
  ...reedEnvelope,
  inharmonicity: 0.0005,
  formantFrequency: midiToFrequency(65),
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://koppreeds.com/harmonic.html
export const bassoon: InstrumentPreset = {
  ...oboe,
  partials: addBasicEnvelope([
    [0.764],
    [1.0],
    [0.854],
    [0.91],
    [0.618],
    [0.382],
    [0.236],
    [0.146],
    [0.09],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
  ]),
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// https://www.youtube.com/watch?v=lhvJUU9Js-U
export const clarinet: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.056], // evens are very weak
    [0.618], // odds are strong
    [0.013],
    [0.382],
    [0.034],
    [0.09], // weaker
    [0.021],
    [0.09],
    [0.056], // oddly strong at start
    [0.056],
    [0.005],
    [0.034],
    [0.002],
  ]),
  ...reedEnvelope,
  inharmonicity: 0.0008,
  formantFrequency: midiToFrequency(62),
};

// FIXME: saxophone seems to be a very dynamic instrument, so this is probably all off
// https://www.phys.unsw.edu.au/music/saxophone/soprano/Asharp3.html
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-030-15046-4_2/MediaObjects/472011_1_En_2_Fig8_HTML.png
// https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2007_reu/Impedance_Spectrum_for_a_Tenor_Sax_and_a_Bb_Trumpet.pdf
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-53507-9_7/MediaObjects/539603_1_En_7_Fig13_HTML.png
// https://www.physics.rutgers.edu/~jackph/2005s/sm_fft/sm_fft.html
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// export const saxophone: InstrumentPreset = {
//   partials: addBasicEnvelope([
//     [0.764],
//     [1.0],
//     [0.618],
//     [0.09],
//     [0.618],
//     [0.236],
//     [0.146],
//     [0.146],
//     [0.09],
//     [0.146],
//     [0.09],
//     [0.056],
//     [0.034],
//   ], 2.0),
//   ...reedEnvelope,
//   formantFrequency: midiToFrequency(64),
// };

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trumpet: InstrumentPreset = {
  partials: addBasicEnvelope(
    [[0.764], [1.0], [0.764], [0.382], [0.382], [0.146], [0.09], [0.056], [0.056], [0.021], [0.013], [0.008]],
    2.0,
  ),
  ...brassEnvelope,
  formantFrequency: midiToFrequency(67),
};

// https://www.researchgate.net/figure/Power-spectrum-of-flute-trombone-and-their-mixture_fig3_226825024
// http://hyperphysics.phy-astr.gsu.edu/hbase/Music/tromw.html
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trombone: InstrumentPreset = {
  partials: addBasicEnvelope(
    [[0.764], [1.0], [0.854], [0.618], [0.236], [0.09], [0.034], [0.013], [0.005], [0.002]],
    2.0,
  ),
  ...brassEnvelope,
  formantFrequency: midiToFrequency(60),
};

// https://www.researchgate.net/figure/Spectrum-comparison-of-different-instrument-objects-On-the-left-hand-side-C-Trumpet-C_fig7_225163040
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const frenchHorn: InstrumentPreset = {
  partials: addBasicEnvelope(
    [[1.0], [0.618], [0.382], [0.236], [0.146], [0.09], [0.056], [0.034], [0.021], [0.013], [0.008], [0.005]],
    2.0,
  ),
  ...brassEnvelope,
  formantFrequency: midiToFrequency(65),
};

// https://www.rickdenney.com/the_tuba_sound.htm
export const tuba: InstrumentPreset = {
  partials: addBasicEnvelope(
    [[0.764], [0.854], [0.764], [1.0], [0.382], [0.618], [0.382], [0.146], [0.056], [0.021], [0.008], [0.003]],
    2.0,
  ),
  ...brassEnvelope,
  formantFrequency: midiToFrequency(65),
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// https://www.rickertmusicalinstruments.com/2017/11/amplified-violins-effects-processors-pickups.html
// https://www.tremblingsandwarblings.com/2017/04/musical-sound-tone-quality-spectra/
// https://vibrationresearch.com/resources/overtone-comparison-obserview/
// http://psasir.upm.edu.my/id/eprint/3841/1/Time-Varying_Spectral_Modelling_of_the_Solo_Violin_Tone.pdf
export const violin: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.764],
    [0.618],
    [0.236],
    [0.382], // 5
    [0.146],
    [0.236], // 7
    [0.146],
    [0.09],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
    [0.003],
  ]),
  ...bowedStringEnvelope,
  formantFrequency: midiToFrequency(65),
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://digitalcommons.unl.edu/cgi/viewcontent.cgi?article=1032&context=musicstudent
export const viola: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.854],
    [0.382],
    [0.618], // 4
    [0.236],
    [0.236],
    [0.382], // 7
    [0.236],
    [0.146],
    [0.09],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
    [0.003],
  ]),
  ...bowedStringEnvelope,
  formantFrequency: midiToFrequency(69),
};

// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://amath.colorado.edu/pub/matlab/music/MathMusic.pdf
// http://www.mathstudio.co.uk/pitch_perception.htm
// https://vobarian.com/celloanly/index.html
export const cello: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.618],
    [0.382],
    [0.618], // 4
    [0.382],
    [0.09],
    [0.236], // 7
    [0.146],
    [0.09],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
    [0.003],
  ]),
  ...bowedStringEnvelope,
  formantFrequency: midiToFrequency(71),
};

// Guessed based on cello
export const contrabass: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.618],
    [0.382],
    [0.5], // 4
    [0.236],
    [0.09],
    [0.09], // 7
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
    [0.003],
    [0.002],
    [0.001],
  ]),
  ...bowedStringEnvelope,
  formantFrequency: midiToFrequency(60),
};

export const pluckedViolin: InstrumentPreset = {
  ...violin,
  ...pluckedStringEnvelope,
};

export const pluckedViola: InstrumentPreset = {
  ...viola,
  ...pluckedStringEnvelope,
};

export const pluckedCello: InstrumentPreset = {
  ...cello,
  ...pluckedStringEnvelope,
};

export const pluckedContrabass: InstrumentPreset = {
  ...contrabass,
  ...pluckedStringEnvelope,
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
// Piano transients
// https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=624e7d25054fb6f5e9ab864e48f432d7dc5871fd
// initial key noise, finger tap: 290 and 445 Hz, lasts 20–30ms, weak, more audible at low velocity
// later key/hammer noise: 914 hz, 10–20ms attack, strong
// also body, soundboard, and keybed noises: 38, 100 and 250 Hz (xylophone-like?)
export const piano: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0], // First 4 are quite high and often in a U shape
    [0.764],
    [0.382],
    [0.5],
    [0.09], // Then there's a pair arcing up
    [0.146],
    [0.034], // And 7th is weak
    [0.09],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.002],
    [0.005],
    [0.003],
    [0.002],
    [0.001],
    [0.0006],
    [0.0004],
  ]),
  // transients: [
  //   [0.056, 38, 8.0, 8.0],
  //   [0.034, 100, 8.0, 8.0],
  //   [0.021, 250, 8.0, 8.0],
  //   [0.034, 914, 8.0, 8.0],
  // ],
  ...hammeredStringEnvelope,
  formantFrequency: midiToFrequency(60),
};

// Guessed based on piano
// also has the hammer and body noises, but the body noises are probably higher?
export const hammeredDulcimer: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0],
    [0.5],
    [0.382],
    [0.618],
    [0.09],
    [0.146],
    [0.09],
    [0.056],
    [0.056],
    [0.034],
    [0.021],
    [0.013],
    [0.008],
    [0.005],
    [0.003],
    [0.002],
  ]),
  ...hammeredStringEnvelope,
  formantFrequency: midiToFrequency(69),
};

// https://www.youtube.com/watch?v=0_WJbOpG0Fg
export const taikoDrum: InstrumentPreset = {
  partials: addBasicEnvelope([
    [0.618, 1.0],
    [1.0, 2.11],
    [0.618, 2.92],
    [0.236, 3.75],
    [0.146, 4.4],
    [0.09, 5.57],
    [0.056, 7.6],
    [0.034, 8.5],
    [0.021, 9.3],
  ]),
  // transients: [[0.236, 700, 20.0, 16.0]],
  ...drumEnvelope,
};

export const timpani: InstrumentPreset = {
  partials: addBasicEnvelope([
    [0.618, 1.0],
    [1.0, 1.5],
    [0.618, 1.98],
    [0.236, 2.44],
    [0.146, 3.16],
  ]),
  ...drumEnvelope,
};

export const bassDrum: InstrumentPreset = {
  partials: addBasicEnvelope([
    [0.618, 1.0],
    [1.0, 1.86],
    [0.618, 2.72],
    [0.236, 3.64],
    [0.146, 4.5],
    [0.09, 5.46],
  ]),
  ...drumEnvelope,
};

// https://orchestrationonline.com/orchestration-tip-harmonic-spectra-of-xylophone-vs-marimba/
export const marimba: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0, 1.0],
    [0.618, 3.92],
    [0.236, 9.24],
    [0.034, 16.27],
    [0.021, 24.22],
    [0.013, 33.56],
    [0.008, 42.97],
  ]),
  ...idiophoneEnvelope,
};

// https://orchestrationonline.com/orchestration-tip-harmonic-spectra-of-xylophone-vs-marimba/
export const xylophone: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0, 1],
    [0.382, 3],
    [0.5, 5],
    [0.146, 7],
    [0.034, 10.29],
    [0.021, 14.01],
    [0.013, 19.66],
    // Not sure about these
    // [0.5, 6.16],
    // [0.008, 24.02],
  ]),
  ...idiophoneEnvelope,
  release: idiophoneEnvelope.release * 1.618,
};

// Pure idiophone overtones
// [1.0, 1.0],
// [0.618, 2.756],
// [0.382, 5.4],
// [0.618, 8.9],
// [0.382, 13.34],
// [0.236, 18.64],
// [0.146, 31.87],

// https://www.physics.mcgill.ca/~grant/224/19-224.pdf
export const glockenspiel: InstrumentPreset = {
  partials: addBasicEnvelope([
    [1.0, 1.0],
    [0.382, 2.7],
    [0.236, 3.25],
    [0.382, 5.55],
    [0.236, 5.15],
    [0.146, 7.05],
    [0.09, 8],
    [0.056, 8.45],
    [0.034, 10.6],
    [0.021, 11.25],
    [0.013, 12.2],
    [0.008, 13.95],
  ]),
  ...idiophoneEnvelope,
  release: idiophoneEnvelope.release * 0.618,
};

// https://www.hibberts.co.uk/the-upper-partials-of-bells/
export const bell: InstrumentPreset = {
  partials: addBasicEnvelope([
    [0.382, 0.25],
    [0.618, 0.5],
    [0.382, 1.2],
    [0.146, 1.5],
    [1.0, 2.0],
    [0.382, 3.0],
    [0.618, 4.0],
    [0.382, 5.4],
    [0.236, 6.75],
    [0.382, 8],
    [0.236, 16],
    [0.146, 32],
  ]),
  ...idiophoneEnvelope,
  release: idiophoneEnvelope.release * 0.333333,
};

const fractalPartials: [number, number][] = [];

for (let index = 1, gain = 1; index < 9; index *= 2.0, gain /= 2.0) {
  fractalPartials.push([gain, index]);
}

export const fractalPiano: InstrumentPreset = {
  ...piano,
  partials: addBasicEnvelope(fractalPartials),
};

const primes = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109,
  113, 127,
];
const primePartials: [number, number][] = [];
const primelessPartials: [number, number][] = [];

for (let index = 1; index < 16; index++) {
  if (!primes.includes(index)) primelessPartials.push([Math.SQRT2 ** -(index - 1), index]);
}

for (let index = 0; index < primes.length; index++) {
  primePartials.push([Math.exp(-index), primes[index]]);
}

export const primeBell: InstrumentPreset = {
  partials: addBasicEnvelope(primePartials),
  ...idiophoneEnvelope,
  release: idiophoneEnvelope.release * 0.618,
};

export const primelessCello: InstrumentPreset = {
  partials: addBasicEnvelope(primelessPartials),
  ...bowedStringEnvelope,
};

const fibonacciSeries = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
const PHI = (1.0 + Math.sqrt(5.0)) / 2.0;

const fibonacciPartials: [number, number][] = [];
const fibonaccilessPartials: [number, number][] = [];

for (let index = 1; index < 32; index++) {
  if (!fibonacciSeries.includes(index)) fibonaccilessPartials.push([PHI ** -(index - 4), index]);
}

for (let index = 0; index < fibonacciSeries.length; index++) {
  fibonacciPartials.push([(1.0 / PHI) ** (index * 2), fibonacciSeries[index]]);
}

export const fibonacciHarp: InstrumentPreset = {
  partials: addBasicEnvelope(fibonacciPartials),
  ...pluckedStringEnvelope,
};

export const fibonaccilessHorn: InstrumentPreset = {
  partials: addBasicEnvelope(fibonaccilessPartials),
  ...brassEnvelope,
};
