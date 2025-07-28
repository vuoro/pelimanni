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
