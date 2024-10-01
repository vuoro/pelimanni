import * as instrumentPresets from "../instrumentPresets.js";
import dattorroReverb from "./dattorro-reverb.js?url";

const allInstruments = new Map(Object.entries(instrumentPresets).map(([name, preset]) => [preset, name]));

export const defaultReverbOptions = {
  preDelay: 0.013, // could be up to 0.04ms before being obvious
  bandwidth: 0.854,
  inputDiffusion1: 0.236,
  inputDiffusion2: 0.236,
  decay: 0.382,
  decayDiffusion1: 0.236,
  decayDiffusion2: 0.236,
  damping: 0.146,
  excursionRate: 0.0,
  excursionDepth: 0.0,
  dry: Math.SQRT1_2,
  wet: 1.0 - Math.SQRT1_2,
};

export const AudioSystem = () => {
  // General nodes and reverb
  const audioContext = new AudioContext();
  const musicGain = new GainNode(audioContext, { gain: 0.5 });
  const mainGain = new GainNode(audioContext, { gain: 1.0 });
  const musicCompressor = new DynamicsCompressorNode(audioContext, { threshold: -24, ratio: 12 });
  const limiter = new DynamicsCompressorNode(audioContext, {
    threshold: 0,
    ratio: 1,
    attack: 0.0001,
  });
  const highPass = new BiquadFilterNode(audioContext, { type: "highpass", frequency: 20 });
  const lowPass = new BiquadFilterNode(audioContext, { type: "lowpass", frequency: 20000 });

  musicCompressor.connect(musicGain).connect(mainGain);

  lowPass.connect(highPass).connect(limiter).connect(audioContext.destination);

  let reverb = null;

  /**
   * @param {object} options
   * @param {number} options.preDelay extra distance the first reflection has to travel, in seconds; room-like sounds (0–1)
   * @param {number} options.bandwidth first reflection lowpass filter weakness; hard spaces (0–1)
   * @param {number} options.inputDiffusion1 first reflection diffusion amount; uneven spaces (0–1)
   * @param {number} options.inputDiffusion2 first reflection alternating diffusion amount; uneven spaces (0–1)
   * @param {number} options.decay echoiness; space enclosedness (0–1)
   * @param {number} options.decayDiffusion1 diffusion amount; uneven spaces (0–1)
   * @param {number} options.decayDiffusion2 alternating diffusion amount; uneven spaces (0–1)
   * @param {number} options.damping lowpass filter strength; soft spaces (0–1)
   * @param {number} options.excursionRate how quickly diffusors shift in time; wandering echo (0–2)
   * @param {number} options.excursionDepth how much diffusors shift; booming echo (0–2)
   * @param {number} options.dry how much of the original sound is heard (0–1)
   * @param {number} options.wet how much of reverb is heard (0–1)
   * @param {number} speed `timeConstant` passed to `setTargetAtTime` when setting the new values
   */
  const configureReverb = (options, speed = 0.618) => {
    const time = audioContext.currentTime;

    for (const key in options) {
      const value = options[key];
      const finalValue = key === "preDelay" ? value * audioContext.sampleRate : value;
      reverb.parameters.get(key).setTargetAtTime(finalValue, time, speed);
    }
  };

  audioContext.audioWorklet
    .addModule(dattorroReverb)
    .then(() => {
      reverb = new AudioWorkletNode(audioContext, "DattorroReverb", {
        outputChannelCount: [2],
      });

      configureReverb(defaultReverbOptions);

      mainGain.connect(reverb).connect(lowPass);
    })
    .catch((error) => {
      mainGain.connect(lowPass);
      (reportError || console.error)("Failed to load reverb module, skipping reverb", {
        cause: error,
      });
    });

  const panningCycle = 17;
  const panningPositions = 29;
  const panningSpread = 0.2;
  let panningIndex = Math.round(Math.random() * 10);

  const connectInstrument = (
    /** @type {ReturnType<typeof import("../instruments.js").createInstrument>} */ instrument,
  ) => {
    const panningPosition = (panningCycle * panningIndex++) % panningPositions;
    const pan = panningSpread * ((panningPosition / panningPositions) * 2.0 - 1.0);
    console.log("connecting instrument", allInstruments.get(instrument?.preset), "panned by", pan);

    const panner = new StereoPannerNode(audioContext, { pan });

    panner.connect(musicCompressor);
    instrument.output.connect(panner);
  };

  return {
    audioContext,
    mainGain,
    musicGain,
    musicCompressor,
    limiter,
    output: limiter,
    configureReverb,
    connectInstrument,
  };
};
