const constantSources = new WeakMap();
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

export const getNoiseOscillator = (/** @type {AudioContext} */ audioContext) => {
  const noiseSize = 8192;

  /** @type {OscillatorNode} */
  let noiseOscillator = noiseOscillators.get(audioContext);
  if (!noiseOscillator) {
    const imag = new Float32Array(noiseSize);
    const real = new Float32Array(noiseSize);

    for (let index = 0; index < imag.length; index++) {
      imag[index] = Math.random() * 2.0 - 1.0;
      real[index] = Math.random() * 2.0 - 1.0;
    }

    noiseOscillator = new OscillatorNode(audioContext, {
      type: "custom",
      periodicWave: new PeriodicWave(audioContext, { imag, real }),
      frequency: 20000 / noiseSize,
    });

    noiseOscillator.start();
    noiseOscillators.set(audioContext, noiseOscillator);
  }

  return noiseOscillator;
};
