import { html, render } from "lit-html";
import { piano } from "../instrumentPresets";
import { createInstrument, playInstrument } from "../instruments";
import { midiToJustFrequency } from "../notes";
import { AudioSystem } from "./AudioSystem";
import { Magic } from "./magic";

export const Keyboard = new Magic(() => {
  const { audioContext, connectInstrument } = AudioSystem.get();
  const instrument = createInstrument(piano, audioContext);
  connectInstrument(instrument);

  const keys = Keys.get();

  render(html`${keys}`, keyboardElement);

  return { instrument, audioContext };
});

const Keys = new Magic(() => {
  const keys = [];

  for (let octave = 1; octave < 10; octave++) {
    const octaveKeys = [];

    for (let note = 0; note < 12; note++) {
      const isBlack = note === 1 || note === 3 || note === 6 || note === 8 || note === 10;
      octaveKeys.push(key(octave * 12 + note - 60, isBlack));
    }

    keys.push(html`<div class="octave">${octaveKeys}</div>`);
  }

  return html`<div class="keys">${keys}</div>`;
});

const key = (midiNumber: number, isBlack = false) => {
  return html`<button class="${isBlack ? "black" : "white"}" type="button" data-midi-number="${midiNumber}">
    ${midiNumber}
  </button>`;
};

const keyboardElement = document.getElementById("keyboard") as HTMLElement;

const pointersDown = new Set();

keyboardElement.addEventListener("pointerdown", (event) => {
  const target = event.target as HTMLElement;
  if (!target) return;

  target.releasePointerCapture(event.pointerId);
  pointersDown.add(event.pointerId);

  playNote(+(target.dataset.midiNumber ?? 0), event.pressure);
});
keyboardElement.addEventListener("pointerup", (event) => {
  pointersDown.delete(event.pointerId);
});
keyboardElement.addEventListener("pointerout", (event) => {
  if (event.currentTarget === event.target) pointersDown.delete(event.pointerId);
});

keyboardElement.addEventListener("pointerover", (event) => {
  const target = event.target as HTMLElement;
  if (!target) return;

  if (pointersDown.has(event.pointerId)) {
    playNote(+(target.dataset.midiNumber ?? 0), event.pressure);
  }
});

const playNote = (midiNumber = 0, velocity = 0.5) => {
  const { instrument, audioContext } = Keyboard.get();
  if (audioContext.state !== "running") audioContext.resume();

  playInstrument(instrument, midiToJustFrequency(midiNumber), audioContext.currentTime + 0.04, 0.5, velocity, 0.5);
};
