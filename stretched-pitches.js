export const getPianoPitch = (pitch = 440.0, partialIndex = 1, inharmonicity = 1.0) => {
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

  const a = 5.22964 * 10 ** -6;
  const b = 1.21012 * 10 ** -6;
  const c = 8.3666 * 10 ** -10;
  const d = -0.007927;
  const e = 0.429601;

  const inharmonicityCoefficient = a + b * pitch + c * pitch ** 2 + d / pitch + e / pitch ** 2;

  return pitch * (1.0 + 0.5 * (partialIndex ** 2.0 - 1) * inharmonicityCoefficient * inharmonicity);
};

export const getPluckedStringPitch = (pitch = 440.0, partialIndex = 1, inharmonicity = 1.0) => {
  // Guesstimated based on getPianoPitch
  // NOTE: in reality all odd partials should apparently be more inharmonic.
  // Just don't have enough oscillator budget to split them out AND do this kind of ramping inharmonicity.
  const inharmonicityCoefficient = pitch * 0.000001;
  return pitch * (1.0 + 0.5 * (partialIndex ** 2.0 - 1) * inharmonicityCoefficient * inharmonicity);
};
