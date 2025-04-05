const constantSources = new WeakMap();
const constantMinusSources = new WeakMap();
const noiseOscillators = new WeakMap();
const attackInstabilityOscillators = new WeakMap();
const varianceOscillators = new WeakMap();
const vibratoVarianceGains = new WeakMap();

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
      // const amplitudeDivisor = 1 + (0.005 * index) ** 2; // red?
      // const amplitudeDivisor = 1 + index; // pink?
      imag[index] = Math.random() * 2.0 - 1.0;
      real[index] = Math.random() * 2.0 - 1.0;
    }

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

export const getAttackInstabilityOscillator = (/** @type {AudioContext} */ audioContext) => {
  /** @type {OscillatorNode} */
  let attackInstabilityOscillator = attackInstabilityOscillators.get(audioContext);
  if (!attackInstabilityOscillator) {
    attackInstabilityOscillator = new OscillatorNode(audioContext, {
      type: "triangle",
      frequency: 80,
    });

    attackInstabilityOscillator.start();
    attackInstabilityOscillators.set(audioContext, attackInstabilityOscillator);
  }

  return attackInstabilityOscillator;
};

export const getVarianceOscillator = (/** @type {AudioContext} */ audioContext) => {
  /** @type {OscillatorNode} */
  let varianceOscillator = varianceOscillators.get(audioContext);
  if (!varianceOscillator) {
    const imag = new Float32Array(2049);

    for (let index = 1.0; index < imag.length; index *= 2.0) {
      imag[index] = 1.0 / index;
    }

    varianceOscillator = new OscillatorNode(audioContext, {
      type: "custom",
      periodicWave: new PeriodicWave(audioContext, { imag }),
      frequency: 0.021,
    });

    varianceOscillator.start();
    varianceOscillators.set(audioContext, varianceOscillator);
  }

  return varianceOscillator;
};

export const getVibratoVarianceGain = (/** @type {AudioContext} */ audioContext) => {
  /** @type {GainNode} */
  let vibratoVarianceGain = vibratoVarianceGains.get(audioContext);
  if (!vibratoVarianceGain) {
    vibratoVarianceGain = new GainNode(audioContext, {
      gain: 236.0,
    });

    const varianceOscillator = getVarianceOscillator(audioContext);
    varianceOscillator.connect(vibratoVarianceGain);

    vibratoVarianceGains.set(audioContext, vibratoVarianceGain);
  }

  return vibratoVarianceGain;
};
