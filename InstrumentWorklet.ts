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

  attack = 1.0;
  velocityImpactOnAttack = 8.0;

  notePartialOffsets: Int16Array;
  notePartialAmplitudes: Float64Array;

  noteAttacks: Float64Array;
  noteDecays: Float64Array;

  partialFrequencies: Float64Array;
  partialReleases: Float64Array;

  noteSustains: Float64Array;
  noteVelocities: Float64Array;
  noteForces: Float64Array;
  noteForceTargets: Float64Array;
  partialForces: Float64Array;
  partialPhases: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    if (!options) throw new Error("Missing AudioWorkletNodeOptions");
    super(options);

    // Apply custom options
    const customOptions: InstrumentWorklet = options.processorOptions;

    const { notePartialOffsets, notePartialAmplitudes, noteAttacks, noteDecays, partialFrequencies, partialReleases } =
      customOptions;

    this.notesStartAt = customOptions.notesStartAt || this.notesStartAt;

    this.attack = customOptions.attack ?? this.attack;
    this.velocityImpactOnAttack = customOptions.velocityImpactOnAttack ?? this.velocityImpactOnAttack;

    // Create buffers
    this.notePartialOffsets = Int16Array.from(notePartialOffsets);
    this.notePartialAmplitudes = Float64Array.from(notePartialAmplitudes);

    this.noteAttacks = Float64Array.from(noteAttacks);
    this.noteDecays = Float64Array.from(noteDecays);

    this.partialFrequencies = Float64Array.from(partialFrequencies);
    this.partialReleases = Float64Array.from(partialReleases);

    this.noteSustains = new Float64Array(noteAttacks.length);
    this.noteVelocities = new Float64Array(noteAttacks.length);
    this.noteForces = new Float64Array(noteAttacks.length);
    this.noteForceTargets = new Float64Array(noteAttacks.length);

    this.partialForces = new Float64Array(partialFrequencies.length);
    this.partialPhases = new Float64Array(partialFrequencies.length).map((_) => Math.random());

    // Handle messages
    this.port.addEventListener("message", ({ data }) => {
      const [type, note, velocity = 1.0, sustain = 0.0] = data;
      const noteIndex = note - this.notesStartAt;

      console.log({
        type,
        note,
        velocity,
        sustain,
        frequency: this.partialFrequencies[noteIndex * 10],
      });

      switch (type) {
        case 0: {
          // attack
          this.noteForceTargets[noteIndex] = velocity;
          this.noteVelocities[noteIndex] = velocity;
          this.noteSustains[noteIndex] = sustain * velocity;
          break;
        }
        case 1: {
          // release
          this.noteForceTargets[noteIndex] = 0.0;
          this.noteForces[noteIndex] = 0.0;
          this.noteSustains[noteIndex] = 0.0;
          break;
        }
        case 2: {
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
      // Notes add force to partials
      for (let noteIndex = 0; noteIndex < this.noteForces.length; noteIndex++) {
        // Skip if dormant
        if (this.noteForces[noteIndex] + this.noteForceTargets[noteIndex] <= Number.EPSILON) continue;

        // Note forces head towards their targets
        this.noteForces[noteIndex] +=
          (this.noteForceTargets[noteIndex] - this.noteForces[noteIndex]) *
          (this.noteAttacks[noteIndex] /
            (this.velocityImpactOnAttack - (this.velocityImpactOnAttack - 1.0) * this.noteVelocities[noteIndex]));

        // Impact partials with this note
        for (let notePartialIndex = 0; notePartialIndex < this.notePartialOffsets.length; notePartialIndex++) {
          const partialIndex = noteIndex * 10 + this.notePartialOffsets[notePartialIndex];
          if (partialIndex > this.partialForces.length - 1) {
            continue;
          }

          this.partialForces[partialIndex] += this.noteForces[noteIndex] * this.notePartialAmplitudes[notePartialIndex];
        }

        // Decay the force to sustain level
        this.noteForceTargets[noteIndex] -=
          Math.max(0.0, this.noteForceTargets[noteIndex] - this.noteSustains[noteIndex]) * this.noteDecays[noteIndex];
      }

      // Partials play sine waves
      let amplitude = 0.0;
      let totalForce = 0.0;

      for (let partialIndex = 0; partialIndex < this.partialForces.length; partialIndex++) {
        const force = this.partialForces[partialIndex];
        if (force < Number.EPSILON) continue;

        // TODO: would be a bit faster to concatenate these arrays
        const frequency = this.partialFrequencies[partialIndex];

        // Increase phase
        this.partialPhases[partialIndex] = (this.partialPhases[partialIndex] + frequency / sampleRate) % 1.0;
        const phase = this.partialPhases[partialIndex];

        // Add
        amplitude += Math.sin(phase * (Math.PI * 2.0)) * force;
        totalForce += force;

        // Decay force
        this.partialForces[partialIndex] *= this.partialReleases[partialIndex];
      }

      channel[index] = amplitude / (totalForce + Math.exp(-totalForce));
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned, meaning this will live forever. That sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
