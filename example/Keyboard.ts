import { html, render } from "lit-html";
import * as allInstrumentPresets from "../instrumentPresets.js";
import { createInstrument, destroyInstrument, playInstrument } from "../instruments";
import { midiToJustFrequency } from "../notes";
import { AudioSystem } from "./AudioSystem";
import { Magic } from "./magic";

export const Keyboard = new Magic(
  (
    state: {
      instrumentName: keyof typeof allInstrumentPresets;
      velocity: number;
      duration: number;
      vibratoAmount: number;
      vibratoFrequency: number;
    } = {
      instrumentName: ((localStorage.getItem("instrumentName") ?? "none") in allInstrumentPresets
        ? localStorage.getItem("instrumentName")
        : "piano") as keyof typeof allInstrumentPresets,
      velocity: +(localStorage.getItem("velocity") ?? 0.5),
      duration: +(localStorage.getItem("duration") ?? 0.5),
      vibratoAmount: +(localStorage.getItem("vibratoAmount") ?? 0.0),
      vibratoFrequency: +(localStorage.getItem("vibratoFrequency") ?? 5.0),
    },
    message?: {
      instrumentName?: keyof typeof allInstrumentPresets;
      velocity?: number;
      duration?: number;
      vibratoAmount?: number;
      vibratoFrequency?: number;
    },
  ) => {
    if (message) {
      if (message.instrumentName) {
        state.instrumentName = message.instrumentName;
      }

      if (message.velocity !== undefined) state.velocity = message.velocity;
      if (message.duration !== undefined) state.duration = message.duration;
      if (message.vibratoAmount !== undefined) state.vibratoAmount = message.vibratoAmount;
      if (message.vibratoFrequency !== undefined) state.vibratoFrequency = message.vibratoFrequency;
    }

    const keys = Keys.get();

    const change = (event: Event) => {
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const instrumentName = data.get("instrumentName") as keyof typeof allInstrumentPresets;
      const velocity = data.get("velocity") as string;
      const duration = data.get("duration") as string;
      const vibratoAmount = data.get("vibratoAmount") as string;
      const vibratoFrequency = data.get("vibratoFrequency") as string;

      const current = Keyboard.get();

      if (instrumentName !== current.instrumentName && instrumentName in allInstrumentPresets) {
        localStorage.setItem("instrumentName", instrumentName);
        Keyboard.update({
          instrumentName,
        });
      }
      if (+velocity !== current.velocity) {
        localStorage.setItem("velocity", velocity);
        Keyboard.update({ velocity: +velocity });
      }
      if (+duration !== current.duration) {
        localStorage.setItem("duration", duration);
        Keyboard.update({ duration: +duration });
      }
      if (+vibratoAmount !== current.vibratoAmount) {
        localStorage.setItem("vibratoAmount", vibratoAmount);
        Keyboard.update({ vibratoAmount: +vibratoAmount });
      }
      if (+vibratoFrequency !== current.vibratoFrequency) {
        localStorage.setItem("vibratoFrequency", vibratoFrequency);
        Keyboard.update({ vibratoFrequency: +vibratoFrequency });
      }
    };

    render(
      html`
        <form @change=${change}>
          ${instrumentSelect(state.instrumentName)}
          ${velocityInput(state.velocity)}
          ${durationInput(state.duration)}
          ${vibratoAmountInput(state.vibratoAmount)}
          ${vibratoFrequencyInput(state.vibratoFrequency)}
        </form>
        ${keys}
        <p>Hold shift for 2x duration, alt for 0.5x duration, or shift+alt for 4x duration. Keyboard is mapped to octaves 2–5.</p>
      `,
      document.getElementById("keyboard") as HTMLElement,
    );

    return state;
  },
);

const velocityInput = (velocity: number) => {
  return html`
    <div>
      <label>
        <span>Velocity</span>
        <input name="velocity" type="number" min="0" max="1" step="0.1" .value=${velocity}/>
      </label>
    </div>
  `;
};

