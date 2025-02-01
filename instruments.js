import { getNoiseOscillator } from "./sources.js";

export class InstrumentPreset {
  group = "Miscellaneous";

  /** @type {OscillatorPreset[]} the oscillators that create the sound of the instrument. */
  oscillators = [];

  /** a `timeConstant` for how long the note takes to "fade in"; values below ~0.008 hurt a bit */
  attack = 0.008;
  /** a `timeConstant` for how long before the note reaches the `sustain` level after finishing its `attack` */
  decay = 0.0;
  /** a `timeConstant` for how loud the note after it has fully decayed */
  sustain = 0.0;
  /** a `timeConstant` for how long the note takes to "fade out" */
  release = 0.0;
  /** a `timeConstant` for how slowly the oscillator moves to new frequencies */
  glide = 0.0001;

  /** @type {number} determines how strongly the oscillator's dynamics respond to different velocities */
  velocitySensitivity = 1.0;

  /** @type {OscillatorType} the type of the oscillator used for vibrato and attackInstability */
  vibratoType = "triangle";

  /** @type {number} how much vibrato should affect the note frequency (in cents) */
  vibratoEffectOnPitch = 0.0;
  /** @type {number} how much vibrato should affect volume (in gain) */
  vibratoEffectOnVolume = 0.0;
  /** @type {number} amount of brass instrument style initial note vibration: causes the "braaap" */
  attackInstability = 0.0;

  /** @type {number} detunes oscillator by this many cents * velocity */
  attackDetune = 0.0;
  /** @type {number} multiplies `attack` to get the duration of `attackDetune` */
  attackDetuneDurationMultiplier = 1.0;

  // Values mostly from these sources:
  // http://hyperphysics.phy-astr.gsu.edu/hbase/Music/orchins.html
  // https://alexiy.nl/eq_chart/
  // https://www.soundonsound.com/techniques/practical-bowed-string-synthesis
  // https://euphonics.org/5-3-signature-modes-and-formants/
  // https://sengpielaudio.com/VowelDiagram.htm
  /** @type {number} applies to a lowpass filter at this frequency */
  lowPassFrequency = 4186.009 * 1.059463;
  /** @type {number} applies a highpass filter at this frequency */
  highPassFrequency = 27.5 * 0.943874;

  /** @type {number} the resonance or "Q factor" of the lowpass filter */
  lowPassQ = Math.SQRT1_2;
  /** @type {number} the resonance or "Q factor" of the highpass filter */
  highPassQ = Math.SQRT1_2;

  /** @type {FormantFilterPreset[]} */
  formants = [];

  /**
   * @param {Partial<Omit<InstrumentPreset, "oscillators" | "formants">> & {oscillators?: Partial<OscillatorPreset>[], formants?: Partial<FormantFilterPreset>[]}} instrumentProps
   */
  constructor({ oscillators, formants, ...props }) {
    Object.assign(this, props);

    if (oscillators) {
      for (const oscillator of oscillators) {
        this.oscillators.push(new OscillatorPreset(oscillator));
      }
    }

    if (formants) {
      for (const formant of formants) {
        this.formants.push(new FormantFilterPreset(formant));
      }
    }
  }
}

/** A `peaking` filter applied to the instrument to shape its timbre. The instrument's overall volume will be automatically lowered to compensate. */
export class FormantFilterPreset {
  frequency = 440;
  Q = 2.456424;
  gain = 1.618;

  constructor(/** @type {Partial<FormantFilterPreset>} */ props) {
    Object.assign(this, props);
  }
}

export class OscillatorPreset {
  /** @type {OscillatorType | "noise"} */
  type = "custom";
  /** @type {PeriodicWaveOptions["imag"]=} used for custom oscillators */
  imag = undefined;
  /** @type {PeriodicWaveOptions["real"]=} used for custom oscillators */
  real = undefined;
  /** @type {number} base volume of the oscillator */
  gain = 1.0;

  /** @type {InstrumentPreset["attack"]=} */
  attack = undefined;
  /** @type {InstrumentPreset["decay"]=} */
  decay = undefined;
  /** @type {InstrumentPreset["sustain"]=} */
  sustain = undefined;
  /** @type {InstrumentPreset["release"]=} */
  release = undefined;
  /** @type {InstrumentPreset["glide"]=} */
  glide = undefined;

  /** @type {InstrumentPreset["velocitySensitivity"]=} */
  velocitySensitivity = undefined;

  /** @type {InstrumentPreset["vibratoEffectOnPitch"]=} */
  vibratoEffectOnPitch = undefined;
  /** @type {InstrumentPreset["vibratoEffectOnVolume"]=} */
  vibratoEffectOnVolume = undefined;
  /** @type {InstrumentPreset["attackInstability"]=} */
  attackInstability = undefined;

