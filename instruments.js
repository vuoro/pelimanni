/**
  @param {import ("./instrumentPresets.js").Instrument} preset
*/
export const createInstrument = (preset) => {
  return { preset, instances: new Set() };
};

/**
  @param {ReturnType<typeof createInstrument>} instrument
  @param {AudioContext} audioContext
*/
export const createInstance = ({ preset, instances }, audioContext) => {
  const {
    oscillators: oscillatorTypes,
    vibratoType,
    vibratoEffectOnLowPass,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
    initialInstability,
    peakingFilters,
  } = preset;

  // Filters
  // Useful Q values (no idea exactly what they result in):
  // 2nd-order Butterworth: Qp = Math.SQRT1_2
  // 2nd-order Chebyshev (ripple 1 dB): Qp = 0.9565
  // 2nd-order Thomson-Bessel: Qp=0.5773
  // 4th-order Butterworth: Strage 1: Qp=0.5412; stage 2: Qp=1.3065
  const lowPassFilter = new BiquadFilterNode(audioContext, {
    type: "lowpass",
    frequency: 440,
    Q: Math.SQRT1_2,
  });

  const highPassFilter = new BiquadFilterNode(audioContext, {
    type: "highpass",
    frequency: 440,
    Q: Math.SQRT1_2,
  });

  lowPassFilter.connect(highPassFilter);

  let output = highPassFilter;
  let maxPeak = 1.0;

  if (peakingFilters.length > 0) {
    for (const { frequency, gain, Q } of peakingFilters) {
      maxPeak = Math.max(maxPeak, gain ** 0.764);
      const peakFilter = new BiquadFilterNode(audioContext, {
        type: "peaking",
        frequency: frequency,
        Q,
        gain,
      });

      output.connect(peakFilter);
      output = peakFilter;
    }
  }

  // Oscillators
  const oscillators = [];
  const baseVolume = 1.0 / maxPeak;

  for (const { type, pulseWidth = 0.5, pitchMultiplier = 1.0, gain = 1.0, glide = 0.0001 } of oscillatorTypes) {
    const oscillatorNode =
      type === "pulse"
        ? new PulseOscillatorNode(audioContext, { type, pulseWidth, frequency: 440 })
        : new OscillatorNode(audioContext, { type, frequency: 440 });
    const gainNode = new GainNode(audioContext, { gain: 0 });

    let oscillatorBaseVolume = 1.0;
    switch (type) {
      case "pulse": {
        oscillatorBaseVolume = 0.25 + (1.0 - pulseWidth) ** 2.0 * 0.5;
        break;
      }
      case "square": {
        oscillatorBaseVolume = 0.5;
        break;
      }
      case "sawtooth": {
        oscillatorBaseVolume = 0.875;
        break;
      }
    }

    const gainTarget = baseVolume * oscillatorBaseVolume * gain;

    oscillatorNode.connect(gainNode).connect(lowPassFilter);
    oscillatorNode.start(audioContext.currentTime);
    oscillators.push({ oscillatorNode, gainNode, gainTarget, glide, pitchMultiplier });
  }

  // Vibrato oscillator (also used for instability and "idle vibrato")
  const idleVibratoFrequency = 13 / 60;
  const idleVibratoLowPassTarget = 400;
  const idleVibratoPitchTarget = 3;
  const idleVibratoVolumeTarget = 0.021 * baseVolume;

  // TODO: no need for this if there's no vibrato or instability at all?
  const vibratoMain = new OscillatorNode(audioContext, {
    type: vibratoType,
    frequency: idleVibratoFrequency,
  });

  // Low-pass vibrato ("brightness" vibrato)
  let vibratoLowPassGain = null;
  if (vibratoEffectOnLowPass > 0.0 || initialInstability > 0.0) {
    vibratoLowPassGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(vibratoLowPassGain).connect(lowPassFilter.detune);
  }

  // Pitch vibrato
  let vibratoPitchGain = null;
  if (vibratoEffectOnPitch > 0.0) {
    vibratoPitchGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(vibratoPitchGain);

    for (const { oscillatorNode } of oscillators) {
      vibratoPitchGain.connect(oscillatorNode.detune);
    }
  }

  // Volume vibrato ("tremolo")
  let vibratoVolumeGain = null;
  if (vibratoEffectOnVolume > 0.0) {
    vibratoVolumeGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(vibratoVolumeGain);

    for (const { gainNode } of oscillators) {
      vibratoVolumeGain.connect(gainNode.gain);
    }
  }

  vibratoMain.start(audioContext.currentTime);

  const instance = {
    oscillators,
    vibratoMain,
    vibratoLowPassGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    lowPassFilter,
    highPassFilter,
    output,
    idleVibratoFrequency,
    idleVibratoLowPassTarget,
    idleVibratoPitchTarget,
    idleVibratoVolumeTarget,
    preset,
    willPlayUntil: 0,
    previousPitch: 440,
  };

  instances.add(instance);

  return instance;
};