const durationInput = (duration: number) => {
  return html`
    <div>
      <label>
        <span>Duration (s)</span>
        <input name="duration" type="number" min="0.01" max="30" step="0.1" .value=${duration}/>
      </label>
    </div>
  `;
};

const vibratoAmountInput = (vibratoAmount: number) => {
  return html`
    <div>
      <label>
        <span>Vibrato</span>
        <input name="vibratoAmount" type="number" min="0.0" max="2" step="0.1" .value=${vibratoAmount}/>
      </label>
    </div>
  `;
};

const vibratoFrequencyInput = (vibratoFrequency: number) => {
  return html`
    <div>
      <label>
        <span>Vibrato (hz)</span>
        <input name="vibratoFrequency" type="number" min="0.0" max="20" step="1" .value=${vibratoFrequency}/>
      </label>
    </div>
  `;
};

const instrumentSelect = (selected: string) => {
  const groupArrays = new Map();

  for (const name in allInstrumentPresets) {
    const { group } = allInstrumentPresets[name as keyof typeof allInstrumentPresets];
    const groupArray = groupArrays.get(group) ?? groupArrays.set(group, []).get(group);
    groupArray.push(html`<option value="${name}" ?selected=${selected === name}>${name}</option>`);
  }

  const options = [];

  for (const [group, groupArray] of [...groupArrays.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    options.push(html`<optgroup label=${group}>${groupArray}</optgroup>`);
  }

  return html`
    <div>
      <label>
        <span>Instrument</span>
        <select name="instrumentName">${options}</select>
      </label>
    </div>
  `;
};

const Keys = new Magic(() => {
  const keys = [];

  for (let octave = 1; octave < 11; octave++) {
    const octaveKeys = [];

    for (let note = 0; note < 12; note++) {
      const isBlack = note === 1 || note === 3 || note === 6 || note === 8 || note === 10;
      octaveKeys.push(key(note, octave, isBlack));
    }

    keys.push(html`<div class="octave">${octaveKeys}</div>`);
  }

  const pointerdown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    target.releasePointerCapture(event.pointerId);
    pointersDown.add(event.pointerId);

    if (!target.dataset.midiNumber) return;
    const durationMultiplier = getDurationMultiplier(event);
    playNote(+(target.dataset.midiNumber ?? 0), durationMultiplier);
  };

  const pointerup = (event: PointerEvent) => {
    pointersDown.delete(event.pointerId);
  };

  const pointerout = (event: PointerEvent) => {
    if (event.currentTarget === event.target) pointersDown.delete(event.pointerId);
  };

  const pointerover = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (!target.dataset.midiNumber || !pointersDown.has(event.pointerId)) return;
    const durationMultiplier = getDurationMultiplier(event);
    playNote(+(target.dataset.midiNumber ?? 0), durationMultiplier);
  };

  return html`
    <div class="keys"
      @pointerdown=${pointerdown}
      @pointerup=${pointerup}
      @pointerout=${pointerout}
      @pointerover=${pointerover}
    >
      ${keys}
    </div>
  `;
});

const key = (note: number, octave: number, isBlack = false) => {
  const labels = "CCDDEFFGGAAB";
  return html`<button class="${isBlack ? "black" : "white"}" type="button" data-midi-number="${note + octave * 12}">
    <span>${labels[note]}<sup>${octave - 1}</sup></span>
  </button>`;
};

