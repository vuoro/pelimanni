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

class InstrumentWorklet extends AudioWorkletProcessor {
  shouldPlay = true;
  sleeping = false;
  partialCount = 0;
  frequencyCount = 0;
  noteCount = 0;

  notesStartAt = 0;
  cutoff = 1.0 / sampleRate;
  totalForce = 0.0;

  vibratoPhase = 0.0;
  vibratoFrequency = 0.0;
  vibratoWave = 0.0;

  amplitudeVibrato = 0.0;
  brightnessVibrato = 0.0;
  pitchVibrato = 0.0;

  attackDetune = 0.0;
  attackPitchInstability = 0.0;
  attackBrightnessInstability = 0.0;
  attackInstabilityFrequency = 80.0;
  attackInstabilityWave = 0.0;
  attackInstabilityPhase = 0.0;
  attackDetuneUsesPartialForce: false;
  attackInstabilityUsesPartialForce: false;

  notes: Float64Array;
  partials: Float64Array;
  frequencies: Float64Array;

  noteStates: Float64Array;
  partialStates: Float64Array;
  frequencyStates: Float64Array;

  // transientIndexes: Int16Array;
  // transientAmplitudes: Float64Array;
  // transientAttacks: Float64Array;
  // transientReleases: Float64Array;

  // transientForces: Float64Array;
  // transientForceTargets: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    if (!options) throw new Error("Missing AudioWorkletNodeOptions");
    super(options);

    // Apply custom options
    const customOptions: InstrumentWorklet = options.processorOptions;

    const {
      notes,
      partials,
      frequencies,
      // transientIndexes,
      // transientAmplitudes,
      // transientAttacks,
      // transientReleases,
      notesStartAt,
      attackDetune,
      attackPitchInstability,
      attackBrightnessInstability,
      attackInstabilityFrequency,
      attackDetuneUsesPartialForce,
      attackInstabilityUsesPartialForce,
    } = customOptions;

    // Create buffers
    this.notes = notes;
    this.partials = partials;
    this.frequencies = frequencies;

    this.noteCount = notes.length / 4;
    this.partialCount = partials.length / 4;
    this.frequencyCount = frequencies.length / 2;

    // this.transientIndexes = Int16Array.from(transientIndexes);
    // this.transientAmplitudes = Float64Array.from(transientAmplitudes);
    // this.transientAttacks = Float64Array.from(transientAttacks);
    // this.transientReleases = Float64Array.from(transientReleases);

    // this.transientForces = new Float64Array(transientIndexes.length);
    // this.transientForceTargets = new Float64Array(transientIndexes.length);

    this.noteStates = new Float64Array(this.noteCount * 1);
    this.partialStates = new Float64Array(this.noteCount * this.partialCount * 3);
    this.frequencyStates = new Float64Array(this.frequencyCount * 3);

    for (let index = 0; index < this.frequencyCount; index++) {
      this.frequencyStates[index * 3 + 1] = 1.0; // 1.0 tune
      this.frequencyStates[index * 3 + 2] = Math.random(); // random phase
    }

    this.notesStartAt = notesStartAt || this.notesStartAt;
    this.attackDetune = attackDetune;
    this.attackPitchInstability = attackPitchInstability;
    this.attackBrightnessInstability = attackBrightnessInstability;
    this.attackInstabilityFrequency = attackInstabilityFrequency;
    this.attackDetuneUsesPartialForce = attackDetuneUsesPartialForce;
    this.attackInstabilityUsesPartialForce = attackInstabilityUsesPartialForce;

