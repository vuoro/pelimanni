const constantSources = new WeakMap();

/**
  @param {import ("./instrumentPresets.js").Instrument} preset
  @param {AudioContext} audioContext
*/
export const createInstrument = (preset, audioContext) => {
  const {
    oscillators: oscillatorsInPreset,
    vibratoType,
    vibratoEffectOnPitch,
    vibratoEffectOnStage,
    vibratoEffectOnVolume,
    initialInstability,
    formants,
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

  const rangeInCents = 1200.0 * Math.log2(lowPassFrequency / highPassFrequency);

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
  const output = highPassFilter;

  if (formants.length > 0) {
    const formantGain = new GainNode(audioContext, { gain: 0.707 });
    lowPassFilter.connect(formantGain).connect(highPassFilter);

    for (const { frequency, Q = Math.SQRT1_2 } of formants) {
      const formantFilter = new BiquadFilterNode(audioContext, {
        type: "bandpass",
        frequency: frequency,
        Q,
      });

      formantFilter.connect(formantGain);
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
    const gainTarget = gain * (formants.length > 0 ? Math.SQRT1_2 : 1.0);

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

  // TODO: no need for this if there's no vibrato or instability at all?
  const vibratoMain = new OscillatorNode(audioContext, {
    type: vibratoType,
    frequency: 0,
  });

  // Brass-style pitch instability
  let instabilityGain = null;
  if (initialInstability > 0.0) {
    instabilityGain = new GainNode(audioContext, { gain: 0.0 });
    vibratoMain.connect(instabilityGain).connect(crossfader.pan);
  }

  // Brightness vibrato for everyone
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
    rangeInCents,
    output,
    preset,
    previousStartAt: audioContext.currentTime - epsilon,
    previousEndAt: audioContext.currentTime,
    previousPitch: 440.0,
    previousVelocity: 0.5,
    previousAttack: 0.0,
    previousDecay: 0.0,
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
  attackMultiplier = 1.0,
  releaseMultiplier = 1.0,
  volume = 1.0,
  vibratoAmount = 0.0,
  vibratoFrequency = 5.0,
) => {
  attackInstrument(
    instrument,
    pitch,
    at,
    velocity,
    attackMultiplier,
    volume,
    vibratoAmount,
    vibratoFrequency,
  );
  releaseInstrument(instrument, at + duration, releaseMultiplier, true);
};

export const attackInstrument = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ pitch,
  /** @type {number} */ at,
  velocity = 0.5,
  attackMultiplier = 1.0,
  volume = 1.0,
  vibratoAmount = 0.0,
  vibratoFrequency = 5.0,
) => {
  const {
    rangeInCents,
    oscillators,
    crossfader,
    vibratoMain,
    instabilityGain,
    vibratoStageGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    preset,
  } = instrument;

  const {
    initialInstability,
    attack: defaultAttack,
    decay: defaultDecay,
    sustain: defaultSustain,
    glide: defaultGlide,
    overtoneAttack = defaultAttack,
    overtoneDecay = defaultDecay,
    overtoneSustain = defaultSustain,
    highPassFrequency,
    vibratoEffectOnStage,
    vibratoEffectOnPitch,
    vibratoEffectOnVolume,
  } = preset;

  // FIXME: these are repeated in attack and release, but don't need to be in play
  // const fromLowPass = 1200.0 * Math.log2(lowPassFrequency / pitch);
  const fromHighPass = 1200.0 * Math.log2(highPassFrequency / pitch);

  const highPitchness = -fromHighPass / rangeInCents;
  const lowPitchness = 1.0 - highPitchness;

  const strongness = velocity;
  const weakness = 1.0 - strongness;

  const canVibrato = vibratoStageGain || vibratoPitchGain || vibratoVolumeGain;
  const hasVibrato = vibratoAmount > 0.0 && canVibrato;

  const volumeTarget = volume * (1.0 - weakness * 0.146);
  const overtoneTarget = 0.09 + 0.91 * strongness;

  const attackDynamics = (1.0 + 0.382 * lowPitchness) * (1.0 + 0.236 * weakness) * attackMultiplier;

  const defaultDynamicAttack = defaultAttack * attackDynamics;
  const overtoneDynamicAttack =
    overtoneAttack === defaultAttack ? defaultDynamicAttack : overtoneAttack * attackDynamics;

  const vibratoAttack = defaultDynamicAttack * 0.013;
  const vibratoGainAttack = defaultDynamicAttack * 0.056;

  const dynamicStartAt = Math.max(crossfader.context.currentTime, at);

  cancelPendingEvents(instrument, dynamicStartAt);

  // Glide and attack
  crossfader.pan.setTargetAtTime(overtoneTarget, dynamicStartAt, overtoneDynamicAttack);

  for (const {
    oscillatorNode,
    gainNode,
    gainTarget,
    attack = defaultAttack,
    glide = defaultGlide,
    getPitch,
  } of oscillators) {
    const pitchTarget = getPitch(pitch);
    const dynamicAttack = attack === defaultAttack ? defaultDynamicAttack : attack * attackDynamics;

    oscillatorNode.frequency.setTargetAtTime(pitchTarget, dynamicStartAt, glide);
    gainNode.gain.setTargetAtTime(gainTarget * volumeTarget, dynamicStartAt, dynamicAttack);
  }

  // Brass-style instability at start of notes
  let instabilityStopsAt = dynamicStartAt;

  if (initialInstability > 0.0) {
    instabilityStopsAt += defaultDynamicAttack * 4.0;

    const instabilityTarget = 78 + 4 * highPitchness;
    const instabilityEffect = initialInstability;
    const instabilityAttack = defaultDynamicAttack * 0.008;
    const instabilityDecaysAt = Math.min(
      dynamicStartAt + instabilityAttack * 4.0,
      instabilityStopsAt,
    );

    const instabilityGainDecay = (instabilityStopsAt - instabilityDecaysAt) / 3.0;

    vibratoMain.frequency.setTargetAtTime(instabilityTarget, dynamicStartAt, instabilityAttack);
    vibratoMain.frequency.setTargetAtTime(0.0, instabilityStopsAt, instabilityAttack);

    instabilityGain?.gain.setTargetAtTime(instabilityEffect, dynamicStartAt, instabilityAttack);
    instabilityGain?.gain.setTargetAtTime(0.0, instabilityDecaysAt, instabilityGainDecay);
  }

  // Fire up vibrato
  if (hasVibrato) {
    const vibratoAt = instabilityStopsAt + defaultDynamicAttack;
    const vibratoTarget = vibratoFrequency;
    const vibratoStageTarget = vibratoAmount ** 0.5 * vibratoEffectOnStage;
    const vibratoPitchTarget = vibratoAmount * vibratoEffectOnPitch;
    const vibratoVolumeTarget = vibratoAmount * -vibratoEffectOnVolume * volume;

    vibratoMain.frequency.setTargetAtTime(vibratoTarget, vibratoAt, vibratoAttack);
    vibratoStageGain?.gain.setTargetAtTime(vibratoStageTarget, vibratoAt, vibratoGainAttack);
    vibratoPitchGain?.gain.setTargetAtTime(vibratoPitchTarget, vibratoAt, vibratoGainAttack);
    vibratoVolumeGain?.gain.setTargetAtTime(vibratoVolumeTarget, vibratoAt, vibratoGainAttack);
  }

  // Decay and sustain
  const decayAt = dynamicStartAt + defaultDynamicAttack * 4.0;
  const decayDynamics = 1.0 + 0.382 * lowPitchness;

  const oscillatorDecayDynamics = decayDynamics * (1.0 + 0.618 * strongness);
  const defaultDynamicDecay = defaultDecay * oscillatorDecayDynamics;

  const overtonesDecayAt = dynamicStartAt + overtoneDynamicAttack * 4.0;
  const overtoneDecayDynamics = decayDynamics * (1.0 + 0.618 * weakness);
  const overtonesShouldDecay = overtoneDecay > 0.0 && overtoneSustain !== 1.0;

  if (overtonesShouldDecay) {
    const overtoneDynamicDecay = overtoneDecay * overtoneDecayDynamics;

    crossfader.pan.setTargetAtTime(
      overtoneSustain * 2.0 - 1.0,
      overtonesDecayAt,
      overtoneDynamicDecay,
    );
  }

  for (const {
    gainNode,
    gainTarget,
    decay = defaultDecay,
    sustain = defaultSustain,
  } of oscillators) {
    const shouldDecay = decay > 0.0 && sustain !== 1.0;
    if (!shouldDecay) continue;

    const dynamicDecay = decay === defaultDecay ? defaultDecay : decay * oscillatorDecayDynamics;

    gainNode.gain.setTargetAtTime(gainTarget * volume * sustain, decayAt, dynamicDecay);
  }

  instrument.previousStartAt = dynamicStartAt;
  instrument.previousEndAt = Number.POSITIVE_INFINITY;
  instrument.previousPitch = pitch;
  instrument.previousVelocity = velocity;
  instrument.previousAttack = defaultDynamicAttack;
  instrument.previousDecay = defaultDynamicDecay;
};

export const releaseInstrument = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ endAt,
  releaseMultiplier = 1.0,
  releaseEarly = true,
) => {
  const {
    rangeInCents,
    oscillators,
    crossfader,
    vibratoMain,
    instabilityGain,
    vibratoStageGain,
    vibratoPitchGain,
    vibratoVolumeGain,
    preset,
  } = instrument;

  const { release: defaultRelease, overtoneRelease = defaultRelease, highPassFrequency } = preset;

  const pitch = instrument.previousPitch;
  const velocity = instrument.previousVelocity;

  // const fromLowPass = 1200.0 * Math.log2(lowPassFrequency / pitch);
  const fromHighPass = 1200.0 * Math.log2(highPassFrequency / pitch);

  const highPitchness = -fromHighPass / rangeInCents;
  const lowPitchness = 1.0 - highPitchness;

  const strongness = velocity;

  const releaseDynamics =
    (1.0 + 0.382 * lowPitchness) * (1.0 + 0.236 * strongness) * releaseMultiplier;
  const defaultDynamicRelease = defaultRelease * releaseDynamics;

  const overtoneDynamicRelease =
    overtoneRelease === defaultRelease ? defaultDynamicRelease : overtoneRelease * releaseDynamics;

  const vibratoRelease = defaultDynamicRelease * 0.021;
  const vibratoGainRelease = defaultDynamicRelease * 0.09;

  const dynamicEndAt = releaseEarly
    ? Math.max(
        crossfader.context.currentTime,
        instrument.previousStartAt + 0.764 * (endAt - instrument.previousStartAt),
        endAt - defaultDynamicRelease,
      )
    : endAt;

  cancelPendingEvents(instrument, dynamicEndAt);

  crossfader.pan.setTargetAtTime(-1.0, dynamicEndAt, overtoneDynamicRelease);

  for (const { gainNode, release } of oscillators) {
    gainNode.gain.setTargetAtTime(
      0.0,
      dynamicEndAt,
      release !== undefined ? release * releaseDynamics : defaultDynamicRelease,
    );
  }

  vibratoMain.frequency.setTargetAtTime(0.0, dynamicEndAt, vibratoRelease);
  vibratoStageGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);
  vibratoPitchGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);
  vibratoVolumeGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);
  instabilityGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);

  instrument.previousEndAt = releaseEarly ? dynamicEndAt : dynamicEndAt + defaultDynamicRelease;
};

const cancelPendingEvents = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ at,
) => {
  const {
    oscillators,
    crossfader,
    vibratoMain,
    instabilityGain,
    vibratoStageGain,
    vibratoPitchGain,
    vibratoVolumeGain,
  } = instrument;

  crossfader.pan.cancelScheduledValues(at);
  vibratoMain.frequency.cancelScheduledValues(at);
  instabilityGain?.gain.cancelScheduledValues(at);
  vibratoStageGain?.gain.cancelScheduledValues(at);
  vibratoPitchGain?.gain.cancelScheduledValues(at);
  vibratoVolumeGain?.gain.cancelScheduledValues(at);

  for (const { oscillatorNode, gainNode } of oscillators) {
    oscillatorNode.frequency.cancelScheduledValues(at);
    gainNode.gain.cancelScheduledValues(at);
  }
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

  vibratoMain?.stop();
  vibratoMain?.disconnect();
};
