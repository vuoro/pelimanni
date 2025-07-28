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

if (!self.SharedArrayBuffer) {
  throw new Error("SharedArrayBuffer is not supported in your browser.");
}

export class InstrumentWorklet extends AudioWorkletProcessor {
  // nyquist = (sampleRate as number) / 2.0; // handle when adding partialFrequencies
  sampleRateScale = sampleRate / 48000.0;

  notePartialOffsets: Uint16Array;
  notePartialAttacks: Float32Array;

  noteDecays: Float32Array;
  noteSustains: Float32Array;

  partialFrequencies: Float32Array;
  partialAttacks: Float32Array;
  partialDecays: Float32Array;

  noteForcesBuffer: SharedArrayBuffer;
  noteForces: Float64Array;
  partialForces: Float64Array;
  partialPhases: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);

    let amountOfNotePartials = 1;
    let amountOfNotes = 1;
    let amountOfPartials = 1;

    // Apply custom options
    const customOptions = options?.processorOptions;

    if (customOptions) {
      const {
        notePartialOffsets,
        notePartialAttacks,
        noteDecays,
        noteSustains,
        partialFrequencies,
        partialAttacks,
        partialDecays,
      } = options?.processorOptions as Partial<InstrumentWorklet>;

      amountOfNotePartials = Math.max(
        amountOfNotePartials,
        notePartialOffsets?.length || 0,
        notePartialAttacks?.length || 0,
      );

      amountOfNotes = Math.max(amountOfNotes, noteDecays?.length || 0, noteSustains?.length || 0);

      amountOfPartials = Math.max(
        amountOfPartials,
        partialFrequencies?.length || 0,
        partialAttacks?.length || 0,
        partialDecays?.length || 0,
      );
    }

    // Create buffers
    this.notePartialOffsets = new Uint16Array(amountOfNotePartials);
    this.notePartialAttacks = new Float32Array(amountOfNotePartials);

    this.noteDecays = new Float32Array(amountOfNotes);
    this.noteSustains = new Float32Array(amountOfNotes);

    this.partialFrequencies = new Float32Array(amountOfPartials);
    this.partialAttacks = new Float32Array(amountOfPartials);
    this.partialDecays = new Float32Array(amountOfPartials);

    this.noteForcesBuffer = new SharedArrayBuffer(amountOfNotes * Float64Array.BYTES_PER_ELEMENT);
    this.noteForces = new Float64Array(this.noteForcesBuffer);
    this.partialForces = new Float64Array(amountOfPartials);
    this.partialPhases = new Float64Array(amountOfPartials);

    // Populate buffers with data from custom options
    if (customOptions.notePartialOffsets) this.notePartialOffsets.set(customOptions.notePartialOffsets);
    if (customOptions.notePartialAttacks) this.notePartialAttacks.set(customOptions.notePartialAttacks);

    if (customOptions.noteDecays) this.noteDecays.set(customOptions.noteDecays);
    if (customOptions.noteSustains) this.noteSustains.set(customOptions.noteSustains);

    if (customOptions.partialFrequencies) this.partialFrequencies.set(customOptions.partialFrequencies);
    if (customOptions.partialAttacks) this.partialAttacks.set(customOptions.partialAttacks);
    if (customOptions.partialDecays) this.partialDecays.set(customOptions.partialDecays);

    // Send the shared forces buffer to the main thread, so it can "play" the instrument using it
    // FIXME: can this get posted and arrive before the main thread starts listening for it?
    this.port.postMessage({ noteForcesBuffer: this.noteForcesBuffer }, [this.noteForcesBuffer]);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>) {
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
          this.noteForces[noteIndex] -= (this.noteForces[noteIndex] - sustain) * (1.0 - decay) * this.sampleRateScale;
        }

        // Impact partials with this note
        for (let notePartialIndex = 0; notePartialIndex < this.notePartialOffsets.length; notePartialIndex++) {
          const partialIndex = (noteIndex + notePartialIndex) * partialsPerNote;
          if (partialIndex > this.partialForces.length - 1) continue;

          this.partialForces[partialIndex] +=
            this.noteForces[noteIndex] *
            this.notePartialAttacks[notePartialIndex] *
            this.partialAttacks[partialIndex] *
            this.sampleRateScale;
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
        this.partialForces[partialIndex] -= this.partialForces[partialIndex] * (1.0 - decay) * this.sampleRateScale;
        const force = this.partialForces[partialIndex];

        // Increase phase
        this.partialPhases[partialIndex] =
          (this.partialPhases[partialIndex] + frequency / sampleRate) % (Math.PI * 2.0);
        const phase = this.partialPhases[partialIndex];

        // Add
        sum += Math.sin(phase) * force;
        total += force;
      }

      channel[index] = sum / Math.max(0.0, total); // FIXME: this probably isn't a good way to normalize
    }

    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
