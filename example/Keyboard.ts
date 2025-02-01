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
      sustain: number;
      keyboardOffset: number;
      blackKeys: string[];
    } = {
      instrumentName: ((localStorage.getItem("instrumentName") ?? "none") in allInstrumentPresets
        ? localStorage.getItem("instrumentName")
        : "piano") as keyof typeof allInstrumentPresets,
      velocity: +(localStorage.getItem("velocity") ?? 0.8),
      attackMultiplier: +(localStorage.getItem("attackMultiplier") ?? 1.0),
      releaseMultiplier: +(localStorage.getItem("releaseMultiplier") ?? 1.0),
      duration: +(localStorage.getItem("duration") ?? 0.5),
      vibratoAmount: +(localStorage.getItem("vibratoAmount") ?? 0.0),
      vibratoFrequency: +(localStorage.getItem("vibratoFrequency") ?? 5.0),
      sustain: +(localStorage.getItem("sustain") ?? 0.0),
      keyboardOffset: +(localStorage.getItem("keyboardOffset") ?? 48),
      blackKeys: JSON.parse(localStorage.getItem("blackKeys") || '["1", "3", "6", "8", "10"]'),
    },
    message?: {
      instrumentName: keyof typeof allInstrumentPresets;
      velocity: number;
      attackMultiplier: number;
      releaseMultiplier: number;
      vibratoAmount: number;
      vibratoFrequency: number;
      sustain: number;
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
      const sustain = data.get("sustain") as string;
      const keyboardOffset = data.get("keyboardOffset") as string;
      const blackKeys = data.getAll("blackKeys") as string[];

      localStorage.setItem("instrumentName", instrumentName);
      localStorage.setItem("velocity", velocity);
      localStorage.setItem("attackMultiplier", attackMultiplier);
      localStorage.setItem("releaseMultiplier", releaseMultiplier);
      localStorage.setItem("vibratoAmount", vibratoAmount);
      localStorage.setItem("vibratoFrequency", vibratoFrequency);
      localStorage.setItem("sustain", sustain);
      localStorage.setItem("keyboardOffset", keyboardOffset);
      localStorage.setItem("blackKeys", JSON.stringify(blackKeys));

      Keyboard.update({
        instrumentName,
        velocity: +velocity,
        attackMultiplier: +attackMultiplier,
        releaseMultiplier: +releaseMultiplier,
        vibratoAmount: +vibratoAmount,
        vibratoFrequency: +vibratoFrequency,
        sustain: +sustain,
        keyboardOffset: +keyboardOffset,
        blackKeys,
      });
    };

    const blackKeysSet = new Set(state.blackKeys.map((v) => +v));
    const instrumentPreset =
      allInstrumentPresets[state.instrumentName as keyof typeof allInstrumentPresets];

    const keyboard = keys(
      blackKeysSet,
      frequencyToMidi(instrumentPreset?.highPassFrequency ?? 27.5),
      frequencyToMidi(instrumentPreset?.lowPassFrequency ?? 4186.009),
    );

    render(
      html`
        <h2>Playable demo</h2>
        ${keyboard}
        <form @input=${onInput}>
          <fieldset>
            <legend>Play settings</legend>
            ${instrumentSelect(state.instrumentName, "instrumentName", "Instrument preset")}
            ${velocityInput(state.velocity)}
            ${sustainInput(state.sustain)}
            ${attackMultiplierInput(state.attackMultiplier)}
            ${releaseMultiplierInput(state.releaseMultiplier)}
            ${vibratoAmountInput(state.vibratoAmount)}
            ${vibratoFrequencyInput(state.vibratoFrequency)}
            ${keyboardOffsetInput(state.keyboardOffset)}
            ${blackKeysInput(blackKeysSet)}
          </fieldset>
        </form>
        <p>You can play with mouse, touch, or keyboard. MIDI support coming whenever I manage to buy a device to test it with.</p>
        <p>When playing with a keyboard, use 12345/QWERTY/ASDFG/ZXCVB rows (other keyboard layouts should also work… mostly). You can adjust their notes with the "Keyboard offset" slider above. Hold shift for full sustain and/or alt for full vibrato.</p>
      `,
      document.getElementById("keyboard") as HTMLElement,
    );

    return state;
  },
);

const velocityInput = (velocity: number) => {
  return html`
    <label>
      <span>Velocity: ${velocity * 100}%</span>
      <input name="velocity" type="range" min="0" max="1" step="0.1" .value=${velocity}/>
    </label>
  `;
};

const attackMultiplierInput = (attackMultiplier: number) => {
  return html`
    <label>
      <span>Attack time &times; ${attackMultiplier}</span>
      <input name="attackMultiplier" type="range" min="0.25" max="8" step="0.25" .value=${attackMultiplier}/>
    </label>
  `;
};