  /** @type {InstrumentPreset["attackDetune"]=} */
  attackDetune = undefined;
  /** @type {InstrumentPreset["attackDetuneDurationMultiplier"]=} */
  attackDetuneDurationMultiplier = undefined;

  /** @type {BiquadFilterType} used when `type` is "noise": determines the type of filter used to filter the noise */
  noiseType = "lowpass";
  /** @type {number} used when `type` is "noise": sets the Q factor of the noise filter */
  noiseQ = Math.SQRT1_2;

  /** lets you modify the pitch before it gets played */
  getPitch(pitch = 440.0, _velocity = 1.0) {
    return pitch;
  }

  /** @param {Partial<OscillatorPreset>} props */
  constructor(props) {
    Object.assign(this, props);
  }
}

export const createInstrument = (
  /** @type {InstrumentPreset} */ preset,
  /** @type {AudioContext}*/ audioContext,
) => {
  const {
    oscillators: oscillatorsInPreset,
    vibratoType,
    vibratoEffectOnPitch: defaultVibratoEffectOnPitch,
    vibratoEffectOnVolume: defaultVibratoEffectOnVolume,
    attackInstability: defaultattackInstability,
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

  const input = lowPassFilter;
  let output = input;
  let maxPeak = 1.0;

  if (formants.length > 0) {
    for (const { frequency, Q = 2.456424, gain = 1.618 } of formants) {
      const formantFilter = new BiquadFilterNode(audioContext, {
        type: "peaking",
        frequency: frequency,
        Q,
        gain,
      });

      output.connect(formantFilter);
      output = formantFilter;

      maxPeak = Math.max(maxPeak, gain);
    }
  }

  output.connect(highPassFilter);
  output = highPassFilter;

  // Vibrato effects
  let canVibrato = false;

  const vibratoMain = new OscillatorNode(audioContext, {
    type: vibratoType,
    frequency: 0,
  });

  vibratoMain.start(audioContext.currentTime);

  // Oscillators
  const oscillators = [];
  const randomisedPhase = Math.random() * 2.0 - 1.0;

  for (const {
    type,
    imag,
    real,
    gain,
    glide = preset.glide,
    attack = preset.attack,
    decay = preset.decay,
    sustain = preset.sustain,
    release = preset.release,
    velocitySensitivity = preset.velocitySensitivity,
    attackDetune = preset.attackDetune,
    attackDetuneDurationMultiplier = preset.attackDetuneDurationMultiplier,
    noiseType,
    noiseQ,
    getPitch = passPitchThrough,
    attackInstability = defaultattackInstability,
    vibratoEffectOnPitch = defaultVibratoEffectOnPitch,
    vibratoEffectOnVolume = defaultVibratoEffectOnVolume,
  } of oscillatorsInPreset) {
    const oscillatorNode =
      type === "custom"
        ? new OscillatorNode(audioContext, {
            type,
            periodicWave: new PeriodicWave(audioContext, {
              imag: imag || undefined,
              real: real || imag?.map((v) => v * randomisedPhase),
            }),
          })
        : type === "noise"
          ? new BiquadFilterNode(audioContext, { type: noiseType, Q: noiseQ })
          : new OscillatorNode(audioContext, { type });

    const gainNode = new GainNode(audioContext, { gain: 0 });
    const gainTarget = (gain / maxPeak) ** Math.SQRT1_2;

    if (type === "noise") getNoiseOscillator(audioContext).connect(oscillatorNode);
    if (oscillatorNode instanceof OscillatorNode) oscillatorNode.start(audioContext.currentTime);

    oscillatorNode.connect(gainNode).connect(input);

    // Brass-style attack instability
    let attackInstabilityGain = null;
    if (attackInstability > 0.0) {
      canVibrato = true;
      attackInstabilityGain = new GainNode(audioContext, { gain: 0.0 });
      vibratoMain.connect(attackInstabilityGain).connect(gainNode.gain);
    }

    // Tremolo and/or brightness vibrato
    let vibratoVolumeGain = null;
    if (vibratoEffectOnVolume > 0.0) {
      canVibrato = true;
      vibratoVolumeGain = new GainNode(audioContext, { gain: 0.0 });
      vibratoMain.connect(vibratoVolumeGain).connect(gainNode.gain);
    }

    // Regular pitch vibrato
    let vibratoPitchGain = null;
    if (vibratoEffectOnPitch > 0.0) {
      canVibrato = true;
      vibratoPitchGain = new GainNode(audioContext, { gain: 0.0 });
      vibratoMain.connect(vibratoPitchGain).connect(oscillatorNode.detune);
    }

    oscillators.push({
      oscillatorNode,
      gainNode,
      gainTarget,
      getPitch,
      glide,
      attack,
      decay,
      sustain,
      release,
      velocitySensitivity,
      attackDetune,
      attackDetuneDurationMultiplier,
      attackInstabilityGain,
      vibratoVolumeGain,
      vibratoPitchGain,
      attackInstability,
      vibratoEffectOnPitch,
      vibratoEffectOnVolume,
    });
  }

  const epsilon = 1.0 / audioContext.sampleRate;

  return {
    epsilon,
    oscillators,
    vibratoMain,
    lowPassFilter,
    highPassFilter,
    canVibrato,
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
  const { oscillators, vibratoMain, canVibrato, epsilon } = instrument;

  // FIXME: these are repeated in attack and release, but don't need to be in play
  const highPitchness = -(1200.0 * Math.log2(27.5 / pitch)) / highPitchnessReference;
  // const lowPitchness = 1.0 - highPitchness;
  const relativePitchness = highPitchness * 2.0 - 1.0;
  const relativeVelocity = velocity * 2.0 - 1.0;

  const volumeTarget = volume * (0.5 + velocity * 0.5);

  const dynamicStartAt = Math.max(instrument.output.context.currentTime, at);

  cancelPendingInstrumentEvents(instrument, dynamicStartAt);

  // Tell the oscillators what to do
  const attackInstabilityAttack = 0.001;
  let attackInstabilityStopsAt = dynamicStartAt;
  let longestAttack = 0.0;
  let longestDecay = 0.0;

  for (const oscillator of oscillators) {
    const {
      oscillatorNode,
      gainNode,
      gainTarget,
      attack,
      glide,
      velocitySensitivity,
      attackDetune,
      attackDetuneDurationMultiplier,
      getPitch,
      decay,
      sustain,
      attackInstabilityGain,
      attackInstability,
    } = oscillator;

    cancelPendingOscillatorEvents(oscillator, dynamicStartAt);

    // Glide and attack
    const pitchTarget = getPitch(pitch, velocity);
    const attackDynamics =
      (1.0 - 0.236 * relativePitchness) *
      (1.0 - 0.236 * relativeVelocity * velocitySensitivity) *
      attackMultiplier;

    const dynamicAttack = attack * attackDynamics;
    longestAttack = Math.max(longestAttack, dynamicAttack);

    oscillatorNode.frequency.setTargetAtTime(pitchTarget, dynamicStartAt, glide);
    gainNode.gain.setTargetAtTime(gainTarget * volumeTarget, dynamicStartAt, dynamicAttack);

    // Detune attack, if needed
    if (attackDetune !== 0.0) {
      oscillatorNode.detune.setTargetAtTime(
        attackDetune * velocity * Math.abs(velocitySensitivity) ** 0.414,
        dynamicStartAt,
        glide,
      );
      oscillatorNode.detune.setTargetAtTime(
        0.0,
        dynamicStartAt + glide * 4.0,
        attackDetuneDurationMultiplier * dynamicAttack,
      );
    }

    // Brass-style attack instability
    if (attackInstability > 0.0) {
      attackInstabilityStopsAt = Math.max(
        attackInstabilityStopsAt,
        attackInstabilityStopsAt + dynamicAttack * 3.0,
      );

      const attackInstabilityDecaysAt = Math.min(
        dynamicStartAt + attackInstabilityAttack * 4.0,
        attackInstabilityStopsAt,
      );

      const attackInstabilityGainDecay = attackInstabilityStopsAt - attackInstabilityDecaysAt;

      attackInstabilityGain?.gain.setTargetAtTime(
        attackInstability * (1.0 - highPitchness),
        dynamicStartAt,
        attackInstabilityAttack,
      );
      attackInstabilityGain?.gain.setTargetAtTime(
        0.0,
        attackInstabilityDecaysAt,
        attackInstabilityGainDecay,
      );
    }

    // Decay and sustain
    if (sustain === 1.0 && decay === 0) continue;

    const decayAt = dynamicStartAt + dynamicAttack * 4.0;
    const decayDynamics =
      1.382 *
      (1.0 - relativePitchness * 0.618) *
      (1.0 + 0.236 * relativeVelocity * velocitySensitivity);
    const dynamicDecay = decay * decayDynamics;
    longestDecay = Math.max(longestDecay, dynamicDecay);

    gainNode.gain.setTargetAtTime(gainTarget * volume * sustain, decayAt, dynamicDecay);
  }

  // Fire up vibrato oscillator for attack instability
  if (attackInstabilityStopsAt !== dynamicStartAt) {
    const frequency = 75 + 5 * highPitchness;
    vibratoMain.frequency.setTargetAtTime(frequency, dynamicStartAt, attackInstabilityAttack);
    vibratoMain.frequency.setTargetAtTime(0.0, attackInstabilityStopsAt, attackInstabilityAttack);
  }

  // Fire up vibrato
  if (canVibrato && vibratoAmount > 0.0) {
    const attack = longestAttack * 0.013;
    const gainAttack = longestAttack * 0.056;
    const vibratoAt = attackInstabilityStopsAt + attack;

    vibratoMain.frequency.setTargetAtTime(vibratoFrequency, vibratoAt, attack);

    for (const {
      vibratoPitchGain,
      vibratoVolumeGain,
      vibratoEffectOnVolume,
      vibratoEffectOnPitch,
    } of oscillators) {
      vibratoPitchGain?.gain.setTargetAtTime(
        vibratoAmount * vibratoEffectOnPitch,
        vibratoAt,
        gainAttack,
      );
      vibratoVolumeGain?.gain.setTargetAtTime(
        vibratoAmount * -vibratoEffectOnVolume * volume,
        vibratoAt,
        gainAttack,
      );
    }
  }

  instrument.previousStartAt = dynamicStartAt;
  instrument.previousEndAt = Number.POSITIVE_INFINITY;
  instrument.previousPitch = pitch;
  instrument.previousVelocity = velocity;
  instrument.previousAttack = longestAttack;
  instrument.previousDecay = longestDecay;
};

const highPitchnessReference = 1200.0 * Math.log2(4186.009 / 27.5);

export const releaseInstrument = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ endAt,
  releaseMultiplier = 1.0,
  releaseEarly = true,
) => {
  const { oscillators, vibratoMain } = instrument;

  const pitch = instrument.previousPitch;
  const velocity = instrument.previousVelocity;

  const highPitchness = -(1200.0 * Math.log2(27.5 / pitch)) / highPitchnessReference;
  const lowPitchness = 1.0 - highPitchness;

  let furthestEndAt = endAt;
  let longestRelease = 0.0;

  for (const oscillator of oscillators) {
    const {
      gainNode,
      release,
      attackInstabilityGain,
      vibratoPitchGain,
      vibratoVolumeGain,
      velocitySensitivity,
    } = oscillator;

    const releaseDynamics =
      (0.618 + lowPitchness) * (1.0 + 0.618 * velocity * velocitySensitivity) * releaseMultiplier;
    const dynamicRelease = release * releaseDynamics;
    const vibratoGainRelease = dynamicRelease * 0.09;

    const dynamicEndAt = releaseEarly
      ? Math.max(
          instrument.output.context.currentTime,
          instrument.previousStartAt + 0.764 * (endAt - instrument.previousStartAt),
          endAt - dynamicRelease,
        )
      : endAt;

    cancelPendingOscillatorEvents(oscillator, dynamicEndAt);

    gainNode.gain.setTargetAtTime(0.0, dynamicEndAt, dynamicRelease);

    attackInstabilityGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);
    vibratoPitchGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);
    vibratoVolumeGain?.gain.setTargetAtTime(0.0, dynamicEndAt, vibratoGainRelease);

    furthestEndAt = Math.max(furthestEndAt, dynamicEndAt);
    longestRelease = Math.max(longestRelease, dynamicRelease);
  }

  cancelPendingInstrumentEvents(instrument, furthestEndAt);
  vibratoMain.frequency.setTargetAtTime(0.0, furthestEndAt, 0.008);

  instrument.previousEndAt = releaseEarly ? furthestEndAt : furthestEndAt + longestRelease;
};