const pointersDown = new Set();

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const { code, repeat, shiftKey, altKey } = event;
  if (repeat) return;

  const higherOctave = 12 * 6;
  const highOctave = 12 * 5;
  const midOctave = 12 * 4;
  const lowOctave = 12 * 3;

  const notes = {
    Digit1: 0 + higherOctave,
    Digit2: 1 + higherOctave,
    Digit3: 2 + higherOctave,
    Digit4: 3 + higherOctave,
    Digit5: 4 + higherOctave,
    Digit6: 5 + higherOctave,
    Digit7: 6 + higherOctave,
    Digit8: 7 + higherOctave,
    Digit9: 8 + higherOctave,
    Digit0: 9 + higherOctave,
    Minus: 10 + higherOctave,
    Equal: 11 + higherOctave,

    KeyQ: 0 + highOctave,
    KeyW: 1 + highOctave,
    KeyE: 2 + highOctave,
    KeyR: 3 + highOctave,
    KeyT: 4 + highOctave,
    KeyY: 5 + highOctave,
    KeyU: 6 + highOctave,
    KeyI: 7 + highOctave,
    KeyO: 8 + highOctave,
    KeyP: 9 + highOctave,
    BracketLeft: 10 + highOctave,
    BracketRight: 11 + highOctave,

    KeyA: 0 + midOctave,
    KeyS: 1 + midOctave,
    KeyD: 2 + midOctave,
    KeyF: 3 + midOctave,
    KeyG: 4 + midOctave,
    KeyH: 5 + midOctave,
    KeyJ: 6 + midOctave,
    KeyK: 7 + midOctave,
    KeyL: 8 + midOctave,
    Semicolon: 9 + midOctave,
    Quote: 10 + midOctave,
    Backslash: 11 + midOctave,

    Backquote: 0 + lowOctave,
    KeyZ: 1 + lowOctave,
    KeyX: 2 + lowOctave,
    KeyC: 3 + lowOctave,
    KeyV: 4 + lowOctave,
    KeyB: 5 + lowOctave,
    KeyN: 6 + lowOctave,
    KeyM: 7 + lowOctave,
    Comma: 8 + lowOctave,
    Period: 9 + lowOctave,
    Slash: 10 + lowOctave,
    // ShiftRight: 11 + lowOctave,
  };

  const note = notes[code as keyof typeof notes];

  if (note === undefined) return;

  const durationMultiplier = getDurationMultiplier(event);
  playNote(note, durationMultiplier);
});

const getDurationMultiplier = (event: KeyboardEvent | PointerEvent) => {
  if (event.shiftKey && event.altKey) return 4.0;
  if (event.shiftKey) return 2.0;
  if (event.altKey) return 0.5;
};

const freeInstruments = new Set<ReturnType<typeof createInstrument>>();
const playingInstruments = new Set<ReturnType<typeof createInstrument>>();

const playNote = (midiNumber = 0, durationMultiplier = 1.0) => {
  const { instrumentName, velocity, duration, vibratoAmount, vibratoFrequency } = Keyboard.get();
  const { audioContext, connectInstrument } = AudioSystem.get();

  if (audioContext.state !== "running") audioContext.resume();

  const preset = allInstrumentPresets[instrumentName];

  // Save instruments that are done playing their notes
  for (const instrument of playingInstruments) {
    if (instrument.willPlayUntil < audioContext.currentTime) {
      playingInstruments.delete(instrument);
      freeInstruments.add(instrument);
      console.log("save", instrumentName);
    }
  }

  let instrument: ReturnType<typeof createInstrument>;

  // Find an instrument, and cull any that that haven't been used for a while
  for (const freeInstrument of freeInstruments) {
    if (!instrument && freeInstrument.preset === preset) {
      instrument = freeInstrument;
      freeInstruments.delete(instrument);
      continue;
    }

    if (freeInstrument.willPlayUntil < audioContext.currentTime - 5) {
      freeInstruments.delete(freeInstrument);
      destroyInstrument(freeInstrument);
      console.log("destroy", instrumentName);
    }
  }

  if (!instrument) {
    instrument = createInstrument(allInstrumentPresets[instrumentName], audioContext);
    connectInstrument(instrument);
    console.log("create", instrumentName);
  }

  playingInstruments.add(instrument);

  playInstrument(
    instrument,
    midiToJustFrequency(midiNumber),
    audioContext.currentTime,
    duration * durationMultiplier,
    velocity,
    0.5,
    vibratoAmount,
    vibratoFrequency,
  );
};
