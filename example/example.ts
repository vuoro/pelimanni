import InstrumentWorklet from "../InstrumentWorklet.ts?url";
import { frequencyToMidi10, midiToFrequency10 } from "../notes.js";
import { scheduleMusic } from "../schedule.js";
import { AudioControls } from "./AudioControls.ts";
import { AudioSystem } from "./AudioSystem.ts";
import { AudioVisualizer } from "./AudioVisualizer.ts";
import { Keyboard, KeyboardSettings } from "./Keyboard.ts";
import { Magic } from "./magic.ts";
import { Midi } from "./Midi.ts";
import { Music } from "./Music.ts";

export const Tools = new Magic(() => {
  const audioSystem = AudioSystem.get();
  const audioControls = AudioControls.get();
  const drawVisualizer = AudioVisualizer.get();

  Keyboard.get();
  Midi.get();
  KeyboardSettings.get();

  return { audioSystem, audioControls, drawVisualizer };
});

const loop = () => {
  requestAnimationFrame(loop);

  const tools = Tools.get();

  if (tools?.drawVisualizer) {
    // console.log(tools?.audioSystem.limiter.reduction);
    tools?.drawVisualizer();
  }
};

requestAnimationFrame(loop);

const playAhead = 0.2;

const tryToScheduleMusic = () => {
  const music = Music.get();
  const { audioSystem } = Tools.get();
  if (music?.shouldPlay) {
    scheduleMusic(music.tracks, music.cycle, audioSystem.audioContext, audioSystem.connectInstrument, {
      playAhead,
    });
  }
};

setInterval(tryToScheduleMusic, (playAhead / 4.0) * 1000.0);

// Schedules music when page visibility changes, to avoid a gap
document.addEventListener("visibilitychange", tryToScheduleMusic);

Midi.update(true);

const { audioContext, output } = AudioSystem.get();

audioContext.audioWorklet
  .addModule(InstrumentWorklet)
  .then(() => {
    const notes = [];
    const frequencies = [];
    const partials = [];

    const noteStart = 21;
    const noteEnd = 121;

    for (let index = 21; index < noteEnd; index++) {
      notes.push(index);
    }

    for (let index = noteStart * 10; index < 150 * 10; index++) {
      const frequency = midiToFrequency10(index);
      if (frequency > audioContext.sampleRate / 2.0) break;
      frequencies.push(frequency);
    }

    for (let index = 0; index < 16; index++) {
      partials.push(frequencyToMidi10(440 * (1 + index)) - frequencyToMidi10(440));
    }

    const cello = new AudioWorkletNode(audioContext, "Instrument", {
      processorOptions: {
        notePartialOffsets: Uint16Array.from(partials),
        notePartialAttacks: Float64Array.from([
          1.0,
          0.618,
          0.382,
          0.618, // 4
          0.382,
          0.09,
          0.236, // 7
          0.146,
          0.09,
          0.056,
          0.034,
          0.021,
          0.013,
          0.008,
          0.005,
          0.003,
        ]),

        noteDecays: new Float64Array(notes.length).fill(0.008 ** (1.0 / audioContext.sampleRate)),
        partialDecays: Float64Array.from(frequencies).map(
          (frequency) => (0.91 * Math.exp(-0.002 * frequency)) ** (1.0 / audioContext.sampleRate),
        ),

        partialFrequencies: Float64Array.from(frequencies),
        partialAttacks: new Float64Array(frequencies.length).fill(1.0 ** (1.0 / audioContext.sampleRate)),
      },
    });
    cello.port.start();

    cello.connect(output);

    const note = 12 * 6 - noteStart;

    cello.port.postMessage(Float32Array.of(0, note, 1.0, 0.5));
    setTimeout(() => cello.port.postMessage(Float32Array.of(1, note)), 1000);
    setTimeout(() => cello.port.postMessage(Float32Array.of(2)), 5000);
  })
  .catch(console.error);
