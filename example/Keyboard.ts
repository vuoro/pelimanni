import { html, render } from "lit-html";
import * as allInstrumentPresets from "../instrumentPresets.js";
import {
  attackInstrument,
  createInstrument,
  destroyInstrument,
  releaseInstrument,
} from "../instruments";
import { midiToFrequency } from "../notes";
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
      keyboardOctave: number;
    } = {
      instrumentName: ((localStorage.getItem("instrumentName") ?? "none") in allInstrumentPresets
        ? localStorage.getItem("instrumentName")
        : "piano") as keyof typeof allInstrumentPresets,
      velocity: +(localStorage.getItem("velocity") ?? 0.6),
      duration: +(localStorage.getItem("duration") ?? 0.5),
      vibratoAmount: +(localStorage.getItem("vibratoAmount") ?? 0.0),
      vibratoFrequency: +(localStorage.getItem("vibratoFrequency") ?? 5.0),
      keyboardOctave: +(localStorage.getItem("keyboardOctave") ?? 5),
    },
    message?: {
      instrumentName?: keyof typeof allInstrumentPresets;
      velocity?: number;
      duration?: number;
      vibratoAmount?: number;
      vibratoFrequency?: number;
      keyboardOctave?: number;
    },
  ) => {
    if (message) {
      if (message.instrumentName) {
        state.instrumentName = message.instrumentName;
      }

      if (message.velocity !== undefined) state.velocity = message.velocity;
      if (message.vibratoAmount !== undefined) state.vibratoAmount = message.vibratoAmount;
      if (message.vibratoFrequency !== undefined) state.vibratoFrequency = message.vibratoFrequency;
      if (message.keyboardOctave !== undefined) state.keyboardOctave = message.keyboardOctave;
    }

    const change = (event: Event) => {
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const instrumentName = data.get("instrumentName") as keyof typeof allInstrumentPresets;
      const velocity = data.get("velocity") as string;
      const vibratoAmount = data.get("vibratoAmount") as string;
      const vibratoFrequency = data.get("vibratoFrequency") as string;
      const keyboardOctave = data.get("keyboardOctave") as string;

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
      if (+vibratoAmount !== current.vibratoAmount) {
        localStorage.setItem("vibratoAmount", vibratoAmount);
        Keyboard.update({ vibratoAmount: +vibratoAmount });
      }
      if (+vibratoFrequency !== current.vibratoFrequency) {
        localStorage.setItem("vibratoFrequency", vibratoFrequency);
        Keyboard.update({ vibratoFrequency: +vibratoFrequency });
      }
      if (+keyboardOctave !== current.keyboardOctave) {
        localStorage.setItem("keyboardOctave", keyboardOctave);
        Keyboard.update({ keyboardOctave: +keyboardOctave });
      }
    };

    render(
      html`
        <h2>Keyboard demo</h2>
        <form @change=${change}>
          <fieldset>
            <legend>Settings</legend>
            ${instrumentSelect(state.instrumentName, "instrumentName", "Instrument preset")}
            ${velocityInput(state.velocity)}
            ${vibratoAmountInput(state.vibratoAmount)}
            ${vibratoFrequencyInput(state.vibratoFrequency)}
            ${octaveInput(state.keyboardOctave)}
          </fieldset>
        </form>
        ${Keys.get()}
        <p>You can play with mouse, touch, or keyboard. MIDI support coming whenever I manage to buy a device to test it with.</p>
        <p>When playing with a keyboard, use the 12345/QWERTY/ASDFG rows. You can adjust their octaves with the "Keyboard octave" slider above. Hold shift for full velocity, alt for lowest velocity, or shift+alt for full vibrato.</p>
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
        <span>Velocity: ${velocity}</span>
        <input name="velocity" type="range" min="0" max="1" step="0.1" .value=${velocity}/>
      </label>
    </div>
  `;
};

const vibratoAmountInput = (vibratoAmount: number) => {
  return html`
    <div>
      <label>
        <span>Vibrato: ${vibratoAmount}</span>
        <input name="vibratoAmount" type="range" min="0.0" max="1" step="0.1" .value=${vibratoAmount}/>
      </label>
    </div>
  `;
};

const vibratoFrequencyInput = (vibratoFrequency: number) => {
  return html`
    <div>
      <label>
        <span>Vibrato: ${vibratoFrequency}hz</span>
        <input name="vibratoFrequency" type="range" min="0.0" max="10" step="0.5" .value=${vibratoFrequency}/>
      </label>
    </div>
  `;
};

const octaveInput = (octave: number) => {
  return html`
    <div>
      <label>
        <span>Keyboard octave: ${octave - 1}</span>
        <input name="keyboardOctave" type="range" min="2" max="9" step="1" .value=${octave}/>
      </label>
    </div>
  `;
};

export const instrumentSelect = (selected: string, name: string, label?: string) => {
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
        ${label && html`<span>${label}</span>`}
        <select name=${name}>${options}</select>
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
    attackWithController(
      event.pointerId,
      +(target.dataset.midiNumber ?? 0),
      event.shiftKey,
      event.altKey,
    );

    event.stopPropagation();
  };

  const pointerup = (event: PointerEvent) => {
    pointersDown.delete(event.pointerId);
    releaseWithController(event.pointerId);

    event.stopPropagation();
  };

  const pointerout = (event: PointerEvent) => {
    releaseWithController(event.pointerId);

    event.stopPropagation();
  };

  const pointerover = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (pointersDown.has(event.pointerId))
      attackWithController(
        event.pointerId,
        +(target.dataset.midiNumber ?? 0),
        event.shiftKey,
        event.altKey,
      );

    event.stopPropagation();
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

const pointersDown = new Set();

const key = (note: number, octave: number, isBlack = false) => {
  const labels = "CCDDEFFGGAAB";
  return html`<button class="${isBlack ? "black" : "white"}" type="button" data-midi-number="${note + octave * 12}">
    <span>${labels[note]}<sup>${octave - 1}</sup></span>
  </button>`;
};

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const { code, repeat, metaKey, ctrlKey } = event;
  if (repeat || metaKey || ctrlKey) return;

  const { keyboardOctave } = Keyboard.get();

  const higherOctave = 12 * (keyboardOctave + 1);
  const highOctave = 12 * (keyboardOctave + 0);
  const midOctave = 12 * (keyboardOctave - 1);

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
  };

  const note = notes[code as keyof typeof notes];
  if (note === undefined) return;

  attackWithController(code, note, event.shiftKey, event.altKey);
});

