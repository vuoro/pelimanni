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

  notePartialOffsets: Uint16Array;
  notePartialAttacks: Float64Array;

  noteDecays: Float64Array;
  noteSustains: Float64Array;

  partialFrequencies: Float64Array;
  partialAttacks: Float64Array;
  partialDecays: Float64Array;

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
      const { notePartialOffsets, notePartialAttacks, noteDecays, partialFrequencies, partialAttacks, partialDecays } =
        options?.processorOptions as Partial<InstrumentWorklet>;

      amountOfNotePartials = Math.max(
        amountOfNotePartials,
        notePartialOffsets?.length || 0,
        notePartialAttacks?.length || 0,
      );

      amountOfNotes = Math.max(amountOfNotes, noteDecays?.length || 0);

      amountOfPartials = Math.max(
        amountOfPartials,
        partialFrequencies?.length || 0,
        partialAttacks?.length || 0,
        partialDecays?.length || 0,
      );
    }

    // Create buffers
    this.notePartialOffsets = new Uint16Array(amountOfNotePartials);
    this.notePartialAttacks = new Float64Array(amountOfNotePartials);

    this.noteDecays = new Float64Array(amountOfNotes);
    this.noteSustains = new Float64Array(amountOfNotes);

    this.partialFrequencies = new Float64Array(amountOfPartials);
    this.partialAttacks = new Float64Array(amountOfPartials);
    this.partialDecays = new Float64Array(amountOfPartials);

    this.noteForces = new Float64Array(amountOfNotes);
    this.partialForces = new Float64Array(amountOfPartials);
    this.partialPhases = new Float64Array(amountOfPartials);

    // Populate buffers with data from custom options
    if (customOptions.notePartialOffsets) this.notePartialOffsets.set(customOptions.notePartialOffsets);
    if (customOptions.notePartialAttacks) this.notePartialAttacks.set(customOptions.notePartialAttacks);

    if (customOptions.noteDecays) this.noteDecays.set(customOptions.noteDecays);

    if (customOptions.partialFrequencies) this.partialFrequencies.set(customOptions.partialFrequencies);
    if (customOptions.partialAttacks) this.partialAttacks.set(customOptions.partialAttacks);
    if (customOptions.partialDecays) this.partialDecays.set(customOptions.partialDecays);

    // Misc

    // Handle messages
    this.port.addEventListener("message", ({ data }) => {
      const [type, note, velocity = 1.0, sustain = 0.0] = data;

      console.log({ type, note, velocity, sustain, frequency: this.partialFrequencies[(note - 21) * 10] });

      switch (type) {
        case 0: {
          // attack
          this.noteForces[note] = velocity;
          this.noteSustains[note] = sustain;
          break;
        }
        case 1: {
          // release
          this.noteForces[note] = 0.0;
          this.noteSustains[note] = 0.0;
          break;
        }
        case 2: {
          // stop
          // FIXME: this can be removed once Chrome starts supporting process returning false correctly
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
        if (this.noteForces[noteIndex] <= Number.EPSILON) continue;

        // Impact partials with this note
        for (let notePartialIndex = 0; notePartialIndex < this.notePartialOffsets.length; notePartialIndex++) {
          const partialIndex = (noteIndex + 11) * 10 + this.notePartialOffsets[notePartialIndex];
          if (partialIndex > this.partialForces.length - 1) continue;

          this.partialForces[partialIndex] +=
            this.noteForces[noteIndex] * this.notePartialAttacks[notePartialIndex] * this.partialAttacks[partialIndex];
        }

        // Decay the force to sustain level
        const decay = this.noteDecays[noteIndex];
        const sustain = this.noteSustains[noteIndex];
        const force = this.noteForces[noteIndex];

        this.noteForces[noteIndex] -= Math.max(0.0, force - sustain) * (1.0 - decay);
      }

      // Partials play sine waves
      let amplitude = 0.0;

      for (let partialIndex = 0; partialIndex < this.partialForces.length; partialIndex++) {
        if (this.partialForces[partialIndex] < Number.EPSILON) continue;

        // TODO: would be a bit faster to concatenate these arrays
        const frequency = this.partialFrequencies[partialIndex];
        const decay = this.partialDecays[partialIndex];
        const force = this.partialForces[partialIndex];

        // Increase phase
        this.partialPhases[partialIndex] =
          (this.partialPhases[partialIndex] + frequency / sampleRate) % (Math.PI * 2.0);
        const phase = this.partialPhases[partialIndex];

        // Add
        amplitude += Math.sin(phase) * force;

        // Decay force
        this.partialForces[partialIndex] *= decay;
      }

      channel[index] = amplitude;
    }

    // FIXME: according to the spec this should return false.
    // But at least Chrome currently handles false wrong, so true must be returned, meaning this will live forever. That sucks.
    return true;
  }
}

registerProcessor("Instrument", InstrumentWorklet);