export const playInstance = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ pitch,
  /** @type {number} */ at,
  /** @type {number} */ duration,
  velocity = 1.0,
  volume = 1.0,
  vibratoAmount = 0.0,
) => {
  const {
    oscillators,
    lowPassFilter,
    highPassFilter,
    vibratoMain,
    vibratoLowPassGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    idleVibratoFrequency,
    idleVibratoLowPassTarget,
    idleVibratoPitchTarget,
    idleVibratoVolumeTarget,
    preset,
  } = instrument;

  const {
    decayExtendsDuration,
    initialInstability,
    attack: defaultAttack,
    decay: defaultDecay,
    sustain: defaultSustain,
    release: defaultRelease,
    glide: defaultGlide,
    filterAttack = defaultAttack,
    filterDecay = defaultDecay,
    filterSustain = defaultSustain,
    filterRelease = defaultRelease,
    lowPassFrequency,
    highPassFrequency,
    highPassPitchTracking,
    lowPassPitchTracking,
    baseVibratoFrequency,
    vibratoEffectOnLowPass,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
  } = preset;

  const hasVibrato = vibratoAmount > 0.0;

  const lowPitchness = highPassFrequency / pitch;
  const highPitchness = pitch / lowPassFrequency;
  const longness = 1.0 - 0.382 ** duration;
  const shortness = 1.0 - longness;

  // NOTE: these will only work if the instrument is played sequentially
  const franticness = 0.236 ** Math.max(0.0, at - instrument.willPlayUntil);
  const pitchSameness = 0.034 ** Math.abs(Math.log(pitch) - Math.log(instrument.previousPitch)) * franticness;
  const pitchDifferentness = 1.0 - pitchSameness;

  const situationalDynamics = 0.91 + 0.09 * 2.0 * pitchDifferentness;
  const dynamicVelocity = velocity * situationalDynamics;
  const dynamicSlowness = 1.0 - dynamicVelocity;
  const glideDynamics = 0.91 + 0.09 * (dynamicSlowness + pitchSameness);

  const attackDynamics =
    (0.764 + 0.236 * 3.0 * longness) *
    (0.854 + 0.146 * 2.0 * lowPitchness) *
    (0.854 + 0.146 * 2.0 * dynamicVelocity) *
    situationalDynamics;
  const releaseDynamics =
    (0.764 + 0.236 * 3.0 * longness) *
    (0.854 + 0.146 * 2.0 * lowPitchness) *
    (0.854 + 0.146 * 2.0 * dynamicVelocity) *
    situationalDynamics;

  const defaultDynamicAttack = defaultAttack * attackDynamics;
  const defaultDynamicRelease = defaultRelease * releaseDynamics;

  const filterDynamicAttack = filterAttack * attackDynamics;
  const filterDynamicRelease = filterRelease * releaseDynamics;

  const vibratoAttack = defaultDynamicAttack * 0.09;
  const vibratoRelease = defaultDynamicRelease * 0.09;
  const vibratoGainAttack = defaultDynamicAttack * 0.236;
  const vibratoGainRelease = defaultDynamicRelease * 0.236;

  const highPassTarget = mix(highPassFrequency, pitch, highPassPitchTracking * (1.0 - lowPitchness * lowPitchness));
  const lowPassTarget = mix(lowPassFrequency, pitch, lowPassPitchTracking * (1.0 - highPitchness * highPitchness));

  const idleVibratoTarget = idleVibratoFrequency * situationalDynamics;
  const vibratoTarget = hasVibrato
    ? baseVibratoFrequency * (0.8 + highPitchness * dynamicVelocity * 0.4)
    : idleVibratoTarget;

  const vibratoLowPassTarget = hasVibrato ? vibratoAmount ** 0.5 * vibratoEffectOnLowPass : idleVibratoLowPassTarget;
  const vibratoPitchTarget = hasVibrato ? vibratoAmount * vibratoEffectOnPitch : idleVibratoPitchTarget;
  const vibratoVolumeTarget = (hasVibrato ? vibratoAmount * -vibratoEffectOnVolume : -idleVibratoVolumeTarget) * volume;

  // Start and end
  const startAt = Math.max(0.0, at - defaultDynamicAttack * 0.146);
  const decayAt = startAt + defaultDynamicAttack * 4.0;
  let endAt = at + Math.max(duration * 0.618, duration - defaultDynamicRelease);

  const instabilityStopsAt =
    initialInstability > 0.0
      ? Math.min(endAt - Number.EPSILON * 2.0, startAt + filterDynamicAttack * 4.0 * pitchDifferentness ** 0.382)
      : startAt;
  const vibratoAt = Math.min(endAt - Number.EPSILON, instabilityStopsAt + defaultDynamicAttack);

  const shouldDecay = defaultDecay > 0.0 && defaultSustain !== 1.0 && decayAt < endAt;

  // Cancel pending events
  lowPassFilter.frequency.cancelScheduledValues(startAt);
  highPassFilter.frequency.cancelScheduledValues(startAt);
  vibratoMain.frequency.cancelScheduledValues(startAt);
  vibratoLowPassGain?.gain.cancelScheduledValues(startAt);

  for (const {
    oscillatorNode,
    gainNode,
    gainTarget,
    attack = defaultAttack,
    glide = defaultGlide,
    pitchMultiplier,
  } of oscillators) {
    oscillatorNode.frequency.cancelScheduledValues(startAt);
    gainNode.gain.cancelScheduledValues(startAt);

    // and also fire up oscillators
    oscillatorNode.frequency.setTargetAtTime(pitch * pitchMultiplier, startAt, glide * glideDynamics);
    gainNode.gain.setTargetAtTime(gainTarget * volume, startAt, attack * attackDynamics);
  }

  // Fire up filters
  lowPassFilter.frequency.setTargetAtTime(lowPassTarget, startAt, filterAttack);
  highPassFilter.frequency.setTargetAtTime(highPassTarget, startAt, filterAttack);

  // Brass-style instability at start of notes
  if (initialInstability > 0.0) {
    const instabilityTarget = 78 + 4 * highPitchness;
    // TODO: maybe this should be (lowPassTarget - pitch), in cents?
    const instabilityEffect = initialInstability * 600 * pitchDifferentness ** 0.5;

    vibratoMain.frequency.setTargetAtTime(instabilityTarget, startAt, vibratoAttack);
    vibratoLowPassGain?.gain.setTargetAtTime(instabilityEffect, startAt, vibratoGainAttack);

    vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, instabilityStopsAt, 0.001);
    vibratoLowPassGain?.gain.setTargetAtTime(0.0, instabilityStopsAt, 0.001);
  }

  // Fire up vibrato: idle or not
  vibratoMain.frequency.setTargetAtTime(vibratoTarget, vibratoAt, vibratoAttack);
  vibratoLowPassGain?.gain.setTargetAtTime(vibratoLowPassTarget, vibratoAt, vibratoGainAttack);
  vibratoPitchGain?.gain.setTargetAtTime(vibratoPitchTarget, vibratoAt, vibratoGainAttack);
  vibratoVolumeGain?.gain.setTargetAtTime(vibratoVolumeTarget, vibratoAt, vibratoGainAttack);

  // Decay if needed
  if (shouldDecay) {
    const decayDynamics = mix(
      (0.854 + 0.146 * 2.0 * lowPitchness) * (0.854 + 0.146 * 2.0 * dynamicSlowness),
      (endAt - decayAt) * 0.333333,
      0.333333,
    );

    const sustainDynamics = 1.0 + (lowPitchness - highPitchness + longness - shortness) * 0.236;

    // Oscillators
    for (const { gainNode, gainTarget, decay = defaultDecay, sustain = defaultSustain } of oscillators) {
      const dynamicDecay = decay * decayDynamics;
      if (decayExtendsDuration) endAt = Math.max(endAt, decayAt + dynamicDecay * 3.0);

      gainNode.gain.setTargetAtTime(gainTarget * volume * sustain ** sustainDynamics, decayAt, dynamicDecay);
    }

    // Filters
    const filterDynamicDecay = filterDecay * decayDynamics * (1.146 - 0.382 * dynamicVelocity);
    const filterDynamicSustain = filterSustain * sustainDynamics;

    lowPassFilter.frequency.setTargetAtTime(
      mix(pitch, lowPassTarget, filterDynamicSustain),
      decayAt,
      filterDynamicDecay,
    );
    highPassFilter.frequency.setTargetAtTime(
      mix(pitch, highPassTarget, filterDynamicSustain),
      decayAt,
      filterDynamicDecay,
    );
  }

  // Release
  for (const { gainNode, release = defaultRelease } of oscillators) {
    gainNode.gain.setTargetAtTime(0.0, endAt, release * releaseDynamics);
  }

  lowPassFilter.frequency.setTargetAtTime(pitch, endAt, filterDynamicRelease);
  highPassFilter.frequency.setTargetAtTime(pitch, endAt, filterDynamicRelease);

  vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, endAt, vibratoRelease);
  vibratoLowPassGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);
  vibratoPitchGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);
  vibratoVolumeGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);

  // Metadata
  instrument.willPlayUntil = endAt;
  instrument.previousPitch = pitch;
};

