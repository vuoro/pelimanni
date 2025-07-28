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

if (!self.SharedArrayBuffer) {
  throw new Error("SharedArrayBuffer is not supported in your browser.");
}

class InstrumentWorklet extends AudioWorkletProcessor {
  // nyquist = (globalThis.sampleRate as number) / 2.0; // handle when adding partialFrequencies
  frameDuration = globalThis.sampleRate / 48000.0;

  // Parameters
  notePartialOffsets = Int16Array.of(0, 1);
  notePartialForces = Float32Array.of(1.0, 0.618);

  noteDecays = Float32Array.of(0.992);
  noteSustains = Float32Array.of(0.618);

  partialFrequencies = Float32Array.of(440.0, 880.0);
  partialAttacks = Float32Array.of(1.0, 1.618);
  partialDecays = Float32Array.of(0.995, 0.992);

  // States
  noteForcesBuffer = new SharedArrayBuffer(Float64Array.BYTES_PER_ELEMENT * 1);
  noteForces = new Float64Array(this.noteForcesBuffer);
  partialForces = Float64Array.of(0.0, 0.0);
  partialPhases = Float64Array.of(Math.random(), Math.random());

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    // Send the shared forces buffer to the main thread, so it can "play" the instrument using it
    // FIXME: can this get posted and arrive before the main thread starts listening for it?
    this.port.postMessage({ noteForcesBuffer: this.noteForcesBuffer }, [this.noteForcesBuffer]);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    // TODO: figure out if this should support multiple outputs and/or channels
    const output = outputs[0];
    const channel = output[0];

    const partialsPerNote = this.partialFrequencies.length / this.noteForces.length;

    // const max = Math.floor((this.nyquist / frequency + 1.0) / 2.0);
    // let sum = 0.0;

    for (let index = 0; index < channel.length; index++) {
      // Notes add force to partials
      for (let noteIndex = 0; noteIndex < this.noteForces.length; noteIndex++) {
        if (this.noteForces[noteIndex] <= Number.EPSILON) continue;

        // Decay the force to sustain level
        // FIXME: is there a concurrency problem here?
        if (this.noteForces[noteIndex] > Number.EPSILON) {
          const decay = this.noteDecays[noteIndex];
          const sustain = this.noteSustains[noteIndex];

          // TODO: if velocity is bundled into force, this will sustain at the wrong level
          this.noteForces[noteIndex] -= (this.noteForces[noteIndex] - sustain) * (1.0 - decay) * this.frameDuration;
        }

        // Impact partials with this note
        for (let notePartialIndex = 0; notePartialIndex < this.notePartialOffsets.length; notePartialIndex++) {
          const partialIndex = (noteIndex + notePartialIndex) * partialsPerNote;
          if (partialIndex > this.partialForces.length - 1) continue;

          const attack = this.partialAttacks[partialIndex];

          this.partialForces[partialIndex] +=
            this.noteForces[noteIndex] * attack * this.notePartialForces[notePartialIndex] * this.frameDuration;
        }
      }

      // Partials play sine waves
      let sum = 0.0;
      let total = 0.0;

      for (let partialIndex = 0; partialIndex < this.partialForces.length; partialIndex++) {
        if (this.partialForces[partialIndex] < Number.EPSILON) continue;

        // TODO: would be a bit faster to concatenate these arrays
        const frequency = this.partialFrequencies[partialIndex];
        const decay = this.partialDecays[partialIndex];

        // Decay force
        this.partialForces[partialIndex] -= this.partialForces[partialIndex] * (1.0 - decay) * this.frameDuration;
        const force = this.partialForces[partialIndex];

        // Increase phase
        this.partialPhases[partialIndex] =
          (this.partialPhases[partialIndex] + frequency / globalThis.sampleRate) % (Math.PI * 2.0);
        const phase = this.partialPhases[partialIndex];

        // Add
        sum += Math.sin(phase) * force;
        total += force;
      }

      channel[index] = sum / Math.max(0.0, total);
    }

    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
