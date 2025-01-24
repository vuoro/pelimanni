const constantSources = new WeakMap();

/**
  @param {import ("./instrumentPresets.js").Instrument} preset
  @param {AudioContext} audioContext
*/
export const createInstrument = (preset, audioContext) => {
  const {
    oscillators: oscillatorsInPreset,
    vibratoType,
    vibratoEffectOnStage,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
    initialInstability,
    peakingFilters,
    lowPassQ = Math.SQRT1_2,
    highPassQ = Math.SQRT1_2,
    lowPassFrequency,
    highPassFrequency,
  } = preset;

  // Filters
  // Useful Q values (no idea exactly what they result in):
  // 2nd-order Butterworth: Qp = Math.SQRT1_2
  // 2nd-order Chebyshev (ripple 1 dB): Qp = 0.9565
  // 2nd-order Thomson-Bessel: Qp=0.5773
  // 4th-order Butterworth: Strage 1: Qp=0.5412; stage 2: Qp=1.3065
  const lowPassFilter = new BiquadFilterNode(audioContext, {
    type: "lowpass",
    frequency: lowPassFrequency,
    Q: lowPassQ,
  });

  const highPassFilter = new BiquadFilterNode(audioContext, {
    type: "highpass",
    frequency: highPassFrequency,
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

  // Crossfader for oscillator stages, adapted from
  // https://tonejs.github.io/docs/15.0.4/classes/CrossFade.html
  /** @type {ConstantSourceNode} */
  let constantSource = constantSources.get(audioContext);
  if (!constantSource) {
    constantSource = new ConstantSourceNode(audioContext);
    constantSource.start();
    constantSources.set(audioContext, constantSource);
  }
  const crossfader = new StereoPannerNode(audioContext, { pan: -1 });
  const crossSplitter = new ChannelSplitterNode(audioContext, { numberOfOutputs: 2 });
  const lowStage = new GainNode(audioContext, { gain: 0 });
  const highStage = new GainNode(audioContext, { gain: 0 });

  constantSource.connect(crossfader).connect(crossSplitter);
  crossSplitter.connect(lowStage.gain, 0);
  crossSplitter.connect(highStage.gain, 1);

  lowStage.connect(lowPassFilter);
  highStage.connect(lowPassFilter);

  // Oscillators
  const oscillators = [];
  const baseVolume = 1.0 / maxPeak ** 0.41421356;
  const randomisedPhase = Math.random() * 2.0 - 1.0;

  for (const {
    type,
    periodicWave,
    gain = 1.0,
    stage = "both",
    attack,
    decay,
    sustain,
    release,
    glide,
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
                periodicWave.real ??
                periodicWave.imag.map((v) => v * randomisedPhase * (1.0 - Math.random() * 0.013)),
            }),
          })
        : new OscillatorNode(audioContext, { type, frequency: 440 });
    const gainNode = new GainNode(audioContext, { gain: 0 });

    const gainTarget = baseVolume * gain;

    oscillatorNode.connect(gainNode);

    if (stage === "low" || stage === "both") gainNode.connect(lowStage);
    if (stage === "high" || stage === "both") gainNode.connect(highStage);

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
      getPitch,
    });
  }

  // Vibrato oscillator (also used for instability and "idle vibrato")
  const idleVibratoFrequency = 12 / 60;
  const idleVibratoStageTarget = 0.056;
  const idleVibratoPitchTarget = 2;
  const idleVibratoVolumeTarget = 0.021 * baseVolume;

  // TODO: no need for this if there's no vibrato or instability at all?
  const vibratoMain = new OscillatorNode(audioContext, {
    type: vibratoType,
    frequency: idleVibratoFrequency,
  });

  // Brass-style pitch instability
  let instabilityGain = null;
  if (initialInstability > 0.0) {
    instabilityGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(instabilityGain).connect(crossfader.pan);
  }

  // Brightness vibrato
  let vibratoStageGain = null;
  if (vibratoEffectOnStage > 0.0) {
    vibratoStageGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(vibratoStageGain).connect(crossfader.pan);
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

  const epsilon = 1.0 / audioContext.sampleRate;

  return {
    epsilon,
    oscillators,
    crossfader,
    vibratoMain,
    instabilityGain,
    vibratoStageGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    lowPassFilter,
    highPassFilter,
    output,
    idleVibratoFrequency,
    idleVibratoStageTarget,
    idleVibratoPitchTarget,
    idleVibratoVolumeTarget,
    preset,
    startedPlayingAt: 0.0,
    willPlayUntil: 0.0,
    previousPitch: 440.0,
  };
};

