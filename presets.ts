import type { InstrumentPreset } from "./Instrument.ts";

export const flute: InstrumentPreset = {
  partials: [
    [1, 1.0, 1],
    [2, 0.382, 1 / 4],
    [3, 0.618, 1 / 3],
    [4, 0.146, 1 / 8],
    [5, 0.236, 1 / 5],
    [6, 0.056, 1 / 6],
    [7, 0.09, 1 / 7],
    [8, 0.013, 1 / 8],
    [9, 0.034, 1 / 9],
    [10, 0.005, 1 / 10],
    [11, 0.013, 1 / 11],
    [12, 0.002, 1 / 12],
  ],
  attack: 0.021,
  decay: 0.146,
  release: 0.056,
};

export const cello: InstrumentPreset = {
  partials: [
    [1, 1.0],
    [2, 0.618],
    [3, 0.382],
    [4, 0.618], // 4
    [5, 0.382],
    [6, 0.09],
    [7, 0.236], // 7
    [8, 0.146],
    [9, 0.09],
    [10, 0.056],
    [11, 0.034],
    [12, 0.021],
    [13, 0.013],
    [14, 0.008],
    [15, 0.005],
    [16, 0.003],
  ],
  attack: 0.09,
  decay: 0.146,
  release: 0.382,
};

export const piano: InstrumentPreset = {
  stretchTuning: 0.01748,
};

export const bell: InstrumentPreset = {
  partials: [
    [0.25, 0.382],
    [0.5, 0.618],
    [1.2, 0.382],
    [1.5, 0.146],
    [2.0, 1.0],
    [3.0, 0.382],
    [4.0, 0.618],
    [5.4, 0.382],
    [6.75, 0.236],
    [8, 0.382],
    [16, 0.236],
    [32, 0.146],
  ],
  attack: 0.0,
  decay: 0.001,
  defaultSustain: 0.0,
  release: 0.854,
};
