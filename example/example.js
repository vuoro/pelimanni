import { midiToJustFrequency } from "../notes.js";
import { scheduleMusic } from "../schedule.js";
import { AudioControls } from "./AudioControls.ts";
import { AudioSystem } from "./AudioSystem.ts";
import { AudioVisualizer } from "./AudioVisualizer.ts";
import { Keyboard } from "./Keyboard.ts";
import { Magic } from "./magic.ts";
import { Music } from "./Music.ts";

export const Tools = new Magic(() => {
  const audioSystem = AudioSystem.get();
  const keyboard = Keyboard.get();
  const audioControls = AudioControls.get();
  const drawVisualizer = AudioVisualizer.get();

  return { audioSystem, audioControls, keyboard, drawVisualizer };
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
  return;
  const music = Music.get();
  const { audioSystem } = Tools.get();

  if (music) {
    scheduleMusic(music.tracks, music.cycle, audioSystem.audioContext, audioSystem.connectInstrument, {
      playAhead,
      numberToFrequency: midiToJustFrequency,
    });
  }
};

setInterval(tryToScheduleMusic, (playAhead / 4.0) * 1000.0);

// Schedules music when page visibility changes, to avoid a gap
document.addEventListener("visibilitychange", tryToScheduleMusic);
