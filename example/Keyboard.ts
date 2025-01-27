import { html, nothing, render } from "lit-html";
import * as allInstrumentPresets from "../instrumentPresets.js";
import {
  attackInstrument,
  createInstrument,
  destroyInstrument,
  releaseInstrument,
} from "../instruments";
import { frequencyToMidi, midiToFrequency } from "../notes";
import { AudioSystem } from "./AudioSystem";
import { Magic } from "./magic";

export const Keyboard = new Magic(
  (
    state: {
      instrumentName: keyof typeof allInstrumentPresets;
      velocity: number;
      attackMultiplier: number;
      releaseMultiplier: number;
      duration: number;
      vibratoAmount: number;
      vibratoFrequency: number;
      keyboardOffset: number;
      blackKeys: string[];
    } = {
      instrumentName: ((localStorage.getItem("instrumentName") ?? "none") in allInstrumentPresets
        ? localStorage.getItem("instrumentName")
        : "piano") as keyof typeof allInstrumentPresets,
      velocity: +(localStorage.getItem("velocity") ?? 0.7),
      attackMultiplier: +(localStorage.getItem("attackMultiplier") ?? 1.0),
      releaseMultiplier: +(localStorage.getItem("releaseMultiplier") ?? 1.0),
      duration: +(localStorage.getItem("duration") ?? 0.5),
      vibratoAmount: +(localStorage.getItem("vibratoAmount") ?? 0.0),
      vibratoFrequency: +(localStorage.getItem("vibratoFrequency") ?? 5.0),
      keyboardOffset: +(localStorage.getItem("keyboardOffset") ?? 60),
      blackKeys: JSON.parse(localStorage.getItem("blackKeys") || '["1", "3", "6", "8", "10"]'),
    },
    message?: {
      instrumentName: keyof typeof allInstrumentPresets;
      velocity: number;
      attackMultiplier: number;
      releaseMultiplier: number;
      vibratoAmount: number;
      vibratoFrequency: number;
      keyboardOffset: number;
      blackKeys: string[];
    },
  ) => {
    if (message) {
      Object.assign(state, message);
    }

    const onInput = (event: Event) => {
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const instrumentName = data.get("instrumentName") as keyof typeof allInstrumentPresets;
      const velocity = data.get("velocity") as string;
      const attackMultiplier = data.get("attackMultiplier") as string;
      const releaseMultiplier = data.get("releaseMultiplier") as string;
      const vibratoAmount = data.get("vibratoAmount") as string;
      const vibratoFrequency = data.get("vibratoFrequency") as string;
      const keyboardOffset = data.get("keyboardOffset") as string;
      const blackKeys = data.getAll("blackKeys") as string[];

      localStorage.setItem("instrumentName", instrumentName);
      localStorage.setItem("velocity", velocity);
      localStorage.setItem("attackMultiplier", attackMultiplier);
      localStorage.setItem("releaseMultiplier", releaseMultiplier);
      localStorage.setItem("vibratoAmount", vibratoAmount);
      localStorage.setItem("vibratoFrequency", vibratoFrequency);
      localStorage.setItem("keyboardOffset", keyboardOffset);
      localStorage.setItem("blackKeys", JSON.stringify(blackKeys));

      Keyboard.update({
        instrumentName,
        velocity: +velocity,
        attackMultiplier: +attackMultiplier,
        releaseMultiplier: +releaseMultiplier,
        vibratoAmount: +vibratoAmount,
        vibratoFrequency: +vibratoFrequency,
        keyboardOffset: +keyboardOffset,
        blackKeys,
      });
    };

    const blackKeysSet = new Set(state.blackKeys);
    const instrumentPreset =
      allInstrumentPresets[state.instrumentName as keyof typeof allInstrumentPresets];
    const keyboard = keys(
      blackKeysSet,
      frequencyToMidi(instrumentPreset?.highPassFrequency ?? 20.0) - 1,
      frequencyToMidi(instrumentPreset?.lowPassFrequency ?? 20000.0) + 1,
    );

    render(
      html`
        <h2>Playable demo</h2>
        ${keyboard}
        <form @input=${onInput}>
          <fieldset>
            <legend>Play settings</legend>
            ${instrumentSelect(state.instrumentName, "instrumentName", "Instrument preset")}
            ${blackKeysInput(blackKeysSet)}
            ${velocityInput(state.velocity)}
            ${attackMultiplierInput(state.attackMultiplier)}
            ${releaseMultiplierInput(state.releaseMultiplier)}
            ${vibratoAmountInput(state.vibratoAmount)}
            ${vibratoFrequencyInput(state.vibratoFrequency)}
            ${keyboardOffsetInput(state.keyboardOffset)}
          </fieldset>
        </form>
        <p>You can play with mouse, touch, or keyboard. MIDI support coming whenever I manage to buy a device to test it with.</p>
        <p>When playing with a keyboard, use 12345/QWERTY/ASDFG/ZXCVB rows (other keyboard layouts should also work… mostly). You can adjust their notes with the "Keyboard offset" slider above. Hold shift for full velocity, alt for lowest velocity, or shift+alt for full vibrato.</p>
      `,
      document.getElementById("keyboard") as HTMLElement,
    );

    return state;
  },
);