const releaseMultiplierInput = (releaseMultiplier: number) => {
  return html`
    <label>
      <span>Release time &times; ${releaseMultiplier}</span>
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

const sustainInput = (sustain: number) => {
  return html`
    <label>
      <span>Sustain after release: ${sustain * 100}%</span>
      <input name="sustain" type="range" min="0.0" max="1.0" step="0.05" .value=${sustain}/>
    </label>
  `;
};

const keyboardOffsetInput = (keyboardOffset: number) => {
  return html`
    <label>
      <span>Keyboard offset: ${keyboardOffset}</span>
      <input name="keyboardOffset" type="range" min="12" max="102" step="1" .value=${keyboardOffset}/>
    </label>
  `;
};

const blackKeysInput = (blackKeysSet: Set<number>) => {
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
          ?checked=${blackKeysSet.has(index)}
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

const keys = (blackKeysSet: Set<number>, fromNote = 0, toNote = 120) => {
  const keys = [];

  for (let note = fromNote; note < toNote; note++) {
    const isBlack = blackKeysSet.has(note % 12);
    keys.push(key(note, isBlack));
  }

  const pointerdown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    event.stopPropagation();
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
  };

  const pointerup = (event: PointerEvent) => {
    pointersDown.delete(event.pointerId);
    releaseWithController(event.pointerId, event.shiftKey, event.altKey);

    event.stopPropagation();
    event.preventDefault();
  };

  const pointerout = (event: PointerEvent) => {
    releaseWithController(event.pointerId, event.shiftKey, event.altKey);

    event.stopPropagation();
  };

  const contextmenu = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const pointerover = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    event.stopPropagation();
    if (!target || target === event.currentTarget) return;

    if (pointersDown.has(event.pointerId))
      attackWithController(
        event.pointerId,
        +(target.dataset.midiNumber ?? 0),
        event.shiftKey,
        event.altKey,
      );
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

  const keyOffsets = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Digit4: 3,
    Digit5: 4,
    Digit6: 5,
    Digit7: 6,
    Digit8: 7,
    Digit9: 8,
    Digit0: 9,
    Minus: 10,
    Equal: 11,

    KeyQ: 12,
    KeyW: 13,
    KeyE: 14,
    KeyR: 15,
    KeyT: 16,
    KeyY: 17,
    KeyU: 18,
    KeyI: 19,
    KeyO: 20,
    KeyP: 21,
    BracketLeft: 22,
    BracketRight: 23,

    KeyA: 24,
    KeyS: 25,
    KeyD: 26,
    KeyF: 27,
    KeyG: 28,
    KeyH: 29,
    KeyJ: 30,
    KeyK: 31,
    KeyL: 32,
    Semicolon: 33,
    Quote: 34,
    Backslash: 35,

    KeyZ: 36,
    KeyX: 37,
    KeyC: 38,
    KeyV: 39,
    KeyB: 40,
    KeyN: 41,
    KeyM: 42,
    Comma: 43,
    Period: 44,
    Slash: 45,
  };

  const keyOffset = keyOffsets[code as keyof typeof keyOffsets];
  if (keyOffset === undefined) return;

  attackWithController(code, keyOffset + keyboardOffset, event.shiftKey, event.altKey);
});

document.addEventListener("keyup", (event: KeyboardEvent) => {
  const { code, repeat } = event;
  if (repeat) return;
  releaseWithController(code, event.shiftKey, event.altKey);
});

document.addEventListener("visibilitychange", () => {
  pointersDown.clear();

  for (const [controllerId] of playingControllers) {
    releaseWithController(controllerId);
  }
});

document.body.addEventListener("pointerup", (event: PointerEvent) => {
  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId))
    releaseWithController(event.pointerId, event.shiftKey, event.altKey);
});

document.body.addEventListener("pointerout", (event: PointerEvent) => {
  if (event.target !== event.currentTarget) return;

  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId))
    releaseWithController(event.pointerId, event.shiftKey, event.altKey);
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
  if (isAlreadyPlaying) releaseWithController(controllerId, shiftKey, altKey);

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
    velocity * (1.0 + 0.056 * Math.sin(audioContext.currentTime * 0.236) + 0.034 * Math.random()),
    attackMultiplier,
    1.0,
    altKey ? 1.0 : vibratoAmount,
    vibratoFrequency,
  );

  const key = document.querySelector(`[data-midi-number="${midiNumber}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.add("active");
    key.dataset.controller = `${controllerId}`;
  }
};

const releaseWithController = (controllerId: ControllerId, shiftKey = false, altKey = false) => {
  const { audioContext } = AudioSystem.get();
  const instrument = playingControllers.get(controllerId);
  if (!instrument) return;

  const { releaseMultiplier, sustain } = Keyboard.get();

  const sustainedDuration = Math.max(
    0.0,
    audioContext.currentTime - instrument.previousStartAt - instrument.previousAttack * 4.0,
  );
  const remainingDecay = Math.max(0.0, instrument.previousDecay * 5.0 - sustainedDuration);
  const releaseAt = audioContext.currentTime + remainingDecay * (shiftKey ? 1.0 : sustain);
  releaseInstrument(instrument, releaseAt, releaseMultiplier, false);

  playingControllers.delete(controllerId);
  freeInstruments.add(instrument);

  const key = document.querySelector(`[data-controller="${controllerId}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.remove("active");
    key.dataset.controller = "free";
  }
};
