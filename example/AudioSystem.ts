import * as instrumentPresets from "../instrumentPresets.js";
import type { createInstrument } from "../instruments.js";
import dattorroReverb from "./dattorro-reverb.js?url";
import { Magic } from "./magic";

const allInstruments = new Map(
  Object.entries(instrumentPresets).map(([name, preset]) => [preset, name]),
);

export const AudioSystem = new Magic(
  (previousAudioSystem?: {
    audioContext: AudioContext;
    mainGain: GainNode;
    effectsGain: GainNode;
    musicGain: GainNode;
    musicCompressor: DynamicsCompressorNode;
    effectsCompressor: DynamicsCompressorNode;
    lowPass: BiquadFilterNode;
    limiter: DynamicsCompressorNode;
    output: AudioNode;
    reverb: Promise<AudioWorkletNode>;
    connectInstrument: (instrument: ReturnType<typeof createInstrument>) => void;
  }) => {
    if (previousAudioSystem) {
      const { audioContext } = previousAudioSystem;
      if (audioContext.state !== "closed") audioContext.close();
      audioContext.removeEventListener("statechange", onStateChange);
    }

    // General nodes and reverb
    const audioContext = new AudioContext({ latencyHint: "interactive" });
    const musicGain = new GainNode(audioContext, { gain: 0.5 });
    const effectsGain = new GainNode(audioContext, { gain: 0.5 });
    const mainGain = new GainNode(audioContext, { gain: 1.0 });
    const effectsCompressor = new DynamicsCompressorNode(audioContext, {
      threshold: -12,
      ratio: 12,
    });
    const musicCompressor = new DynamicsCompressorNode(audioContext, { threshold: -12, ratio: 12 });
    const limiter = new DynamicsCompressorNode(audioContext, {
      threshold: 0,
      ratio: 1,
      attack: 0.0001,
    });

    // Values from https://github.com/musios-app/equal-loudness
    const lowPeak = new BiquadFilterNode(audioContext, {
      type: "peaking",
      frequency: 25,
      Q: 0.1,
      gain: 3.162278,
    });
    const midPeak = new BiquadFilterNode(audioContext, {
      type: "peaking",
      frequency: 2500,
      Q: 0.4,
      gain: 0.74817,
    });
    const highPeak = new BiquadFilterNode(audioContext, {
      type: "peaking",
      frequency: 16000,
      Q: 0.2,
      gain: 1.035142,
    });

    const highPass = new BiquadFilterNode(audioContext, { type: "highpass", frequency: 20 });
    const lowPass = new BiquadFilterNode(audioContext, { type: "lowpass", frequency: 20000 });

    musicCompressor.connect(musicGain).connect(mainGain);
    effectsCompressor.connect(effectsGain).connect(mainGain);

    lowPeak
      .connect(midPeak)
      .connect(highPeak)
      .connect(lowPass)
      .connect(highPass)
      .connect(limiter)
      .connect(audioContext.destination);

    audioContext.addEventListener("statechange", onStateChange);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("pause", () => audioContext.suspend());
      navigator.mediaSession.setActionHandler("play", () => audioContext.resume());
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Audio Playground",
        artist: "Vuoro",
        // album: "Playground",
        // artwork: [{ src: "favicon.png" }],
      });
    }

    let resolveReverb: (value: AudioWorkletNode) => void;
    const reverb: Promise<AudioWorkletNode> = new Promise((resolve) => {
      resolveReverb = resolve;
    });

    audioContext.audioWorklet
      .addModule(dattorroReverb)
      .then(() => {
        const reverbNode = new AudioWorkletNode(audioContext, "DattorroReverb", {
          outputChannelCount: [2],
          parameterData: {
            ...defaultReverbParameters,
            preDelay: defaultReverbParameters.preDelay * audioContext.sampleRate,
          },
        });

        mainGain.connect(reverbNode).connect(lowPeak);

        resolveReverb(reverbNode);
      })
      .catch((error) => {
        mainGain.connect(lowPeak);
        (reportError || console.error)(error);
      });

    let panningIndex = Math.round(Math.random() * 10);

    const connectInstrument = (instrument: ReturnType<typeof createInstrument>) => {
      const panningCycle = 17;
      const panningPositions = 29;
      const panningSpread = 0.146;

      const panningPosition = (panningCycle * panningIndex++) % panningPositions;
      const pan = panningSpread * ((panningPosition / panningPositions) * 2.0 - 1.0);
      console.log(
        "connecting instrument",
        allInstruments.get(instrument?.preset),
        "panned by",
        pan,
      );

      const panner = new StereoPannerNode(audioContext, { pan });

      panner.connect(musicCompressor);
      instrument.output.connect(panner);
    };

    return {
      audioContext,
      mainGain,
      effectsGain,
      musicGain,
      musicCompressor,
      effectsCompressor,
      lowPass,
      limiter,
      output: limiter,
      reverb,
      connectInstrument,
    };
  },
);

const onStateChange = function (this: AudioContext) {
  if (this.state === "closed") {
    AudioSystem.update({ type: "reopen" });
  }
};

export const defaultReverbParameters = {
  preDelay: 0.034, // could be up to 0.04ms before being obvious
  bandwidth: 0.91,
  inputDiffusion1: 0.414,
  inputDiffusion2: 0.666,
  decay: 0.236,
  decayDiffusion1: 0.3,
  decayDiffusion2: 0.618,
  damping: 0.09,
  excursionRate: 0.146,
  excursionDepth: 0.382,
  dry: 0.618,
  wet: 0.382,
};
