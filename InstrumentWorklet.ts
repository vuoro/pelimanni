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

  notesStartAt = 0;
  mute = 0.0;
  volume = 1.0;

  noteAttacks: Float64Array;
  noteDecays: Float64Array;
  noteReleases: Float64Array;

  noteSustains: Float64Array;
  noteMultipliers: Float64Array;
  noteForces: Float64Array;
  noteForceTargets: Float64Array;

  partialOffsets: Int16Array;
  partialAmplitudes: Float64Array;
  partialAttacks: Float64Array;
  partialReleases: Float64Array;

  transientIndexes: Int16Array;
  transientAmplitudes: Float64Array;
  transientAttacks: Float64Array;
  transientReleases: Float64Array;

  transientForces: Float64Array;
  transientForceTargets: Float64Array;

  frequencies: Float64Array;
  frequencyAmplitudes: Float64Array;

  frequencyForces: Float64Array;
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
      partialOffsets,
      partialAmplitudes,
      partialAttacks,
      partialReleases,
      frequencies,
      frequencyAmplitudes,
      transientIndexes,
      transientAmplitudes,
      transientAttacks,
      transientReleases,
      notesStartAt,
      volume,
    } = customOptions;

    this.notesStartAt = notesStartAt || this.notesStartAt;
    this.volume = volume || this.volume;

    // Create buffers

    this.noteAttacks = Float64Array.from(noteAttacks);
    this.noteDecays = Float64Array.from(noteDecays);
    this.noteReleases = Float64Array.from(noteReleases);

    this.noteForces = new Float64Array(noteAttacks.length * partialOffsets.length);
    this.noteForceTargets = new Float64Array(noteAttacks.length * partialOffsets.length);
    this.noteSustains = new Float64Array(noteAttacks.length);
    this.noteMultipliers = new Float64Array(noteAttacks.length);

    this.partialOffsets = Int16Array.from(partialOffsets);
    this.partialAmplitudes = Float64Array.from(partialAmplitudes);
    this.partialAttacks = Float64Array.from(partialAttacks);
    this.partialReleases = Float64Array.from(partialReleases);

    this.transientIndexes = Int16Array.from(transientIndexes);
    this.transientAmplitudes = Float64Array.from(transientAmplitudes);
    this.transientAttacks = Float64Array.from(transientAttacks);
    this.transientReleases = Float64Array.from(transientReleases);

    this.transientForces = new Float64Array(transientIndexes.length);
    this.transientForceTargets = new Float64Array(transientIndexes.length);

    this.frequencies = Float64Array.from(frequencies);
    this.frequencyAmplitudes = Float64Array.from(frequencyAmplitudes);

    this.frequencyForces = new Float64Array(frequencies.length);
    this.frequencyPhases = new Float64Array(frequencies.length).map((_) => Math.random());

    // Handle messages
    this.port.addEventListener("message", ({ data }) => {
      const [type, note, velocity = 1.0, sustain = 0.0, multiplier = 1.0] = data;
      const noteIndex = note - this.notesStartAt;
      const partialCount = this.partialOffsets.length;

      console.log({
        type,
        note,
        velocity,
        sustain,
        multiplier,
      });

      switch (data[0]) {
        case 0: {
          // attack
          const loudness = velocity ** 0.5 * this.volume;

          for (let partialIndex = 0; partialIndex < partialCount; partialIndex++) {
            const targetIndex = partialIndex + partialCount * noteIndex;

            // Higher velocity notes are brighter
            this.noteForceTargets[targetIndex] = this.partialAmplitudes[partialIndex] ** (1.618 - velocity) * loudness;
          }

          this.noteMultipliers[noteIndex] = 1.0 / multiplier;
          this.noteSustains[noteIndex] = sustain * loudness;

          for (let transientIndex = 0; transientIndex < this.transientIndexes.length; transientIndex++) {
            this.transientForceTargets[transientIndex] += velocity;
          }
          break;
        }
        case 1: {
          // release
          for (let partialIndex = 0; partialIndex < partialCount; partialIndex++) {
            const targetIndex = partialIndex + partialCount * noteIndex;

            this.noteForces[targetIndex] = 0.0;
            this.noteForceTargets[targetIndex] = 0.0;
            this.noteMultipliers[noteIndex] = 1.0 / multiplier;
          }

          this.noteSustains[noteIndex] = 0.0;
          break;
        }
        case 2: {
          // mute: like a sustain pedal
          const amount = note;
          this.mute = amount;
          break;
        }
        case 3: {
          // stop
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

    for (let index = 0; index < channel.length; index++) {
      // Notes add force to frequencies
      for (let noteIndex = 0; noteIndex < this.noteAttacks.length; noteIndex++) {
        for (let partialIndex = 0; partialIndex < this.partialOffsets.length; partialIndex++) {
          const targetIndex = partialIndex + this.partialOffsets.length * noteIndex;

          // Skip if dormant
          if (this.noteForces[targetIndex] + this.noteForceTargets[targetIndex] < Number.EPSILON) continue;

          // Skip if out of range
          const frequencyIndex = noteIndex * 10 + this.partialOffsets[partialIndex];
          if (frequencyIndex > this.frequencyForces.length - 1) continue;

          // Note force heads towards target, attacking or releasing
          this.noteForces[targetIndex] +=
            (this.noteForceTargets[targetIndex] - this.noteForces[targetIndex]) *
            Math.min(
              1.0,
              this.noteForceTargets[targetIndex] === 0.0
                ? this.noteReleases[noteIndex] * this.partialReleases[partialIndex] * this.noteMultipliers[noteIndex]
                : this.noteAttacks[noteIndex] * this.partialAttacks[partialIndex] * this.noteMultipliers[noteIndex],
            );

          // Impact frequencies with this note
          this.frequencyForces[frequencyIndex] +=
            this.noteForces[targetIndex] * this.frequencyAmplitudes[frequencyIndex];

          // Decay force target towards sustain level
          this.noteForceTargets[targetIndex] -=
            Math.max(0.0, this.noteForceTargets[targetIndex] - this.noteSustains[noteIndex]) *
            this.noteDecays[noteIndex];
        }
      }

      // Transients also add force to frequencies, but in a simpler way
      for (let transientIndex = 0; transientIndex < this.transientIndexes.length; transientIndex++) {
        // Skip if dormant
        if (this.transientForces[transientIndex] + this.transientForceTargets[transientIndex] < Number.EPSILON)
          continue;

        const frequencyIndex = this.transientIndexes[transientIndex];

        // Transient force heads towards target
        this.transientForces[transientIndex] +=
          (this.transientForceTargets[transientIndex] - this.transientForces[transientIndex]) *
          this.transientAttacks[transientIndex];

        // Impact frequencies with this transient
        this.frequencyForces[frequencyIndex] +=
          this.transientForces[transientIndex] * this.frequencyAmplitudes[frequencyIndex];

        // Release force target
        this.transientForceTargets[transientIndex] *= this.transientReleases[transientIndex];
      }

      // Frequencies play sine waves
      let amplitude = 0.0;
      let totalForce = 0.0;

      for (let frequencyIndex = 0; frequencyIndex < this.frequencyForces.length; frequencyIndex++) {
        const force = this.frequencyForces[frequencyIndex];
        if (force < Number.EPSILON) continue; // skip if dormant

        // Increase phase
        this.frequencyPhases[frequencyIndex] =
          (this.frequencyPhases[frequencyIndex] + this.frequencies[frequencyIndex] / sampleRate) % 1.0;
        const phase = this.frequencyPhases[frequencyIndex];

        // Play sine, amplified by force
        amplitude += Math.sin(phase * (Math.PI * 2.0)) * force;
        totalForce += force;

        // Nullify force for next frame
        this.frequencyForces[frequencyIndex] = 0.0;
      }

      // Normalize by total playing forces
      channel[index] = amplitude / (totalForce + Math.exp(-totalForce));
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned. Sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