/**
  @param {ReturnType<typeof createInstance>} instance
  @param {ReturnType<typeof createInstrument>} instrument
*/
export const destroyInstance = (instance, instrument) => {
  instrument.instances.delete(instance);

  // TODO: Is this all that's needed?
  // Or do all nodes need to be disconnected?
  const { output, oscillators, vibratoMain } = instance;

  output.disconnect();
  for (const { oscillatorNode } of oscillators) {
    oscillatorNode.stop();
    oscillatorNode.disconnect();
  }
  vibratoMain.stop();
  vibratoMain.disconnect();
};

function mix(a = 0.0, b = 1.0, amount = 0.5) {
  return a + amount * (b - a);
}

class PulseOscillatorNode extends OscillatorNode {
  /**
    @param {AudioContext} audioContext
  */
  constructor(audioContext, options = {}) {
    super(audioContext, { ...options, type: "triangle" });

    const width = options?.pulseWidth || 0.25;
    const roundedWidth = Math.round(width * 256);

    const curve = new Float32Array(256);
    curve.fill(-1, 0, roundedWidth);
    curve.fill(1, roundedWidth);

    this.waveShaper = new WaveShaperNode(audioContext, { curve, oversample: "none" });
    super.connect(this.waveShaper);
  }

  // FIXME: dunno how to type these bloody things correctly
  // using .call instead didn't seem to work, because args were not truly undefined?
  /** @param {Parameters<WaveShaperNode["connect"]>} args */
  connect(...args) {
    return this.waveShaper.connect.apply(this.waveShaper, args);
  }

  /** @param {Parameters<WaveShaperNode["disconnect"]>} args */
  disconnect(...args) {
    return this.waveShaper.disconnect.apply(this.waveShaper, args);
  }
}