const velocityInput = (velocity: number) => {
  return html`
    <label>
      <span>Brightness: ${velocity}</span>
      <input name="velocity" type="range" min="0" max="1" step="0.1" .value=${velocity}/>
    </label>
  `;
};

const attackMultiplierInput = (attackMultiplier: number) => {
  return html`
    <label>
      <span>Attack multiplier: ${attackMultiplier}</span>
      <input name="attackMultiplier" type="range" min="0.125" max="8" step="0.125" .value=${attackMultiplier}/>
    </label>
  `;
};

const releaseMultiplierInput = (releaseMultiplier: number) => {
  return html`
    <label>
      <span>Release multiplier: ${releaseMultiplier}</span>
      <input name="releaseMultiplier" type="range" min="0.125" max="8" step="0.125" .value=${releaseMultiplier}/>
    </label>
  `;
};

const vibratoAmountInput = (vibratoAmount: number) => {
  return html`
    <label>
      <span>Vibrato amount: ${vibratoAmount}</span>
      <input name="vibratoAmount" type="range" min="0.0" max="1" step="0.1" .value=${vibratoAmount}/>
    </label>
  `;
};

const vibratoFrequencyInput = (vibratoFrequency: number) => {
  return html`
    <label>
      <span>Vibrato frequency: ${vibratoFrequency} hz</span>
      <input name="vibratoFrequency" type="range" min="0.0" max="10" step="0.5" .value=${vibratoFrequency}/>
    </label>
  `;
};

const keyboardOffsetInput = (keyboardOffset: number) => {
  return html`
    <label>
      <span>Keyboard offset: ${keyboardOffset}</span>
      <input name="keyboardOffset" type="range" min="28" max="102" step="1" .value=${keyboardOffset}/>
    </label>
  `;
};

const blackKeysInput = (blackKeysSet: Set<string>) => {
  const checkboxes = [];

  for (let index = 0; index < 12; index++) {
    checkboxes.push(html`
      <label>
        <span>${keyLabels[index]}</span>
        <input
          aria-label="Key ${index} of octave"
          type="checkbox"
          name="blackKeys"
          value=${index}
          ?checked=${blackKeysSet.has(`${index}`)}
        />
      </label>
    `);
  }

  return html`
    <div>
      <label for="blackKeys">Black keys</label>
      <div class="black-key-checkboxes">${checkboxes}</div>
    <div>
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
    <label>
      ${label && html`<span>${label}</span>`}
      <select name=${name}>${options}</select>
    </label>
  `;
};

