const constantSources = new WeakMap();
const constantMinusSources = new WeakMap();
const noiseOscillators = new WeakMap();

export const getConstantSource = (/** @type {AudioContext} */ audioContext) => {
  /** @type {ConstantSourceNode} */
  let constantSource = constantSources.get(audioContext);
  if (!constantSource) {
    constantSource = new ConstantSourceNode(audioContext);
    constantSource.start();
    constantSources.set(audioContext, constantSource);
  }

  return constantSource;
};

export const getConstantMinusSource = (/** @type {AudioContext} */ audioContext) => {
  /** @type {ConstantSourceNode} */
  let constantMinusSource = constantMinusSources.get(audioContext);
  if (!constantMinusSource) {
    constantMinusSource = new ConstantSourceNode(audioContext, { offset: -1 });
    constantMinusSource.start();
    constantMinusSources.set(audioContext, constantMinusSource);
  }

  return constantMinusSource;
};

export const getNoiseOscillator = (/** @type {AudioContext} */ audioContext) => {
  const noiseSize = 8192;

  /** @type {OscillatorNode} */
  let noiseOscillator = noiseOscillators.get(audioContext);
  if (!noiseOscillator) {
    const imag = new Float32Array(noiseSize);
    const real = new Float32Array(noiseSize);

    for (let index = 0; index < imag.length; index++) {
      const amplitudeDivisor = 1 + (0.005 * index) ** 2; // red?
      // const amplitudeDivisor = 1 + index; // pink?
      imag[index] = (Math.random() * 2.0 - 1.0) / amplitudeDivisor;
      real[index] = (Math.random() * 2.0 - 1.0) / amplitudeDivisor;
    }

    console.log(imag);

    noiseOscillator = new OscillatorNode(audioContext, {
      type: "custom",
      periodicWave: new PeriodicWave(audioContext, { imag, real }),
      frequency: 16000 / noiseSize,
    });

    noiseOscillator.start();
    noiseOscillators.set(audioContext, noiseOscillator);
  }

  return noiseOscillator;
};