/**
  @param {Number} pitch
*/
const passPitchThrough = (pitch = 440.0) => pitch;

export const playInstrument = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ pitch,
  /** @type {number} */ at,
  /** @type {number} */ duration,
  velocity = 0.5,
  volume = 1.0,
  vibratoAmount = 0.0,
  vibratoFrequency = 5.0,
) => {
  const {
    oscillators,
    crossfader,
    vibratoMain,
    instabilityGain,
    vibratoStageGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    idleVibratoFrequency,
    idleVibratoStageTarget,
    idleVibratoPitchTarget,
    idleVibratoVolumeTarget,
    preset,
  } = instrument;

  const {
    initialInstability,
    attack: defaultAttack,
    decay: defaultDecay,
    sustain: defaultSustain,
    release: defaultRelease,
    glide: defaultGlide,
    overtoneAttack = defaultAttack,
    overtoneDecay = defaultDecay,
    overtoneSustain = defaultSustain,
    overtoneRelease = defaultRelease,
    lowPassFrequency,
    highPassFrequency,
    vibratoEffectOnStage,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
  } = preset;

  const canVibrato = vibratoStageGain || vibratoPitchGain || vibratoVolumeGain;
  const hasVibrato = vibratoAmount > 0.0 && canVibrato;

  // Frequencies
  const rangeInCents = 1200.0 * Math.log2(lowPassFrequency / highPassFrequency);
  // const fromLowPass = 1200.0 * Math.log2(lowPassFrequency / pitch);
  const fromHighPass = 1200.0 * Math.log2(highPassFrequency / pitch);

  const highPitchness = -fromHighPass / rangeInCents;
  const lowPitchness = 1.0 - highPitchness;

  const strongness = velocity;
  const weakness = 1.0 - strongness;
  const volumeTarget = volume * (1.0 - weakness * 0.146);

  const attackDynamics = (1.0 + 0.236 * 2.0 * lowPitchness) * (1.0 + 0.236 * weakness);
  const releaseDynamics = (1.0 + 0.236 * 2.0 * lowPitchness) * (1.0 - 0.236 * weakness);

  const defaultDynamicAttack = defaultAttack * attackDynamics;
  const defaultDynamicRelease = defaultRelease * releaseDynamics;

  const overtoneDynamicAttack =
    overtoneAttack === defaultAttack ? defaultDynamicAttack : overtoneAttack * attackDynamics;
  const overtoneDynamicRelease =
    overtoneRelease === defaultRelease ? defaultDynamicRelease : overtoneRelease * releaseDynamics;

  const vibratoAttack = defaultDynamicAttack * 0.013;
  const vibratoRelease = defaultDynamicRelease * 0.021;
  const vibratoGainAttack = defaultDynamicAttack * 0.056;
  const vibratoGainRelease = defaultDynamicRelease * 0.09;

  const idleVibratoTarget = idleVibratoFrequency;
  const vibratoTarget = hasVibrato ? vibratoFrequency : idleVibratoTarget;

  const vibratoStageTarget = hasVibrato
    ? vibratoAmount ** 0.5 * vibratoEffectOnStage
    : idleVibratoStageTarget;
  const vibratoPitchTarget = hasVibrato
    ? vibratoAmount * vibratoEffectOnPitch
    : idleVibratoPitchTarget;
  const vibratoVolumeTarget =
    (hasVibrato ? vibratoAmount * -vibratoEffectOnVolume : -idleVibratoVolumeTarget) * volume;

  // Start and end
  const startAt = at;
  const decayAt = startAt + defaultDynamicAttack * 4.0;
  const endAt = at + Math.max(duration * 0.5, duration - defaultDynamicRelease);

  // Cancel pending events
  crossfader.pan.cancelScheduledValues(startAt);
  vibratoMain.frequency.cancelScheduledValues(startAt);
  instabilityGain?.gain.cancelScheduledValues(startAt);

  // Glide and attack
  crossfader.pan.setTargetAtTime(strongness, startAt, overtoneDynamicAttack);

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

    const pitchTarget = getPitch(pitch);
    const dynamicAttack = attack === defaultAttack ? defaultDynamicAttack : attack * attackDynamics;

    oscillatorNode.frequency.setTargetAtTime(pitchTarget, startAt, glide);
    gainNode.gain.setTargetAtTime(gainTarget * volumeTarget, startAt, dynamicAttack);
  }

  // Brass-style instability at start of notes
  let instabilityStopsAt = startAt;

  if (initialInstability > 0.0) {
    instabilityStopsAt += defaultDynamicAttack * 4.0;

    const instabilityTarget = 78 + 4 * highPitchness;
    const instabilityEffect = initialInstability * (0.854 + 0.146 * 2.0 * weakness);
    const instabilityAttack = overtoneDynamicAttack * 0.013;
    const instabilityDecaysAt = Math.min(startAt + instabilityAttack * 4.0, instabilityStopsAt);

    const instabilityGainDecay = instabilityStopsAt - instabilityDecaysAt;

    vibratoMain.frequency.setTargetAtTime(instabilityTarget, startAt, instabilityAttack);
    vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, instabilityStopsAt, instabilityAttack);

    instabilityGain?.gain.setTargetAtTime(instabilityEffect, startAt, instabilityAttack);
    instabilityGain?.gain.setTargetAtTime(0.0, instabilityDecaysAt, instabilityGainDecay);
  }

  // Fire up vibrato: idle or not
  if (canVibrato) {
    const vibratoAt = instabilityStopsAt + defaultDynamicAttack;
    vibratoMain.frequency.setTargetAtTime(vibratoTarget, vibratoAt, vibratoAttack);
    vibratoStageGain?.gain.setTargetAtTime(vibratoStageTarget, vibratoAt, vibratoGainAttack);
    vibratoPitchGain?.gain.setTargetAtTime(vibratoPitchTarget, vibratoAt, vibratoGainAttack);
    vibratoVolumeGain?.gain.setTargetAtTime(vibratoVolumeTarget, vibratoAt, vibratoGainAttack);
  }

  // Decay and sustain
  const decayDynamics = 0.764 + 0.236 * 2.0 * lowPitchness;

  const overtonesDecayAt = startAt + overtoneDynamicAttack * 4.0;
  const overtoneDecayDynamics = decayDynamics * (1.0 + 0.236 * strongness);
  const overtonesShouldDecay =
    overtoneDecay > 0.0 && overtoneSustain !== 1.0 && overtonesDecayAt < endAt;

  if (overtonesShouldDecay) {
    const overtoneDynamicDecay = overtoneDecay * overtoneDecayDynamics;

    crossfader.pan.setTargetAtTime(
      overtoneSustain * 2.0 - 1.0,
      overtonesDecayAt,
      overtoneDynamicDecay,
    );
  }

  const oscillatorDecayDynamics = decayDynamics * (1.0 - 0.236 * weakness);

  for (const {
    gainNode,
    gainTarget,
    decay = defaultDecay,
    sustain = defaultSustain,
  } of oscillators) {
    const shouldDecay = decay > 0.0 && sustain !== 1.0 && decayAt < endAt;
    if (!shouldDecay) continue;

    const dynamicDecay = decay * oscillatorDecayDynamics;

    gainNode.gain.setTargetAtTime(gainTarget * volume * sustain, decayAt, dynamicDecay);
  }

  // Release
  crossfader.pan.setTargetAtTime(-1.0, endAt, overtoneDynamicRelease);

  for (const { gainNode, release } of oscillators) {
    gainNode.gain.setTargetAtTime(
      0.0,
      endAt,
      release !== undefined ? release * releaseDynamics : defaultDynamicRelease,
    );
  }

  vibratoMain.frequency.setTargetAtTime(idleVibratoTarget, endAt, vibratoRelease);
  vibratoStageGain?.gain.setTargetAtTime(0.0, endAt, vibratoGainRelease);
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
