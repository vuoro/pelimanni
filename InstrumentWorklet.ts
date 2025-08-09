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

  noteAttacks: Float64Array;
  noteDecays: Float64Array;
  noteReleases: Float64Array;
  noteBrightnesses: Float64Array;

  noteForces: Float64Array;
  noteForceTargets: Float64Array;
  noteSustains: Float64Array;
  noteMultipliers: Float64Array;
  noteDetunes: Float64Array;
  noteDetuneTargets: Float64Array;

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
      notesStartAt,
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
    this.noteDetunes = new Float64Array(noteAttacks.length);
    this.noteDetuneTargets = new Float64Array(noteAttacks.length);
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

    // Handle messages
    // TODO: type this message
    this.port.addEventListener("message", ({ data }) => {
      const [type, note, velocity = 1.0, sustain = 1.0, multiplier = 1.0, detune = 0.0, dynamics = 1.0] = data;
      const noteIndex = note - this.notesStartAt;
      const partialCount = this.partialOffsets.length;

      console.log({
        type,
        note,
        velocity,
        sustain,
        multiplier,
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
          if (detune !== 0.0) this.noteDetuneTargets[noteIndex] = detune * velocity;

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
      // Notes add force to frequencies
      for (let noteIndex = 0; noteIndex < this.noteAttacks.length; noteIndex++) {
        // Compute detune
        if (Math.abs(this.noteDetunes[noteIndex] + this.noteDetuneTargets[noteIndex]) > this.cutoff) {
          this.noteDetunes[noteIndex] =
            this.noteDetuneTargets[noteIndex] +
            (this.noteDetunes[noteIndex] - this.noteDetuneTargets[noteIndex]) * Math.exp(-128.0 / sampleRate);
        }

        for (let partialIndex = 0; partialIndex < this.partialOffsets.length; partialIndex++) {
          const targetIndex = partialIndex + this.partialOffsets.length * noteIndex;

          // Skip if dormant
          if (this.noteForces[targetIndex] + this.noteForceTargets[targetIndex] < this.cutoff) continue;

          const frequencyIndex = noteIndex * 10 + this.partialOffsets[partialIndex];

          // Note force heads towards target, attacking or releasing
          const goingDown = this.noteForceTargets[targetIndex] < this.noteForces[targetIndex];
          const likelyReleased = this.noteForceTargets[targetIndex] === 0.0;

          this.noteForces[targetIndex] =
            this.noteForceTargets[targetIndex] +
            (this.noteForces[targetIndex] - this.noteForceTargets[targetIndex]) *
              Math.exp(
                (goingDown ? this.noteReleases : this.noteAttacks)[noteIndex] *
                  (goingDown ? this.partialReleases : this.partialAttacks)[partialIndex] *
                  (likelyReleased || !goingDown ? -this.noteMultipliers[noteIndex] : -1.0),
              );

          // Impact frequencies with this note
          this.frequencyForces[frequencyIndex] += this.noteForces[targetIndex];

          // Detune if needed
          if (Math.abs(this.noteDetunes[noteIndex]) > this.cutoff) {
            this.frequencyTunes[frequencyIndex] += this.noteDetunes[noteIndex];
          }

          // Decay target towards sustain level
          this.noteForceTargets[targetIndex] =
            this.noteSustains[targetIndex] +
            (this.noteForceTargets[targetIndex] - this.noteSustains[targetIndex]) *
              Math.exp(-this.noteDecays[noteIndex]);
        }

        // Decay detune
        if (Math.abs(this.noteDetuneTargets[noteIndex]) >= this.cutoff) {
          this.noteDetuneTargets[noteIndex] *= Math.exp(-64.0 / sampleRate);
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
      let totalForce = 0.0;

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
        totalForce += force;

        // Nullify for next frame
        this.frequencyForces[frequencyIndex] = 0.0;
        this.frequencyTunes[frequencyIndex] = 1.0;
      }

      // Normalize by total playing forces
      // channel[index] = amplitude / (totalForce + Math.exp(-totalForce));
      channel[index] = amplitude / (1.0 + totalForce);
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
