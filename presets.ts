import type { InstrumentPreset } from "./Instrument.ts";
import { midiToFrequency } from "./notes.js";

const fluteEnvelope = { attack: 0.056, decay: 0.382, release: 0.124 };
const reedEnvelope = { ...fluteEnvelope, attack: 0.09 };
// TODO: initial pitch instability
const brassEnvelope = { ...reedEnvelope, release: 0.146 };

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://musiccrashcourses.com/lessons/harmonic_series.html
// https://www.youtube.com/watch?v=hfS7mDvrZ7g
export const flute: InstrumentPreset = {
  partials: [[1.0], [0.382], [0.618], [0.146], [0.236], [0.056], [0.09], [0.013], [0.034], [0.005], [0.013], [0.002]],
  ...fluteEnvelope,
  inharmonicity: 0.003,
  formantFrequency: midiToFrequency(69),
};

// https://people.ece.cornell.edu/land/courses/ece5760/FinalProjects/f2011/emr76_jmm536/emr76_jmm536/index.html
// https://www.physicsforums.com/threads/origin-of-harmonics-in-helmholts-type-resonators.799974/
export const ocarina: InstrumentPreset = {
  partials: [
    [1.0, 1],
    [0.034, 3],
    [0.021, 5],
    [0.013, 7],
    [0.008, 9],
  ],
  ...fluteEnvelope,
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://www.youtube.com/watch?v=a0-ysmiQTss
export const oboe: InstrumentPreset = {
  partials: [[0.618], [0.382], [0.764], [1.0], [0.618], [0.236], [0.382], [0.146], [0.056], [0.021], [0.008], [0.003]],
  ...reedEnvelope,
  inharmonicity: 0.008,
  formantFrequency: midiToFrequency(65),
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://koppreeds.com/harmonic.html
export const bassoon: InstrumentPreset = {
  ...oboe,
  partials: [
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
  ],
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
// https://www.youtube.com/watch?v=lhvJUU9Js-U
export const clarinet: InstrumentPreset = {
  partials: [
    [1.0],
    [0.056], // evens are very weak
    [0.618], // odds are strong
    [0.013],
    [0.382],
    [0.034],
    [0.09], // weaker
    [0.021],
    [0.09],
    [0.056, undefined, 2], // oddly strong at start
    [0.056],
    [0.005],
    [0.034],
    [0.002],
  ],
  ...reedEnvelope,
  inharmonicity: 0.018,
  formantFrequency: midiToFrequency(62),
};

// FIXME: saxophone seems to be a very dynamic instrument, so this is probably all off
// https://www.phys.unsw.edu.au/music/saxophone/soprano/Asharp3.html
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-030-15046-4_2/MediaObjects/472011_1_En_2_Fig8_HTML.png
// https://courses.physics.illinois.edu/phys406/sp2017/NSF_REU_Reports/2007_reu/Impedance_Spectrum_for_a_Tenor_Sax_and_a_Bb_Trumpet.pdf
// https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-53507-9_7/MediaObjects/539603_1_En_7_Fig13_HTML.png
// https://www.physics.rutgers.edu/~jackph/2005s/sm_fft/sm_fft.html
// https://newt.phys.unsw.edu.au/jw/inharmonic-resonances.html
export const saxophone: InstrumentPreset = {
  partials: [
    [0.764, undefined, 1.0 / 10.0],
    [1.0, undefined, 1.0 / 11.0],
    [0.618, undefined, 1.0 / 9.0],
    [0.09, undefined, 1.0 / 10.0],
    [0.618, undefined, 1.0 / 9.0],
    [0.236, undefined, 1.0 / 8.0],
    [0.146, undefined, 1.0 / 7.0],
    [0.146, undefined, 1.0 / 6.0],
    [0.09, undefined, 1.0 / 5.0],
    [0.146, undefined, 1.0 / 4.0],
    [0.09, undefined, 1.0 / 3.0],
    [0.056, undefined, 1.0 / 2.0],
    [0.034, undefined, 1.0],
  ],
  ...reedEnvelope,
  inharmonicity: 0.018,
  formantFrequency: midiToFrequency(64),
};

// https://northwoodsoboe.com/the-oboes-overtones-why-does-the-oboe-sound-so-unique/
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trumpet: InstrumentPreset = {
  partials: [
    [0.764, undefined, 1.0 / 11.0],
    [1.0, undefined, 1.0 / 12.0],
    [0.764, undefined, 1.0 / 10.0],
    [0.382, undefined, 1.0 / 9.0],
    [0.382, undefined, 1.0 / 8.0],
    [0.146, undefined, 1.0 / 7.0],
    [0.09, undefined, 1.0 / 6.0],
    [0.056, undefined, 1.0 / 5.0],
    [0.056, undefined, 1.0 / 4.0],
    [0.021, undefined, 1.0 / 3.0],
    [0.013, undefined, 1.0 / 2.0],
    [0.008, undefined, 1.0],
  ],
  ...brassEnvelope,
  formantFrequency: midiToFrequency(67),
};

// https://www.researchgate.net/figure/Power-spectrum-of-flute-trombone-and-their-mixture_fig3_226825024
// http://hyperphysics.phy-astr.gsu.edu/hbase/Music/tromw.html
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const trombone: InstrumentPreset = {
  partials: [
    [0.764, undefined, 1.0 / 10.0],
    [1.0, undefined, 1.0 / 9.0],
    [0.854, undefined, 1.0 / 8.0],
    [0.618, undefined, 1.0 / 7.0],
    [0.236, undefined, 1.0 / 6.0],
    [0.09, undefined, 1.0 / 5.0],
    [0.034, undefined, 1.0 / 4.0],
    [0.013, undefined, 1.0 / 3.0],
    [0.005, undefined, 1.0 / 2.0],
    [0.002, undefined, 1.0 / 1.0],
  ],
  ...brassEnvelope,
  formantFrequency: midiToFrequency(60),
};

// https://www.researchgate.net/figure/Spectrum-comparison-of-different-instrument-objects-On-the-left-hand-side-C-Trumpet-C_fig7_225163040
// https://www.youtube.com/watch?v=2f5TxqlLUEs
export const frenchHorn: InstrumentPreset = {
  partials: [
    [1.0, undefined, 1.0 / 12.0],
    [0.618, undefined, 1.0 / 11.0],
    [0.382, undefined, 1.0 / 10.0],
    [0.236, undefined, 1.0 / 9.0],
    [0.146, undefined, 1.0 / 8.0],
    [0.09, undefined, 1.0 / 7.0],
    [0.056, undefined, 1.0 / 6.0],
    [0.034, undefined, 1.0 / 5.0],
    [0.021, undefined, 1.0 / 4.0],
    [0.013, undefined, 1.0 / 3.0],
    [0.008, undefined, 1.0 / 2.0],
    [0.005, undefined, 1.0],
  ],
  ...brassEnvelope,
  formantFrequency: midiToFrequency(65),
};

// https://www.rickdenney.com/the_tuba_sound.htm
export const tuba: InstrumentPreset = {
  partials: [
    [0.764, undefined, 1.0 / 12.0],
    [0.854, undefined, 1.0 / 11.0],
    [0.764, undefined, 1.0 / 10.0],
    [1.0, undefined, 1.0 / 9.0],
    [0.382, undefined, 1.0 / 8.0],
    [0.618, undefined, 1.0 / 7.0],
    [0.382, undefined, 1.0 / 6.0],
    [0.146, undefined, 1.0 / 5.0],
    [0.056, undefined, 1.0 / 4.0],
    [0.021, undefined, 1.0 / 3.0],
    [0.008, undefined, 1.0 / 2.0],
    [0.003, undefined, 1.0],
  ],
  ...brassEnvelope,
  formantFrequency: midiToFrequency(65),
};

export const cello: InstrumentPreset = {
  partials: [
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
  ],
  attack: 0.09,
  decay: 0.146,
  release: 0.236,
};

export const piano: InstrumentPreset = {
  stretchTuning: 0.01748,
};

export const bell: InstrumentPreset = {
  partials: [
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
  ],
  attack: 0.0,
  decay: 0.001,
  defaultSustain: 0.0,
  release: 0.618,
};