    // Handle messages
    // TODO: type this message
    this.port.addEventListener("message", ({ data }) => {
      const [
        type,
        note,
        velocity,
        sustain,
        multiplier,
        amplitudeVibrato,
        brightnessVibrato,
        pitchVibrato,
        vibratoFrequency,
        dynamics,
      ] = data as Float32Array;
      const noteIndex = note - this.notesStartAt;

      console.log({
        type,
        note,
        velocity,
        sustain,
        multiplier,
        dynamics,
      });

      this.sleeping = false;

      switch (data[0]) {
        case 0: {
          // attack
          const loudness = velocity ** dynamics;

          for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
            const offset = this.partials[partialIndex * 4 + 1];
            const frequencyIndex = noteIndex * 10 + offset;

            // Skip if out of range
            if (frequencyIndex > this.frequencyCount - 1 || frequencyIndex < 0) continue;

            const amplitude = this.partials[partialIndex * 4 + 0];
            const brightness = this.notes[noteIndex * 4 + 3];
            const frequencyAmplitude = this.frequencies[frequencyIndex * 2 + 1];

            const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
            const forceTargetIndex = partialStateIndex + 1;
            const sustainIndex = partialStateIndex + 2;

            // Higher velocity notes are brighter
            this.partialStates[forceTargetIndex] =
              amplitude ** ((1.618 - velocity ** 1.382) * brightness) * frequencyAmplitude * loudness;

            this.partialStates[sustainIndex] = this.partialStates[forceTargetIndex] * sustain;
          }

          const multiplierIndex = noteIndex * 1 + 0;
          this.noteStates[multiplierIndex] = multiplier * (0.618 + velocity ** 1.382);

          this.amplitudeVibrato = amplitudeVibrato;
          this.brightnessVibrato = brightnessVibrato;
          this.pitchVibrato = pitchVibrato;
          this.vibratoFrequency = vibratoFrequency;

          // for (let transientIndex = 0; transientIndex < this.transientIndexes.length; transientIndex++) {
          //   this.transientForceTargets[transientIndex] = velocity * transientAmplitudes[transientIndex];
          // }

          break;
        }
        case 1: {
          // release
          for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
            const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
            const forceTargetIndex = partialStateIndex + 1;
            const sustainIndex = partialStateIndex + 2;

            this.partialStates[forceTargetIndex] = 0.0;
            this.partialStates[sustainIndex] = 0.0;
          }

          const multiplierIndex = noteIndex * 1 + 0;
          this.noteStates[multiplierIndex] = multiplier;
          break;
        }
        case 666: {
          // destroy
          // FIXME: this whole thing can be removed once Chrome starts supporting AudioWorklets that get cleaned up automatically.
          // https://issues.chromium.org/issues/41435286
          this.shouldPlay = false;
          break;
        }
      }
    });

    this.port.start();

    console.log(this);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>) {
    if (!this.shouldPlay) return false;

    // TODO: figure out if this should support multiple outputs and/or channels
    const output = outputs[0];
    const channel = output[0];

    const previousTotalForce = this.totalForce;

    for (let index = 0; index < channel.length; index++) {
      if (this.sleeping) return true;

      let allDormant = true;
      this.totalForce = 0.0;

      // Compute attack instability if needed: it may be used below.
      if (this.attackPitchInstability !== 0.0 || this.attackBrightnessInstability !== 0.0) {
        this.attackInstabilityPhase =
          (this.attackInstabilityPhase + this.attackInstabilityFrequency / sampleRate) % 1.0;
        this.attackInstabilityWave = Math.abs(this.attackInstabilityPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Compute vibrato if needed: it may be used below.
      if (
        this.amplitudeVibrato > this.cutoff ||
        this.brightnessVibrato > this.cutoff ||
        this.pitchVibrato > this.cutoff
      ) {
        // Smoothstep vibrato speed
        const vibratoMin = -0.25;
        const vibratoMax = 0.25;
        const t = Math.max(0.0, Math.min(1.0, (previousTotalForce - vibratoMin) / (vibratoMax - vibratoMin)));
        const vibratoSpeed = Math.max(0.0, Math.min(1.0, t * t * (3.0 - 2.0 * t)));

        this.vibratoPhase = (this.vibratoPhase + (this.vibratoFrequency * vibratoSpeed) / sampleRate) % 1.0;
        this.vibratoWave = Math.abs(this.vibratoPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Notes add force to frequencies
      for (let noteIndex = 0; noteIndex < this.noteCount; noteIndex++) {
        let fundamentalForce = 0.0;
        let fundamentalDifference = 0.0;

        const attack = this.notes[noteIndex * 4 + 0];
        const decay = this.notes[noteIndex * 4 + 1];
        const release = this.notes[noteIndex * 4 + 2];
        const multiplierIndex = noteIndex * 1 + 0;
        const multiplier = this.noteStates[multiplierIndex];

        for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
          const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
          const forceIndex = partialStateIndex + 0;
          const forceTargetIndex = partialStateIndex + 1;
          const sustainIndex = partialStateIndex + 2;

          // Skip if dormant
          if (this.partialStates[forceIndex] + this.partialStates[forceTargetIndex] < this.cutoff) continue;
          allDormant = false;

          const partialOffset = this.partials[partialIndex * 4 + 1];
          const partialAttack = this.partials[partialIndex * 4 + 2];
          const partialRelease = this.partials[partialIndex * 4 + 3];

          const frequencyIndex = (noteIndex * 10 + partialOffset) * 3;
          const frequencyForceIndex = frequencyIndex + 0;
          const tuneIndex = frequencyIndex + 1;

          // Note force heads towards target, attacking or releasing
          const likelyReleased = this.partialStates[forceTargetIndex] === 0.0;
          const goingDown = this.partialStates[forceTargetIndex] < this.partialStates[forceIndex];

          this.partialStates[forceIndex] =
            this.partialStates[forceTargetIndex] +
            (this.partialStates[forceIndex] - this.partialStates[forceTargetIndex]) *
              Math.exp(
                -(goingDown ? release : attack) *
                  (goingDown ? partialRelease : partialAttack) *
                  (likelyReleased || !goingDown ? multiplier : 1.0),
              );

          // Save fundamental frequency force
          if (partialIndex === 0) {
            fundamentalForce = this.partialStates[forceIndex];
            fundamentalDifference = Math.abs(this.partialStates[forceIndex] - this.partialStates[forceTargetIndex]);
          }

          // Apply effects
          let force = this.partialStates[forceIndex];

          // Apply instability and detune if needed
          if (!goingDown) {
            if (this.attackDetune !== 0.0) {
              const detune = (this.attackDetuneUsesPartialForce ? force : fundamentalDifference) * this.attackDetune;
              this.frequencyStates[tuneIndex] *= detune < 0.0 ? 1.0 / (1.0 - detune) : 1.0 + detune;
            }

            if (this.attackPitchInstability !== 0.0) {
              const instability =
                (this.attackInstabilityUsesPartialForce ? force : fundamentalDifference) *
                this.attackInstabilityWave *
                this.attackPitchInstability;
              this.frequencyStates[tuneIndex] *= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
            }

            // FIXME: changing volumes like this is going to instantly hit the attackless normalisation further below.
            if (this.attackBrightnessInstability !== 0.0) {
              const instability = fundamentalDifference * this.attackInstabilityWave * this.attackBrightnessInstability;
              force **= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
            }
          }

          // Apply vibrato if needed
          if (this.pitchVibrato !== 0.0) {
            const vibrato = fundamentalForce * this.pitchVibrato * this.vibratoWave;
            this.frequencyStates[tuneIndex] *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          if (this.brightnessVibrato !== 0.0) {
            const vibrato = fundamentalForce * this.brightnessVibrato * this.vibratoWave;
            force **= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          if (this.amplitudeVibrato !== 0.0) {
            const vibrato = fundamentalForce * this.amplitudeVibrato * this.vibratoWave;
            force *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          // Add force to frequencies
          this.frequencyStates[frequencyForceIndex] += force;
          this.totalForce += force;

          // Decay force target towards sustain level
          this.partialStates[forceTargetIndex] =
            this.partialStates[sustainIndex] +
            (this.partialStates[forceTargetIndex] - this.partialStates[sustainIndex]) * Math.exp(-decay);
        }
      }

      // // Transients also add force to frequencies, but in a simpler way
      // for (let transientIndex = 0; transientIndex < this.transientIndexes.length; transientIndex++) {
      //   // Skip if dormant
      //   if (this.transientForces[transientIndex] + this.transientForceTargets[transientIndex] < this.cutoff) continue;

      //   const frequencyIndex = this.transientIndexes[transientIndex];

      //   // Transient force heads towards target, attacking or releasing
      //   const goingDown = this.transientForceTargets[transientIndex] < this.transientForces[transientIndex];

      //   this.transientForces[transientIndex] =
      //     this.transientForceTargets[transientIndex] +
      //     (this.transientForces[transientIndex] - this.transientForceTargets[transientIndex]) *
      //       Math.exp(-(goingDown ? this.transientReleases : this.transientAttacks)[transientIndex]);

      //   // Impact frequencies with this transient
      //   this.frequencyStates[frequencyForceIndex] += this.transientForces[transientIndex];

      //   // Decay force target
      //   this.transientForceTargets[transientIndex] *= Math.exp(-this.transientReleases[transientIndex]);
      // }

      // Frequencies play sine waves
      let amplitude = 0.0;

      for (let frequencyIndex = 0; frequencyIndex < this.frequencyCount; frequencyIndex++) {
        const frequencyForceIndex = frequencyIndex * 3 + 0;
        const tuneIndex = frequencyIndex * 3 + 1;
        const phaseIndex = frequencyIndex * 3 + 2;

        const force = this.frequencyStates[frequencyForceIndex];
        if (force < this.cutoff) continue; // skip if dormant

        // Increase phase
        const frequency = this.frequencies[frequencyIndex * 2 + 0];

        this.frequencyStates[phaseIndex] =
          (this.frequencyStates[phaseIndex] + (frequency * this.frequencyStates[tuneIndex]) / sampleRate) % 1.0;

        // Play sine, amplified by force
        amplitude += Math.sin(this.frequencyStates[phaseIndex] * (Math.PI * 2.0)) * force;

        // Nullify for next frame
        this.frequencyStates[frequencyForceIndex] = 0.0;
        this.frequencyStates[tuneIndex] = 1.0;
      }

      // Normalize by total playing force
      channel[index] = amplitude / (this.totalForce + Math.exp(-this.totalForce));
      // channel[index] = amplitude / (1.0 + totalForce);

      // If no notes play, it's safe to sleep until the next message and save some CPU.
      if (allDormant) {
        this.sleeping = true;
      }
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned. Sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