const keys = (blackKeysSet: Set<string>, fromNote = 0, toNote = 120) => {
  const keys = [];

  for (let note = fromNote; note < toNote; note++) {
    const isBlack = blackKeysSet.has(`${note % 12}`);
    keys.push(key(note, isBlack));
  }

  const pointerdown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target || target === event.currentTarget) return;

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
    event.preventDefault();
  };

  const pointerout = (event: PointerEvent) => {
    releaseWithController(event.pointerId);

    event.stopPropagation();
  };

  const contextmenu = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const pointerover = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (!target || target === event.currentTarget) return;

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
      @contextmenu=${contextmenu}
    >
      ${keys}
    </div>
  `;
};

const pointersDown = new Set();
const keyLabels = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const key = (midiNumber: number, isBlack = false) => {
  const note = midiNumber % 12;
  const octave = Math.floor(midiNumber / 12);

  return html`
    <div class="key ${isBlack ? "black" : "white"} key-${note}">
      <button
        type="button"
        data-midi-number="${midiNumber}"
      >
        <span>
          ${keyLabels[note]}${note === 0 ? html`<sup>${octave - 1}</sup>` : nothing}
        </span>
      </button>
    </div>
  `;
};

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const { code, repeat, metaKey, ctrlKey } = event;
  if (repeat || metaKey || ctrlKey) return;

  const { keyboardOffset } = Keyboard.get();

  const lowOctave = keyboardOffset - 1 * 12;
  const midOctave = keyboardOffset + 0 * 12;
  const highOctave = keyboardOffset + 1 * 12;
  const higherOctave = keyboardOffset + 2 * 12;

  const notes = {
    Digit1: 0 + lowOctave,
    Digit2: 1 + lowOctave,
    Digit3: 2 + lowOctave,
    Digit4: 3 + lowOctave,
    Digit5: 4 + lowOctave,
    Digit6: 5 + lowOctave,
    Digit7: 6 + lowOctave,
    Digit8: 7 + lowOctave,
    Digit9: 8 + lowOctave,
    Digit0: 9 + lowOctave,
    Minus: 10 + lowOctave,
    Equal: 11 + lowOctave,

    KeyQ: 0 + midOctave,
    KeyW: 1 + midOctave,
    KeyE: 2 + midOctave,
    KeyR: 3 + midOctave,
    KeyT: 4 + midOctave,
    KeyY: 5 + midOctave,
    KeyU: 6 + midOctave,
    KeyI: 7 + midOctave,
    KeyO: 8 + midOctave,
    KeyP: 9 + midOctave,
    BracketLeft: 10 + midOctave,
    BracketRight: 11 + midOctave,

    KeyA: 0 + highOctave,
    KeyS: 1 + highOctave,
    KeyD: 2 + highOctave,
    KeyF: 3 + highOctave,
    KeyG: 4 + highOctave,
    KeyH: 5 + highOctave,
    KeyJ: 6 + highOctave,
    KeyK: 7 + highOctave,
    KeyL: 8 + highOctave,
    Semicolon: 9 + highOctave,
    Quote: 10 + highOctave,
    Backslash: 11 + highOctave,

    Backquote: 0 + higherOctave,
    KeyZ: 1 + higherOctave,
    KeyX: 2 + higherOctave,
    KeyC: 3 + higherOctave,
    KeyV: 4 + higherOctave,
    KeyB: 5 + higherOctave,
    KeyN: 6 + higherOctave,
    KeyM: 7 + higherOctave,
    Comma: 8 + higherOctave,
    Period: 9 + higherOctave,
    Slash: 10 + higherOctave,
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
  const { instrumentName, velocity, attackMultiplier, vibratoAmount, vibratoFrequency } =
    Keyboard.get();
  const { audioContext, connectInstrument } = AudioSystem.get();

  if (audioContext.state !== "running") audioContext.resume();

  const isAlreadyPlaying = playingControllers.has(controllerId);
  if (isAlreadyPlaying) releaseWithController(controllerId);

  const preset = allInstrumentPresets[instrumentName];

  let instrument: Instrument | null = null;

  for (const freeInstrument of freeInstruments) {
    if (
      !instrument &&
      freeInstrument.preset === preset &&
      freeInstrument.previousEndAt < audioContext.currentTime
    ) {
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
    audioContext.currentTime,
    shiftKey && !altKey ? 1.0 : altKey && !shiftKey ? 0.0 : velocity,
    attackMultiplier,
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

  const { releaseMultiplier } = Keyboard.get();
  releaseInstrument(instrument, audioContext.currentTime, releaseMultiplier, false);

  playingControllers.delete(controllerId);
  freeInstruments.add(instrument);

  const key = document.querySelector(`[data-controller="${controllerId}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.remove("active");
    key.dataset.controller = "free";
  }
};
