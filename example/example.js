import { scheduleMusic } from "../schedule";
import { AudioSystem } from "./AudioSystem";
import { AudioVisualizer } from "./AudioVisualizer";
import { heavensTower } from "./heavens-tower";

// Example tracks
const { cycle, tracks } = heavensTower();

// Audio system
const audioSystem = AudioSystem();
const playButton = /** @type {HTMLButtonElement} */ (document.getElementById("play"));
const stopButton = /** @type {HTMLButtonElement} */ (document.getElementById("stop"));

playButton.addEventListener("click", () => audioSystem.audioContext.resume());
stopButton.addEventListener("click", () => audioSystem.audioContext.suspend());

// Scheduler
const playAhead = 0.2;
const scheduleTracks = () => {
  scheduleMusic(tracks, cycle, audioSystem.audioContext, audioSystem.connectInstrument, { playAhead });
};

// Visualizer
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("visualizer"));
const drawVisualization = AudioVisualizer(audioSystem, canvas);

const loop = () => {
  drawVisualization();
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);

// Schedules often, but will be throttled to 1000ms when the page is not visible
setInterval(scheduleTracks, (playAhead / 2.0) * 1000.0);

// Schedules music when page visibility changes, to avoid a gap
document.addEventListener("visibilitychange", scheduleTracks);
