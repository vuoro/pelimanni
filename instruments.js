/**
  @param {import ("./instrumentPresets.js").Instrument} preset
  @param {AudioContext} audioContext
*/
export const createInstrument = (preset, audioContext) => {
  const {
    oscillators: oscillatorsInPreset,
    vibratoType,
    vibratoEffectOnLowPass,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
    initialInstability,
    peakingFilters,
    lowPassQ = Math.SQRT1_2,
    highPassQ = Math.SQRT1_2,
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
    Q: lowPassQ,
  });

  const highPassFilter = new BiquadFilterNode(audioContext, {
    type: "highpass",
    frequency: 440,
    Q: highPassQ,
  });

  lowPassFilter.connect(highPassFilter);

  let output = highPassFilter;
  let maxPeak = 1.0;

  if (peakingFilters.length > 0) {
    for (const { frequency, gain, Q = Math.SQRT1_2 } of peakingFilters) {
      maxPeak = Math.max(maxPeak, gain);
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
  const baseVolume = 1.0 / maxPeak ** 0.41421356;
  const randomisedPhase = Math.random() * 2.0 - 1.0;

  for (const {
    type,
    periodicWave,
    gain = 1.0,
    attack,
    decay,
    sustain,
    release,
    glide,
    decayImpactOnDuration,
    durationImpactOnDecay,
    getPitch = passPitchThrough,
  } of oscillatorsInPreset) {
    const oscillatorNode =
      type === "custom"
        ? new OscillatorNode(audioContext, {
            type,
            frequency: 440,
            periodicWave: new PeriodicWave(audioContext, {
              ...periodicWave,
              // If no cosine terms are given, fill them in, with a random phase offset
              // and some slight randomisation for flavour
              real:
                periodicWave.real ?? periodicWave.imag.map((v) => v * randomisedPhase * (1.0 - Math.random() * 0.013)),
            }),
          })
        : new OscillatorNode(audioContext, { type, frequency: 440 });
    const gainNode = new GainNode(audioContext, { gain: 0 });

    const gainTarget = (baseVolume * gain) ** 0.41421356;

    oscillatorNode.connect(gainNode).connect(lowPassFilter);
    oscillatorNode.start(audioContext.currentTime);
    oscillators.push({
      oscillatorNode,
      gainNode,
      gainTarget,
      attack,
      decay,
      sustain,
      release,
      glide,
      decayImpactOnDuration,
      durationImpactOnDecay,
      getPitch,
    });
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

  return {
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
    startedPlayingAt: 0.0,
    willPlayUntil: 0.0,
    previousPitch: 440.0,
  };
};

/** @param {Number} pitch */
const passPitchThrough = (pitch) => pitch;

export const playInstrument = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ pitch,
  /** @type {number} */ at,
  /** @type {number} */ duration,
  velocity = 1.0,
  volume = 1.0,
  vibratoAmount = 0.0,
  vibratoFrequency = 5.0,
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
    decayImpactOnDuration: defaultDecayImpactOnDuration,
    durationImpactOnDecay: defaultDurationImpactOnDecay,
    initialInstability,
    attack: defaultAttack,
    decay: defaultDecay,
    sustain: defaultSustain,
    release: defaultRelease,
    glide: defaultGlide,
    filterAttack = defaultAttack * 0.618,
    filterDecay = defaultDecay,
    filterSustain = defaultSustain,
    filterRelease = defaultRelease * 0.618,
    lowPassFrequency,
    highPassFrequency,
    highPassPitchTracking,
    lowPassPitchTracking,
    vibratoEffectOnLowPass,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
    stretchedTuning,
  } = preset;

  const hasVibrato = vibratoAmount > 0.0;

  // Frequencies
  const rangeInCents = 1200.0 * Math.log2(lowPassFrequency / highPassFrequency);
  // const fromLowPass = 1200.0 * Math.log2(lowPassFrequency / pitch);
  const fromHighPass = 1200.0 * Math.log2(highPassFrequency / pitch);

  const highPitchness = -fromHighPass / rangeInCents;
  const lowPitchness = 1.0 - highPitchness;
  const relativePitchness = highPitchness * 2.0 - 1.0;

  const highPassTarget =
    highPassPitchTracking < 0.0
      ? highPassFrequency * (1.0 - highPassPitchTracking * lowPitchness) // raises when negative
      : (highPassFrequency * (1.0 + highPassPitchTracking)) / (1.0 + highPassPitchTracking * lowPitchness); // lowers when positive
  const lowPassTarget =
    lowPassPitchTracking < 0.0
      ? lowPassFrequency / (1.0 - lowPassPitchTracking * highPitchness) // lowers when negative
      : (lowPassFrequency / (1.0 + lowPassPitchTracking)) * (1.0 + lowPassPitchTracking * highPitchness); // raises when positive

  const lowPassFilterTarget = 1200.0 * Math.log2(lowPassTarget / pitch);
  const highPassFilterTarget = 1200.0 * Math.log2(highPassTarget / pitch);

  // NOTE: these will only work if the instrument is played sequentially
  const franticness = 0.236 ** Math.max(0.0, at - instrument.willPlayUntil);
  const pitchSameness = 0.333 ** Math.abs(Math.log2(instrument.previousPitch / pitch)) * franticness;
  const pitchDifferentness = 1.0 - pitchSameness;

  const situationalDynamics = 0.91 + 0.09 * 2.0 * pitchDifferentness;
  const dynamicVelocity = velocity * situationalDynamics;
  const dynamicSlowness = 1.0 - dynamicVelocity;
  const glideDynamics = 0.91 + 0.09 * (dynamicSlowness + pitchSameness);
  const volumeTarget = volume * (1.0 - 0.09 * Math.abs(relativePitchness) - dynamicSlowness * 0.09);

  const attackDynamics =
    mix(1.0, duration, 0.146) *
    (0.854 + 0.146 * 2.0 * lowPitchness) *
    (1.0 + 0.146 * dynamicSlowness) *
    situationalDynamics;
  const releaseDynamics =
    mix(1.0, duration, 0.146) *
    (0.854 + 0.146 * 2.0 * lowPitchness) *
    (1.0 - 0.146 * dynamicSlowness) *
    situationalDynamics;

  const defaultDynamicAttack = defaultAttack * attackDynamics;
  const defaultDynamicRelease = defaultRelease * releaseDynamics;

  const filterDynamicGlide = defaultGlide * glideDynamics;
  const filterDynamicAttack = filterAttack * attackDynamics;
  const filterDynamicRelease = filterRelease * releaseDynamics;

  const vibratoAttack = defaultDynamicAttack * 0.09;
  const vibratoRelease = defaultDynamicRelease * 0.09;
  const vibratoGainAttack = defaultDynamicAttack * 0.236;
  const vibratoGainRelease = defaultDynamicRelease * 0.236;

  const idleVibratoTarget = idleVibratoFrequency * situationalDynamics;
  const vibratoTarget = hasVibrato ? vibratoFrequency : idleVibratoTarget;

  const vibratoLowPassTarget = hasVibrato ? vibratoAmount ** 0.5 * vibratoEffectOnLowPass : idleVibratoLowPassTarget;
  const vibratoPitchTarget = hasVibrato ? vibratoAmount * vibratoEffectOnPitch : idleVibratoPitchTarget;
  const vibratoVolumeTarget = (hasVibrato ? vibratoAmount * -vibratoEffectOnVolume : -idleVibratoVolumeTarget) * volume;

  // Start and end
  const startAt = at;
  const decayAt = startAt + defaultDynamicAttack * 4.0;
  let endAt = at + Math.max(duration * 0.618, duration - defaultDynamicRelease);

  const instabilityStopsAt =
    initialInstability > 0.0 ? Math.min(endAt - Number.EPSILON * 2.0, startAt + filterDynamicAttack * 6.0) : startAt;
  const vibratoAt = Math.min(endAt - Number.EPSILON, instabilityStopsAt + defaultDynamicAttack);

  // Cancel pending events
  lowPassFilter.frequency.cancelScheduledValues(startAt);
  highPassFilter.frequency.cancelScheduledValues(startAt);
  lowPassFilter.detune.cancelScheduledValues(startAt);
  highPassFilter.detune.cancelScheduledValues(startAt);
  vibratoMain.frequency.cancelScheduledValues(startAt);
  vibratoLowPassGain?.gain.cancelScheduledValues(startAt);

  // Glide oscillators, and attack amplitudes
  for (const {
    oscillatorNode,
    gainNode,
    gainTarget,
    attack = defaultAttack,
    glide = defaultGlide,
    getPitch,
  } of oscillators) {
    oscillatorNode.frequency.cancelScheduledValues(startAt);
    gainNode.gain.cancelScheduledValues(startAt);

    let pitchTarget = getPitch(pitch);

    if (stretchedTuning !== 0.0) {
      const fromHighPass = 1200.0 * Math.log2(highPassFrequency / pitchTarget);
      const highPitchness = -fromHighPass / rangeInCents;
      const relativePitchness = highPitchness * 2.0 - 1.0;
      pitchTarget *= 1.0 + relativePitchness * stretchedTuning;
    }

    oscillatorNode.frequency.setTargetAtTime(pitchTarget, startAt, glide * glideDynamics);
    gainNode.gain.setTargetAtTime(gainTarget * volumeTarget, startAt, attack * attackDynamics);
  }

  // Glide and attack filters
  lowPassFilter.frequency.setTargetAtTime(pitch, startAt, filterDynamicGlide);
  highPassFilter.frequency.setTargetAtTime(pitch, startAt, filterDynamicGlide);

  lowPassFilter.detune.setTargetAtTime(lowPassFilterTarget, startAt, filterDynamicAttack);
  highPassFilter.detune.setTargetAtTime(highPassFilterTarget, startAt, filterDynamicAttack);

  // Brass-style instability at start of notes
  if (initialInstability > 0.0) {
    const instabilityTarget = 78 + 4 * highPitchness;
    const instabilityEffect = initialInstability * (200.0 + 500.0 * pitchDifferentness);
    const instabilityGlide = 0.001;
    const instabilityDecaysAt = startAt + instabilityGlide * 4.0;

    const instabilityGainDecay = instabilityStopsAt - instabilityDecaysAt;

    vibratoMain.frequency.setTargetAtTime(instabilityTarget, startAt, instabilityGlide);
    vibratoLowPassGain?.gain.setTargetAtTime(instabilityEffect, startAt, instabilityGlide);

    vibratoLowPassGain?.gain.setTargetAtTime(0.0, instabilityDecaysAt, instabilityGainDecay);
    vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, instabilityStopsAt, instabilityGlide);
  }

  // Fire up vibrato: idle or not
  vibratoMain.frequency.setTargetAtTime(vibratoTarget, vibratoAt, vibratoAttack);
  vibratoLowPassGain?.gain.setTargetAtTime(vibratoLowPassTarget, vibratoAt, vibratoGainAttack);
  vibratoPitchGain?.gain.setTargetAtTime(vibratoPitchTarget, vibratoAt, vibratoGainAttack);
  vibratoVolumeGain?.gain.setTargetAtTime(vibratoVolumeTarget, vibratoAt, vibratoGainAttack);

  // Decay and sustain
  const decayDynamics = 0.764 + 0.236 * 2.0 * lowPitchness;
  const decayDuration = endAt - decayAt;
  const decayTarget = decayDuration / 2.0;

  const oscillatorDecayDynamics = decayDynamics * (1.0 - 0.146 * dynamicSlowness);
  const filterDecayDynamics = decayDynamics * (1.0 + 0.146 * dynamicSlowness);

  for (const {
    gainNode,
    gainTarget,
    decay = defaultDecay,
    sustain = defaultSustain,
    durationImpactOnDecay = defaultDurationImpactOnDecay,
    decayImpactOnDuration = defaultDecayImpactOnDuration,
  } of oscillators) {
    const shouldDecay = decay > 0.0 && sustain !== 1.0 && decayAt < endAt;
    if (!shouldDecay) continue;

    const dynamicDecay = mix(decay, decayTarget, durationImpactOnDecay) * oscillatorDecayDynamics;

    if (decayImpactOnDuration > 0.0) endAt = Math.max(endAt, decayAt + dynamicDecay * 4.0 * decayImpactOnDuration);

    gainNode.gain.setTargetAtTime(gainTarget * volume * sustain, decayAt, dynamicDecay);
  }

  const filtersShouldDecay = filterDecay > 0.0 && filterSustain !== 1.0 && decayAt < endAt;

  if (filtersShouldDecay) {
    const filterDynamicDecay = mix(filterDecay, decayTarget, defaultDurationImpactOnDecay) * filterDecayDynamics;
    const lowPassFilterSustainTarget = Math.max(0.0, 1200.0 * Math.log2((lowPassTarget * filterSustain) / pitch));
    const highPassFilterSustainTarget = Math.max(0.0, 1200.0 * Math.log2((highPassTarget * filterSustain) / pitch));

    lowPassFilter.detune.setTargetAtTime(lowPassFilterSustainTarget, decayAt, filterDynamicDecay);
    highPassFilter.detune.setTargetAtTime(highPassFilterSustainTarget, decayAt, filterDynamicDecay);
  }

  // Release
  for (const { gainNode, release = defaultRelease } of oscillators) {
    gainNode.gain.setTargetAtTime(0.0, endAt, release * releaseDynamics);
  }

  lowPassFilter.detune.setTargetAtTime(0.0, endAt, filterDynamicRelease);
  highPassFilter.detune.setTargetAtTime(0.0, endAt, filterDynamicRelease);

  vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, endAt, vibratoRelease);
  vibratoLowPassGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);
  vibratoPitchGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);
  vibratoVolumeGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);

  // Metadata
  instrument.startedPlayingAt = startAt;
  instrument.willPlayUntil = endAt;
  instrument.previousPitch = pitch;
};

/**
  @param {ReturnType<typeof createInstrument>} instrument
*/
export const destroyInstrument = ({ output, oscillators, vibratoMain }) => {
  // TODO: Is this all that's needed?
  // Or do all nodes need to be disconnected?

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
