// Heaven's Tower from Final Fantasy XI OST
// Original by Naoshi Mizuta / Square Enix
// This is an adaptation based on https://musescore.com/user/31948143/scores/6465415

import { cello, contrabass, hammeredDulcimer, pluckedViola, viola, violin } from "../instrumentPresets.js";

export const heavensTower = () => {
  const cycle = (60.0 / 70.0 / 2.0) * 8.0;

  const x = null;
  const e = undefined;
  const alternate = true;
  const chord = true;

  const rhythm = [9, 14, 16, 14, 21, 14, 16, 14];

  const a7_14 = [7, 14, { alternate, vibrato: 0.5 }];
  const plinkingMelody = [[2, 7, 9, e, 2, 7, 9, e], [9, 12, 14, 16, 9, 12, a7_14, [e, e, x]], { alternate }];

  const midHarmony = [
    [17, 12, { chord }],
    e,
    [19, [12, x, x, x, x, x, { alternate }], [14, 16, 14, 14, 16, 16, { alternate }], { chord }],
    e,
    { alternate },
  ];

  const lowHarmony = [10, e, 9, e, { alternate }];

  const highHarmony = [
    [
      0,
      [2, e, e, e, e, e, e, 4],
      [5, e, e, 4, 5, e, e, e],
      [e, e, e, e, e, e, e, 7],
      [9, e, e, e, e, e, e, 7],
      9,
      [e, e, e, 11, 11, e, e, e],
      12,
      { alternate },
    ],
    { chord },
  ];

  const a8_7 = [8, 7, { alternate }];
  const vl9 = [9, { vibrato: 0.764 }];
  const a2_242 = [2, [2, 4, 2], { alternate, vibrato: 0.5 }];
  const v12 = [12, { vibrato: 0.764 }];
  const v11 = [11, { vibrato: 0.764 }];
  const v4 = [4, { vibrato: 0.5 }];
  const v2 = [2, { vibrato: 0.5 }];
  const v0 = [0, { vibrato: 0.382 }];

  const melody = [
    [[a8_7, vl9], e, e, e, e, e, e, e],
    [a2_242, e, e, e, e, e, e, [4, 5]],
    [[[5, 7], e, [10, v12], e, e, e, v11, [e, 12]], [[4, 5, v4], e, e, e, e, e, e, [v2, e, e, 4]], { alternate }],
    [[[11, vl9], e, e, e, e, e, e, [5, 7]], [[2, v0], e, e, e, e, e, e, e], { alternate }],
    { alternate },
  ];

  const tracks = [
    [pluckedViola, [...rhythm, { transpose: 0, volume: 0.236, velocity: 0.5 }]],
    [hammeredDulcimer, [...plinkingMelody, { transpose: -12, volume: 0.146 }]],
    [violin, [...melody, { transpose: 12, volume: 0.2 }]],
    [viola, [...highHarmony, { transpose: 0, volume: 0.146 }]],
    [cello, [...midHarmony, { transpose: -12, volume: 0.09 }]],
    [contrabass, [...lowHarmony, { transpose: -12, volume: 0.09 }]],
  ];

  return { tracks, cycle };
};
