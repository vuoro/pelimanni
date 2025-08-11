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
  shouldApplyAttackEffectsOnReleaseToo = false;

  noteAttacks: Float64Array;
  noteDecays: Float64Array;
  noteReleases: Float64Array;
  noteBrightnesses: Float64Array;

  noteForces: Float64Array;
  noteForceTargets: Float64Array;
  noteSustains: Float64Array;
  noteMultipliers: Float64Array;

  partialOffsets: Int16Array;
  partialAmplitudes: Float64Array;
  partialAttacks: Float64Array;
  partialReleases: Float64Array;

  // transientIndexes: Int16Array;
  // transientAmplitudes: Float64Array;
  // transientAttacks: Float64Array;
  // transientReleases: Float64Array;

  // transientForces: Float64Array;
  // transientForceTargets: Float64Array;

  frequencies: Float64Array;
  frequencyAmplitudes: Float64Array;

  frequencyForces: Float64Array;
  frequencyTunes: Float64Array;
  frequencyPhases: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    if (!options) throw new Error("Missing AudioWorkletNodeOptions");
    super(options);

    // Apply custom options
    const customOptions: InstrumentWorklet = options.processorOptions;

    const {
      noteAttacks,
      noteDecays,
      noteReleases,
      noteBrightnesses,
      partialOffsets,
      partialAmplitudes,
      partialAttacks,
      partialReleases,
      frequencies,
      frequencyAmplitudes,
      // transientIndexes,
      // transientAmplitudes,
      // transientAttacks,
      // transientReleases,
      attackDetune,
      attackPitchInstability,
      attackBrightnessInstability,
      attackInstabilityFrequency,
      notesStartAt,
      shouldApplyAttackEffectsOnReleaseToo,
    } = customOptions;

    this.notesStartAt = notesStartAt || this.notesStartAt;

    // Create buffers
    this.noteAttacks = Float64Array.from(noteAttacks);
    this.noteDecays = Float64Array.from(noteDecays);
    this.noteReleases = Float64Array.from(noteReleases);
    this.noteBrightnesses = Float64Array.from(noteBrightnesses);

    this.noteForces = new Float64Array(noteAttacks.length * partialOffsets.length);
    this.noteForceTargets = new Float64Array(noteAttacks.length * partialOffsets.length);
    this.noteSustains = new Float64Array(noteAttacks.length * partialOffsets.length);
    this.noteMultipliers = new Float64Array(noteAttacks.length);

    this.partialOffsets = Int16Array.from(partialOffsets);
    this.partialAmplitudes = Float64Array.from(partialAmplitudes);
    this.partialAttacks = Float64Array.from(partialAttacks);
    this.partialReleases = Float64Array.from(partialReleases);

    // this.transientIndexes = Int16Array.from(transientIndexes);
    // this.transientAmplitudes = Float64Array.from(transientAmplitudes);
    // this.transientAttacks = Float64Array.from(transientAttacks);
    // this.transientReleases = Float64Array.from(transientReleases);

    // this.transientForces = new Float64Array(transientIndexes.length);
    // this.transientForceTargets = new Float64Array(transientIndexes.length);

    this.frequencies = Float64Array.from(frequencies);
    this.frequencyAmplitudes = Float64Array.from(frequencyAmplitudes);

    this.frequencyForces = new Float64Array(frequencies.length);
    this.frequencyTunes = new Float64Array(frequencies.length).fill(1.0);
    this.frequencyPhases = new Float64Array(frequencies.length).map((_) => Math.random());

    this.attackDetune = attackDetune;
    this.attackPitchInstability = attackPitchInstability;
    this.attackBrightnessInstability = attackBrightnessInstability;
    this.attackInstabilityFrequency = attackInstabilityFrequency;
    this.shouldApplyAttackEffectsOnReleaseToo = shouldApplyAttackEffectsOnReleaseToo;

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
      const partialCount = this.partialOffsets.length;

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

          for (let partialIndex = 0; partialIndex < partialCount; partialIndex++) {
            const targetIndex = partialIndex + partialCount * noteIndex;
            const frequencyIndex = noteIndex * 10 + this.partialOffsets[partialIndex];

            // Skip if out of range
            if (frequencyIndex > this.frequencyForces.length - 1 || frequencyIndex < 0) continue;

            // Higher velocity notes are brighter
            this.noteForceTargets[targetIndex] =
              this.partialAmplitudes[partialIndex] ** ((1.618 - velocity ** 1.382) * this.noteBrightnesses[noteIndex]) *
              this.frequencyAmplitudes[frequencyIndex] *
              loudness;

            this.noteSustains[targetIndex] = this.noteForceTargets[targetIndex] * sustain;
          }

          this.noteMultipliers[noteIndex] = multiplier * (0.618 + velocity ** 1.382);

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
          for (let partialIndex = 0; partialIndex < partialCount; partialIndex++) {
            const targetIndex = partialIndex + partialCount * noteIndex;

            this.noteForceTargets[targetIndex] = 0.0;
            this.noteSustains[targetIndex] = 0.0;
          }

          this.noteMultipliers[noteIndex] = multiplier;
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

    if (this.sleeping) return true;

    // TODO: figure out if this should support multiple outputs and/or channels
    const output = outputs[0];
    const channel = output[0];

    let allDormant = true;

    for (let index = 0; index < channel.length; index++) {
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
        const t = Math.max(0.0, Math.min(1.0, (this.totalForce - vibratoMin) / (vibratoMax - vibratoMin)));
        const vibratoSpeed = Math.max(0.0, Math.min(1.0, t * t * (3.0 - 2.0 * t)));

        this.vibratoPhase = (this.vibratoPhase + (this.vibratoFrequency * vibratoSpeed) / sampleRate) % 1.0;
        this.vibratoWave = Math.abs(this.vibratoPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Notes add force to frequencies
      for (let noteIndex = 0; noteIndex < this.noteAttacks.length; noteIndex++) {
        let fundamentalForce = 0.0;
        let fundamentalDifference = 0.0;

        for (let partialIndex = 0; partialIndex < this.partialOffsets.length; partialIndex++) {
          const targetIndex = partialIndex + this.partialOffsets.length * noteIndex;

          // Skip if dormant
          if (this.noteForces[targetIndex] + this.noteForceTargets[targetIndex] < this.cutoff) continue;

          const frequencyIndex = noteIndex * 10 + this.partialOffsets[partialIndex];

          // Note force heads towards target, attacking or releasing
          const likelyReleased = this.noteForceTargets[targetIndex] === 0.0;
          const goingDown = this.noteForceTargets[targetIndex] < this.noteForces[targetIndex];

          this.noteForces[targetIndex] =
            this.noteForceTargets[targetIndex] +
            (this.noteForces[targetIndex] - this.noteForceTargets[targetIndex]) *
              Math.exp(
                (goingDown ? this.noteReleases : this.noteAttacks)[noteIndex] *
                  (goingDown ? this.partialReleases : this.partialAttacks)[partialIndex] *
                  (likelyReleased || !goingDown ? -this.noteMultipliers[noteIndex] : -1.0),
              );

          // Save fundamental frequency force
          if (partialIndex === 0) {
            fundamentalForce = this.noteForces[targetIndex];
            fundamentalDifference = Math.abs(this.noteForces[targetIndex] - this.noteForceTargets[targetIndex]);
          }

          // Apply effects
          let force = this.noteForces[targetIndex];

          // Apply instability and detune if needed
          if (!goingDown || this.shouldApplyAttackEffectsOnReleaseToo) {
            if (this.attackDetune !== 0.0) {
              const detune = fundamentalDifference * this.attackDetune;
              this.frequencyTunes[frequencyIndex] *= detune < 0.0 ? 1.0 / (1.0 - detune) : 1.0 + detune;
            }

            if (this.attackPitchInstability !== 0.0) {
              const instability = fundamentalDifference * this.attackInstabilityWave * this.attackPitchInstability;
              this.frequencyTunes[frequencyIndex] *= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
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
            this.frequencyTunes[frequencyIndex] *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
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
          this.frequencyForces[frequencyIndex] += force;

          // Decay force target towards sustain level
          this.noteForceTargets[targetIndex] =
            this.noteSustains[targetIndex] +
            (this.noteForceTargets[targetIndex] - this.noteSustains[targetIndex]) *
              Math.exp(-this.noteDecays[noteIndex]);
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
      //   this.frequencyForces[frequencyIndex] += this.transientForces[transientIndex];

      //   // Decay force target
      //   this.transientForceTargets[transientIndex] *= Math.exp(-this.transientReleases[transientIndex]);
      // }

      // Frequencies play sine waves
      let amplitude = 0.0;
      this.totalForce = 0.0;

      for (let frequencyIndex = 0; frequencyIndex < this.frequencyForces.length; frequencyIndex++) {
        const force = this.frequencyForces[frequencyIndex];
        if (force < this.cutoff) continue; // skip if dormant

        allDormant = false;

        // Increase phase
        this.frequencyPhases[frequencyIndex] =
          (this.frequencyPhases[frequencyIndex] +
            (this.frequencies[frequencyIndex] * this.frequencyTunes[frequencyIndex]) / sampleRate) %
          1.0;

        // Play sine, amplified by force
        amplitude += Math.sin(this.frequencyPhases[frequencyIndex] * (Math.PI * 2.0)) * force;
        this.totalForce += force;

        // Nullify for next frame
        this.frequencyForces[frequencyIndex] = 0.0;
        this.frequencyTunes[frequencyIndex] = 1.0;
      }

      // Normalize by total playing force
      channel[index] = amplitude / (this.totalForce + Math.exp(-this.totalForce));
      // channel[index] = amplitude / (1.0 + totalForce);
    }

    // If no frequencies play, it's safe to sleep until the next message and save some CPU.
    if (allDormant) {
      this.sleeping = true;
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned. Sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