document.addEventListener("keyup", (event: KeyboardEvent) => {
  const { code, repeat } = event;
  if (repeat) return;
  releaseWithController(code);
});

document.addEventListener("visibilitychange", () => {
  pointersDown.clear();

  for (const [controllerId] of playingControllers) {
    releaseWithController(controllerId);
  }
});

document.body.addEventListener("pointerup", (event: PointerEvent) => {
  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId)) releaseWithController(event.pointerId);
});

document.body.addEventListener("pointerout", (event: PointerEvent) => {
  if (event.target !== event.currentTarget) return;

  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId)) releaseWithController(event.pointerId);
});

type Instrument = ReturnType<typeof createInstrument>;
type ControllerId = PointerEvent["pointerId"] | KeyboardEvent["code"];
const freeInstruments = new Set<Instrument>();
const playingControllers = new Map<ControllerId, Instrument>();

const attackWithController = (
  controllerId: ControllerId,
  midiNumber = 0,
  shiftKey = false,
  altKey = false,
) => {
  const { instrumentName, velocity, vibratoAmount, vibratoFrequency } = Keyboard.get();
  const { audioContext, connectInstrument } = AudioSystem.get();

  if (audioContext.state !== "running") audioContext.resume();

  const isAlreadyPlaying = playingControllers.has(controllerId);
  if (isAlreadyPlaying) releaseWithController(controllerId);

  const preset = allInstrumentPresets[instrumentName];

  let instrument: Instrument | null = null;

  for (const freeInstrument of freeInstruments) {
    if (!instrument && freeInstrument.preset === preset) {
      // Use instrument
      console.log("adopting", controllerId);
      instrument = freeInstrument;
      freeInstruments.delete(freeInstrument);
    } else if (freeInstrument.previousEndAt + 5 < audioContext.currentTime) {
      // Destroy long unused instrument
      console.log("destroying");
      destroyInstrument(freeInstrument);
      freeInstruments.delete(freeInstrument);
    }
  }

  // Create new instrument if needed
  if (!instrument) {
    console.log("creating", controllerId);
    instrument = createInstrument(preset, audioContext);
    connectInstrument(instrument);
  }

  playingControllers.set(controllerId, instrument);

  attackInstrument(
    instrument,
    midiToFrequency(midiNumber),
    audioContext.currentTime + (isAlreadyPlaying ? 0.04 : 0.0),
    shiftKey && !altKey ? 1.0 : altKey && !shiftKey ? 0.0 : velocity,
    0.382,
    shiftKey && altKey ? 1.0 : vibratoAmount,
    vibratoFrequency,
  );

  const key = document.querySelector(`[data-midi-number="${midiNumber}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.add("active");
    key.dataset.controller = `${controllerId}`;
  }
};

const releaseWithController = (controllerId: ControllerId) => {
  const { audioContext } = AudioSystem.get();
  const instrument = playingControllers.get(controllerId);
  if (!instrument) return;

  releaseInstrument(instrument, audioContext.currentTime);

  playingControllers.delete(controllerId);
  freeInstruments.add(instrument);

  const key = document.querySelector(`[data-controller="${controllerId}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.remove("active");
    key.dataset.controller = "free";
  }
};
