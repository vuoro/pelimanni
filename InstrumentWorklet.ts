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
  isAlive = true;
  isSleeping = false;
  partialCount = 0;
  frequencyCount = 0;
  noteCount = 0;

  notesStartAt = 0;
  cutoff = 0.0001;
  totalAmplitude = 0.0;

  vibratoPhase = 0.0;
  vibratoFrequency = 0.0;
  vibratoWave = 0.0;

  amplitudeVibrato = 0.0;
  brightnessVibrato = 0.0;
  pitchVibrato = 0.0;

  maxPartialOffset = 0.0;
  attackDetune = 0.0;
  attackPitchInstability = 0.0;
  attackBrightnessInstability = 0.0;
  attackInstabilityFrequency = 80.0;
  attackInstabilityWave = 0.0;
  attackInstabilityPhase = 0.0;
  attackDetuneUsesPartialAmplitude: false;
  attackInstabilityUsesPartialAmplitude: false;

  notes: Float64Array;
  partials: Float64Array;
  frequencies: Float64Array;

  noteStates: Float64Array;
  partialStates: Float64Array;
  frequencyStates: Float64Array;

  constructor(options?: AudioWorkletNodeOptions) {
    if (!options) throw new Error("Missing AudioWorkletNodeOptions");
    super(options);

    // Apply custom options
    const customOptions: InstrumentWorklet = options.processorOptions;

    const {
      notes,
      partials,
      frequencies,

      notesStartAt,
      attackDetune,
      attackPitchInstability,
      attackBrightnessInstability,
      attackInstabilityFrequency,
      attackDetuneUsesPartialAmplitude,
      attackInstabilityUsesPartialAmplitude,
    } = customOptions;

    // Create buffers
    this.notes = notes;
    this.partials = partials;
    this.frequencies = frequencies;

    this.noteCount = notes.length / 4;
    this.partialCount = partials.length / 4;
    this.frequencyCount = frequencies.length / 2;

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
    this.attackDetuneUsesPartialAmplitude = attackDetuneUsesPartialAmplitude;
    this.attackInstabilityUsesPartialAmplitude = attackInstabilityUsesPartialAmplitude;
    this.maxPartialOffset = partials[partials.length - 1 - 2];

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

      this.isSleeping = false;

      switch (data[0]) {
        case 0: {
          // attack
          const loudness = velocity ** dynamics;

          for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
            const partialOffset = this.partials[partialIndex * 4 + 1];
            const frequencyIndex = noteIndex * 10 + partialOffset;

            // Skip if out of range
            if (frequencyIndex > this.frequencyCount - 1 || frequencyIndex < 0) continue;

            const amplitude = this.partials[partialIndex * 4 + 0];
            const frequencyAmplitude = this.frequencies[frequencyIndex * 2 + 1];

            // Notes vary brightness by frequency and velocity
            let brightness = this.notes[noteIndex * 4 + 3] * partialOffset;
            brightness *= 0.618 + velocity ** Math.SQRT2;
            brightness = brightness < 0.0 ? 1.0 / (1.0 - brightness) : 1.0 + brightness;

            const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
            const amplitudeTargetIndex = partialStateIndex + 1;
            const sustainIndex = partialStateIndex + 2;

            this.partialStates[amplitudeTargetIndex] = amplitude * frequencyAmplitude * loudness * brightness;
            this.partialStates[sustainIndex] = this.partialStates[amplitudeTargetIndex] * sustain;
          }

          const multiplierIndex = noteIndex * 1 + 0;
          this.noteStates[multiplierIndex] = multiplier * (0.618 + velocity ** 1.382);

          this.amplitudeVibrato = amplitudeVibrato;
          this.brightnessVibrato = brightnessVibrato;
          this.pitchVibrato = pitchVibrato;
          this.vibratoFrequency = vibratoFrequency;

          break;
        }
        case 1: {
          // release
          for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
            const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
            const amplitudeTargetIndex = partialStateIndex + 1;
            const sustainIndex = partialStateIndex + 2;

            this.partialStates[amplitudeTargetIndex] = 0.0;
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
          this.isAlive = false;
          break;
        }
      }
    });

    this.port.start();

    console.log(this);
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
        const t = Math.max(0.0, Math.min(1.0, (previousTotalAmplitude - vibratoMin) / (vibratoMax - vibratoMin)));
        const vibratoSpeed = Math.max(0.0, Math.min(1.0, t * t * (3.0 - 2.0 * t)));

        this.vibratoPhase = (this.vibratoPhase + (this.vibratoFrequency * vibratoSpeed) / sampleRate) % 1.0;
        this.vibratoWave = Math.abs(this.vibratoPhase * 2.0 - 1.0) * 2.0 - 1.0;
      }

      // Notes add amplitude to frequencies
      for (let noteIndex = 0; noteIndex < this.noteCount; noteIndex++) {
        let fundamentalAmplitude = 0.0;
        let fundamentalDifference = 0.0;

        const attack = this.notes[noteIndex * 4 + 0];
        const decay = this.notes[noteIndex * 4 + 1];
        const release = this.notes[noteIndex * 4 + 2];
        const multiplierIndex = noteIndex * 1 + 0;
        const multiplier = this.noteStates[multiplierIndex];

        for (let partialIndex = 0; partialIndex < this.partialCount; partialIndex++) {
          const partialStateIndex = (this.partialCount * noteIndex + partialIndex) * 3;
          const amplitudeIndex = partialStateIndex + 0;
          const amplitudeTargetIndex = partialStateIndex + 1;
          const sustainIndex = partialStateIndex + 2;

          // Skip if dormant
          if (this.partialStates[amplitudeIndex] + this.partialStates[amplitudeTargetIndex] < this.cutoff) continue;
          allDormant = false;

          const partialOffset = this.partials[partialIndex * 4 + 1];
          const partialAttack = this.partials[partialIndex * 4 + 2];
          const partialRelease = this.partials[partialIndex * 4 + 3];

          const frequencyIndex = (noteIndex * 10 + partialOffset) * 3;
          const frequencyAmplitudeIndex = frequencyIndex + 0;
          const tuneIndex = frequencyIndex + 1;

          // Note amplitude heads towards target, attacking or releasing
          const likelyReleased = this.partialStates[amplitudeTargetIndex] === 0.0;
          const goingDown = this.partialStates[amplitudeTargetIndex] < this.partialStates[amplitudeIndex];

          this.partialStates[amplitudeIndex] +=
            (this.partialStates[amplitudeTargetIndex] - this.partialStates[amplitudeIndex]) *
            ((goingDown ? release : attack) *
              (goingDown ? partialRelease : partialAttack) *
              (likelyReleased || !goingDown ? multiplier : 1.0));

          // Save fundamental frequency amplitude
          const difference = Math.abs(this.partialStates[amplitudeIndex] - this.partialStates[amplitudeTargetIndex]);

          if (partialIndex === 0) {
            fundamentalAmplitude = this.partialStates[amplitudeIndex];
            fundamentalDifference = difference;
          }

          // Apply effects
          let amplitude = this.partialStates[amplitudeIndex];

          // Apply instability and detune if needed
          if (!goingDown) {
            if (this.attackDetune !== 0.0) {
              const detune =
                (this.attackDetuneUsesPartialAmplitude ? amplitude : fundamentalDifference) * this.attackDetune;
              this.frequencyStates[tuneIndex] *= detune < 0.0 ? 1.0 / (1.0 - detune) : 1.0 + detune;
            }

            if (this.attackPitchInstability !== 0.0) {
              const instability =
                (this.attackInstabilityUsesPartialAmplitude ? difference : fundamentalDifference) *
                this.attackInstabilityWave *
                this.attackPitchInstability;
              this.frequencyStates[tuneIndex] *= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
            }

            if (this.attackBrightnessInstability !== 0.0) {
              const instability =
                (this.attackInstabilityUsesPartialAmplitude ? difference : fundamentalDifference) *
                this.attackInstabilityWave *
                this.attackBrightnessInstability *
                partialOffset;

              amplitude *= instability < 0.0 ? 1.0 / (1.0 - instability) : 1.0 + instability;
            }
          }

          // Apply vibrato if needed
          if (this.pitchVibrato !== 0.0) {
            const vibrato = fundamentalAmplitude * this.pitchVibrato * this.vibratoWave;
            this.frequencyStates[tuneIndex] *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          if (this.brightnessVibrato !== 0.0) {
            const vibrato = fundamentalAmplitude * this.brightnessVibrato * this.vibratoWave * partialOffset;
            amplitude *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          if (this.amplitudeVibrato !== 0.0) {
            const vibrato = fundamentalAmplitude * this.amplitudeVibrato * this.vibratoWave;
            amplitude *= vibrato < 0.0 ? 1.0 / (1.0 - vibrato) : 1.0 + vibrato;
          }

          // Add amplitude to frequencies
          this.frequencyStates[frequencyAmplitudeIndex] += amplitude;
          this.totalAmplitude += amplitude;

          // Decay amplitude target towards sustain level
          this.partialStates[amplitudeTargetIndex] +=
            (this.partialStates[sustainIndex] - this.partialStates[amplitudeTargetIndex]) * decay;
        }
      }

      // Frequencies play sine waves
      let frameAmplitude = 0.0;

      for (let frequencyIndex = 0; frequencyIndex < this.frequencyCount; frequencyIndex++) {
        const frequencyAmplitudeIndex = frequencyIndex * 3 + 0;
        const tuneIndex = frequencyIndex * 3 + 1;
        const phaseIndex = frequencyIndex * 3 + 2;

        const amplitude = this.frequencyStates[frequencyAmplitudeIndex];
        if (amplitude < this.cutoff) continue; // skip if dormant

        // Increase phase
        const frequency = this.frequencies[frequencyIndex * 2 + 0];

        this.frequencyStates[phaseIndex] =
          (this.frequencyStates[phaseIndex] + (frequency * this.frequencyStates[tuneIndex]) / sampleRate) % 1.0;

        // Play sine, amplified by amplitude
        frameAmplitude += Math.sin(this.frequencyStates[phaseIndex] * (Math.PI * 2.0)) * amplitude;
        // frameAmplitude += this.attackInstabilityWave * amplitude;

        // Nullify for next frame
        this.frequencyStates[frequencyAmplitudeIndex] = 0.0;
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
