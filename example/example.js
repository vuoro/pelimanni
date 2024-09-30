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
const scheduleTracks = () => {
  scheduleMusic(tracks, cycle, audioSystem.audioContext, audioSystem.connectInstrument);
};

// Visualizer
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("visualizer"));
const drawVisualization = AudioVisualizer(audioSystem, canvas);

const loop = () => {
  scheduleTracks();
  drawVisualization();
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);
