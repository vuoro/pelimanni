// FIXME: remove these types once TypeScript adds them, or when there's a nice package that contains them.
interface AudioWorkletProcessor {
  readonly port: MessagePort;
}

interface AudioWorkletProcessorImpl extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

type AudioParamDescriptor = {
  name: string;
  automationRate: AutomationRate;
  minValue: number;
  maxValue: number;
  defaultValue: number;
};

interface AudioWorkletProcessorConstructor {
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessorImpl;
  parameterDescriptors?: AudioParamDescriptor[];
}

declare function registerProcessor(name: string, processorCtor: AudioWorkletProcessorConstructor): void;
declare const sampleRate: number;

if (!globalThis.SharedArrayBuffer) {
  throw new Error("SharedArrayBuffer is not supported in your browser.");
}

export class InstrumentWorklet extends AudioWorkletProcessor {
  isAlive = true;
  isSleeping = false;
  partialCount = 0;
  frequencyCount = 0;
  noteCount = 0;

  notesStartAt = 0;
  notesEndAt = 1;
  cutoff = 0.0001;
  totalAmplitude = 0.0;

  vibratoPhase = 0.0;
  vibratoFrequency = 0.0;
  vibratoWave = 0.0;

  amplitudeVibrato = 0.0;
  brightnessVibrato = 0.0;
  frequencyVibrato = 0.0;

  maxPartialOffset = 0.0;
  attackDetune = 0.0;
  attackPitchInstability = 0.0;
  attackInstabilityFrequency = 80.0;
  attackInstabilityWave = 0.0;
  attackInstabilityPhase = 0.0;
  attackDetuneUsesPartialAmplitude: boolean;
  attackInstabilityUsesPartialAmplitude: boolean;

  homeFrequency: number;
  attack: number;
  decay: number;
  release: number;

  frequencyEffectOnAttack: number;
  frequencyEffectOnDecay: number;
  frequencyEffectOnRelease: number;
  frequencyEffectOnBrightness: number;
  partialEffectOnAttack: number;
  partialEffectOnDecay: number;
  partialEffectOnRelease: number;
  velocityImpactOnBrightness: number;

  partials: Float64Array;
  frequencies: Float64Array;

  partialStates: Float64Array;
  frequencyStates: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    if (!options) throw new Error("Missing AudioWorkletNodeOptions");
    super(options);

    // Apply custom options
    const customOptions: InstrumentWorklet = options.processorOptions;

    const {
      partials,
      frequencies,

      notesStartAt,
      notesEndAt,
      attackDetune,
      attackPitchInstability,
      attackInstabilityFrequency,
      attackDetuneUsesPartialAmplitude,
      attackInstabilityUsesPartialAmplitude,

      homeFrequency,
      attack,
      decay,
      release,
      frequencyEffectOnAttack,
      frequencyEffectOnDecay,
      frequencyEffectOnRelease,
      frequencyEffectOnBrightness,
      partialEffectOnAttack,
      partialEffectOnDecay,
      partialEffectOnRelease,
      velocityImpactOnBrightness,
    } = customOptions;

    this.noteCount = notesEndAt - notesStartAt + 1;

    // partialAmplitude, partialOffset
    this.partials = partials;
    this.partialCount = partials.length / 2;

    this.frequencies = frequencies;
    this.frequencyCount = frequencies.length / 2;

    // amplitude, amplitudeTarget, sustain, attack, decay, release
    this.partialStates = new Float64Array(this.noteCount * this.partialCount * 6);
    this.frequencyStates = new Float64Array(this.frequencyCount * 3);

    for (let index = 0; index < this.frequencyCount; index++) {
      this.frequencyStates[index * 3 + 1] = 1.0; // 1.0 tune
      this.frequencyStates[index * 3 + 2] = Math.random(); // random phase
    }

    this.notesStartAt = notesStartAt || this.notesStartAt;
    this.attackDetune = attackDetune;
    this.attackPitchInstability = attackPitchInstability;
    this.attackInstabilityFrequency = attackInstabilityFrequency;
    this.attackDetuneUsesPartialAmplitude = attackDetuneUsesPartialAmplitude;
    this.attackInstabilityUsesPartialAmplitude = attackInstabilityUsesPartialAmplitude;

    this.homeFrequency = homeFrequency;
    this.attack = attack;
    this.decay = decay;
    this.release = release;