const cancelPendingInstrumentEvents = (
  /** @type {ReturnType<typeof createInstrument>} */ instrument,
  /** @type {number} */ at,
) => {
  const { vibratoMain } = instrument;
  vibratoMain.frequency.cancelScheduledValues(at);
};

const cancelPendingOscillatorEvents = (
  /** @type {ReturnType<typeof createInstrument>["oscillators"][0]} */ oscillator,
  /** @type {number} */ at,
) => {
  const { oscillatorNode, gainNode, attackInstabilityGain, vibratoPitchGain, vibratoVolumeGain } =
    oscillator;

  oscillatorNode.frequency.cancelScheduledValues(at);
  oscillatorNode.detune.cancelScheduledValues(at);
  gainNode.gain.cancelScheduledValues(at);

  attackInstabilityGain?.gain.cancelScheduledValues(at);
  vibratoPitchGain?.gain.cancelScheduledValues(at);
  vibratoVolumeGain?.gain.cancelScheduledValues(at);
};

/**
  @param {ReturnType<typeof createInstrument>} instrument
*/
export const destroyInstrument = ({ output, oscillators, vibratoMain }) => {
  // TODO: Is this all that's needed?
  // Or do all nodes need to be disconnected?

  output.disconnect();

  for (const { oscillatorNode } of oscillators) {
    if (oscillatorNode instanceof OscillatorNode) oscillatorNode.stop();
    oscillatorNode.disconnect();
  }

  vibratoMain?.stop();
  vibratoMain?.disconnect();
};