    this.frequencyEffectOnAttack = frequencyEffectOnAttack;
    this.frequencyEffectOnDecay = frequencyEffectOnDecay;
    this.frequencyEffectOnRelease = frequencyEffectOnRelease;
    this.frequencyEffectOnBrightness = frequencyEffectOnBrightness;
    this.partialEffectOnAttack = partialEffectOnAttack;
    this.partialEffectOnDecay = partialEffectOnDecay;
    this.partialEffectOnRelease = partialEffectOnRelease;
    this.velocityImpactOnBrightness = velocityImpactOnBrightness;

    this.maxPartialOffset = Math.abs(partials[partials.length - 1]);

    // Handle messages
    // TODO: type this message
    this.port.addEventListener("message", ({ data }) => this.handleMessage(data as Float32Array));

    this.port.start();

    if (import.meta.env.DEV) console.log(this);
  }

  handleMessage([
    type,
    note,
    velocity,
    sustain,
    multiplier = 1.0,
    amplitudeVibrato = this.amplitudeVibrato,
    brightnessVibrato = this.brightnessVibrato,
    frequencyVibrato = this.frequencyVibrato,
    vibratoFrequency = this.vibratoFrequency,
    dynamics = 1.0,
  ]: Float32Array) {
    const noteIndex = note - this.notesStartAt;

    if (import.meta.env.DEV) {
      console.log({
        type,
        note,
        velocity,
        sustain,
        multiplier,
        amplitudeVibrato,
        brightnessVibrato,
        frequencyVibrato,
        vibratoFrequency,
        dynamics,
      });
    }

    this.isSleeping = false;

    const {
      attack,
      decay,
      release,
      frequencyEffectOnAttack,
      frequencyEffectOnDecay,
      frequencyEffectOnRelease,
      frequencyEffectOnBrightness,
      partialEffectOnAttack,
      partialEffectOnDecay,
      partialEffectOnRelease,
      velocityImpactOnBrightness,
    } = this;

    switch (type) {
      case 0:
      case 1: {
        // attack or release
        const loudness = velocity ** dynamics;
        const fundamentalFrequency = this.frequencies[noteIndex * 10 * 2 + 0];

        const logHomeFrequency = Math.log2(this.homeFrequency);
        const logFundamentalFrequency = Math.log2(fundamentalFrequency);
        const velocityBrightness = (Math.log2(1.0 + velocity) * Math.SQRT2 - 1.0) * velocityImpactOnBrightness; // totally vibes-based
        const fundamentalFrequencyDifference = logFundamentalFrequency - logHomeFrequency;

        for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
          const partialOffset = this.partials[partialIndex * 2 + 1];
          const frequencyIndex = noteIndex * 10 + partialOffset;

          // Skip if out of range
          if (frequencyIndex > this.frequencyCount - 1 || frequencyIndex < 0) continue;

          // Compute envelope dynamics
          const partialAmplitude = this.partials[partialIndex * 2 + 0];

          const frequency = this.frequencies[frequencyIndex * 2 + 0];
          const frequencyAmplitude = this.frequencies[frequencyIndex * 2 + 1];

          const logFrequency = Math.log2(frequency);
          // const frequencyDifference = logFrequency - logHomeFrequency;
          const partialDifference = logFrequency - logFundamentalFrequency;

          const dynamicRelease =
            (release *
              2.0 **
                (frequencyEffectOnRelease * fundamentalFrequencyDifference +
                  partialEffectOnRelease * partialDifference)) /
            sampleRate;

          const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 6;
          // const amplitudeIndex = partialStateIndex + 0;
          const amplitudeTargetIndex = partialStateIndex + 1;
          const sustainIndex = partialStateIndex + 2;
          const attackIndex = partialStateIndex + 3;
          const decayIndex = partialStateIndex + 4;
          const releaseIndex = partialStateIndex + 5;

          if (type === 0) {
            // Attack
            const dynamicAttack =
              (attack *
                2.0 **
                  (frequencyEffectOnAttack * fundamentalFrequencyDifference +
                    partialEffectOnAttack * partialDifference * (2.0 - partialAmplitude))) /
              sampleRate;

            const dynamicDecay =
              (decay *
                2.0 **
                  (frequencyEffectOnDecay * fundamentalFrequencyDifference +
                    partialEffectOnDecay * partialDifference)) /
              sampleRate;

            // FIXME: this is messy and vibes-based
            let darkness =
              (frequencyEffectOnBrightness * fundamentalFrequencyDifference +
                velocityBrightness * Math.sign(partialDifference)) *
              partialDifference;
            // darkness = darkness < 0.0 ? 1.0 / (1.0 - darkness) : 1.0 + darkness;
            darkness = Math.log2(1.0 + 2.0 ** darkness);

            this.partialStates[amplitudeTargetIndex] = partialAmplitude * darkness * frequencyAmplitude * loudness;
            this.partialStates[sustainIndex] = this.partialStates[amplitudeTargetIndex] * sustain;
            this.partialStates[attackIndex] = dynamicAttack * multiplier;
            this.partialStates[decayIndex] = dynamicDecay * multiplier;
            this.partialStates[releaseIndex] = dynamicRelease;
          } else if (type === 1) {
            // Release
            this.partialStates[amplitudeTargetIndex] = 0.0;
            this.partialStates[sustainIndex] = 0.0;
            this.partialStates[releaseIndex] = dynamicRelease * multiplier;
          }
        }

        this.amplitudeVibrato = amplitudeVibrato;
        this.brightnessVibrato = brightnessVibrato;
        this.frequencyVibrato = frequencyVibrato;
        this.vibratoFrequency = vibratoFrequency;

        return;
      }
      case 666: {
        // destroy
        // FIXME: this whole thing can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
        // https://issues.chromium.org/issues/41435286
        this.isAlive = false;
        return;
      }
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>) {
    if (!this.isAlive) return false;
    if (this.isSleeping) return true;

    // TODO: figure out if this should support multiple outputs and/or channels
    const output = outputs[0];
    const channel = output[0];

    const previousTotalAmplitude = this.totalAmplitude;

    for (let index = 0; index < channel.length; index++) {
      let allDormant = true;
      this.totalAmplitude = 0.0;

      // Compute attack instability if needed: it may be used below.
      if (this.attackPitchInstability !== 0.0) {
        this.attackInstabilityPhase =
          (this.attackInstabilityPhase + this.attackInstabilityFrequency / sampleRate) % 1.0;

        this.attackInstabilityWave = Math.abs(this.attackInstabilityPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Compute vibrato if needed: it may be used below.
      if (this.amplitudeVibrato !== 0.0 || this.brightnessVibrato !== 0.0 || this.frequencyVibrato !== 0.0) {
        // Smoothstep vibrato speed
        const vibratoMin = -0.25;
        const vibratoMax = 0.25;
        const t = Math.max(0.0, Math.min(1.0, (previousTotalAmplitude - vibratoMin) / (vibratoMax - vibratoMin)));
        const vibratoSpeed = Math.max(0.0, Math.min(1.0, t * t * (3.0 - 2.0 * t)));

        this.vibratoPhase = (this.vibratoPhase + (this.vibratoFrequency * vibratoSpeed) / sampleRate) % 1.0;
        this.vibratoWave = Math.abs(this.vibratoPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Notes add amplitude to frequencies
      for (let noteIndex = 0; noteIndex < this.noteCount; noteIndex++) {
        let fundamentalAmplitude = 0.0;
        let fundamentalDifference = 0.0;

        for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
          const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 6;
          const amplitudeIndex = partialStateIndex + 0;
          const amplitudeTargetIndex = partialStateIndex + 1;

          // Skip if dormant
          if (this.partialStates[amplitudeIndex] + this.partialStates[amplitudeTargetIndex] < this.cutoff) continue;
          allDormant = false;

          const sustainIndex = partialStateIndex + 2;
          const attackIndex = partialStateIndex + 3;
          const decayIndex = partialStateIndex + 4;
          const releaseIndex = partialStateIndex + 5;

          const partialOffset = this.partials[partialIndex * 2 + 1];

          const frequencyIndex = (noteIndex * 10 + partialOffset) * 3;
          const frequencyAmplitudeIndex = frequencyIndex + 0;
          const tuneIndex = frequencyIndex + 1;

          // Note amplitude heads towards target, attacking or releasing
          // const likelyReleased = this.partialStates[amplitudeTargetIndex] === 0.0;
          const goingDown = this.partialStates[amplitudeTargetIndex] < this.partialStates[amplitudeIndex];

          this.partialStates[amplitudeIndex] +=
            (this.partialStates[amplitudeTargetIndex] - this.partialStates[amplitudeIndex]) *
            (goingDown ? this.partialStates[releaseIndex] : this.partialStates[attackIndex]);

          // Save fundamental frequency amplitude
          const difference = this.partialStates[amplitudeTargetIndex] - this.partialStates[amplitudeIndex];
          const goingUp = difference > 0.0;

          if (partialIndex === 0) {
            fundamentalAmplitude = this.partialStates[amplitudeIndex];
            fundamentalDifference = difference;
          }

          // Normalise while taking into account effects
          let amplitude = this.partialStates[amplitudeIndex];
          const maxPossibleAmplitude =
            amplitude * (1.0 + fundamentalAmplitude * (this.brightnessVibrato + this.amplitudeVibrato));
          this.totalAmplitude += maxPossibleAmplitude;

          // Apply instability and detune if needed
          if (goingUp && this.attackDetune !== 0.0) {
            const detune =
              Math.max(0.0, this.attackDetuneUsesPartialAmplitude ? difference : fundamentalDifference) *
              this.attackDetune;
            // fun fact: (difference / fundamentalDifference) creates an uncomfortably wet blip
            this.frequencyStates[tuneIndex] *= detune < 0.0 ? 1.0 / (1.0 - detune) : 1.0 + detune;
          }

          if (goingUp && this.attackPitchInstability !== 0.0) {
            const instability =
              Math.max(0.0, this.attackInstabilityUsesPartialAmplitude ? difference : fundamentalDifference) *
              // fun fact: (difference / fundamentalDifference) creates an uncomfortably wet blip
              this.attackInstabilityWave *
              this.attackPitchInstability;
            this.frequencyStates[tuneIndex] *= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
          }

          // Apply vibrato if needed
          if (this.frequencyVibrato !== 0.0) {
            const vibrato = fundamentalAmplitude * this.frequencyVibrato * this.vibratoWave;
            this.frequencyStates[tuneIndex] *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          if (this.brightnessVibrato !== 0.0) {
            const brightnessVibrato =
              fundamentalAmplitude *
              this.brightnessVibrato *
              this.vibratoWave *
              (partialOffset / this.maxPartialOffset);
            amplitude *= brightnessVibrato < 0.0 ? 1.0 / (1.0 - brightnessVibrato) : 1.0 + brightnessVibrato;
          }

          if (this.amplitudeVibrato !== 0.0) {
            const amplitudeVibrato = fundamentalAmplitude * this.amplitudeVibrato * this.vibratoWave;
            amplitude *= amplitudeVibrato < 0.0 ? 1.0 / (1.0 - amplitudeVibrato) : 1.0 + amplitudeVibrato;
          }

          // Add amplitude to frequencies
          this.frequencyStates[frequencyAmplitudeIndex] += amplitude;

          // Decay amplitude target towards sustain level
          this.partialStates[amplitudeTargetIndex] +=
            (this.partialStates[sustainIndex] - this.partialStates[amplitudeTargetIndex]) *
            this.partialStates[decayIndex];
        }
      }

      // Frequencies play sine waves
      let frameAmplitude = 0.0;

      for (let frequencyIndex = 0; frequencyIndex < this.frequencyCount; frequencyIndex++) {
        const amplitudeIndex = frequencyIndex * 3 + 0;
        const tuneIndex = frequencyIndex * 3 + 1;
        const phaseIndex = frequencyIndex * 3 + 2;

        const amplitude = this.frequencyStates[amplitudeIndex];
        if (amplitude < this.cutoff) continue; // skip if dormant

        // Increase phase
        const frequency = this.frequencies[frequencyIndex * 2 + 0];

        this.frequencyStates[phaseIndex] =
          (this.frequencyStates[phaseIndex] + (frequency * this.frequencyStates[tuneIndex]) / sampleRate) % 1.0;

        // Play sine, with optional distortion, amplified by amplitude
        const wave = Math.sin(this.frequencyStates[phaseIndex] * (Math.PI * 2.0));
        // wave = Math.tanh(wave * (1.0 + 16.0)); // TODO
        frameAmplitude += wave * amplitude;

        // Nullify for next frame
        this.frequencyStates[amplitudeIndex] = 0.0;
        this.frequencyStates[tuneIndex] = 1.0;
      }

      // Normalize by total playing amplitude
      // channel[index] = amplitude / (this.totalAmplitude + Math.exp(-this.totalAmplitude));
      channel[index] = frameAmplitude / (1.0 + this.totalAmplitude);

      // If no notes play, it's safe to sleep until the next message and save some CPU.
      if (allDormant) {
        this.isSleeping = true;
      }
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned. Sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
