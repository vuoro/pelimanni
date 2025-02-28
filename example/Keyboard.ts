import { html, nothing, render } from "lit-html";
import * as allInstrumentPresets from "../instrument-presets.js";
import { attackInstrument, createInstrument, destroyInstrument, releaseInstrument } from "../instruments";
import { frequencyToMidi, midiToFrequency } from "../notes";
import { AudioSystem } from "./AudioSystem";
import { Magic, MagicState } from "./magic";

const KeyboardState = new MagicState({
  instrumentName: (localStorage.getItem("instrumentName") ?? "cello") as keyof typeof allInstrumentPresets,
  velocity: JSON.parse(localStorage.getItem("velocity") ?? "0.5") as number,
  attackMultiplier: JSON.parse(localStorage.getItem("attackMultiplier") ?? "1.0") as number,
  releaseMultiplier: JSON.parse(localStorage.getItem("releaseMultiplier") ?? "1.0") as number,
  duration: JSON.parse(localStorage.getItem("duration") ?? "0.5") as number,
  vibratoAmount: JSON.parse(localStorage.getItem("vibratoAmount") ?? "0.0") as number,
  vibratoFrequency: JSON.parse(localStorage.getItem("vibratoFrequency") ?? "5.0") as number,
  pitchBend: JSON.parse(localStorage.getItem("pitchBend") ?? "0") as number,
  pitchBendDelay: JSON.parse(localStorage.getItem("pitchBendDelay") ?? "1.0") as number,
  sustain: JSON.parse(localStorage.getItem("sustain") ?? "0.0") as number,
  keyboardOffset: JSON.parse(localStorage.getItem("keyboardOffset") ?? "48") as number,
  blackKeys: JSON.parse(localStorage.getItem("blackKeys") ?? '["1", "3", "6", "8", "10"]') as string[],
  coloriseIntervals: JSON.parse(localStorage.getItem("coloriseIntervals") ?? "false") as boolean,
  octaveStartsFrom: JSON.parse(localStorage.getItem("octaveStartsFrom") ?? "0") as number,
});

export const KeyboardSettings = new Magic(() => {
  const onInput = (event: Event) => {
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const instrumentName = data.get("instrumentName") as keyof typeof allInstrumentPresets;
    const velocity = data.get("velocity") as string;
    const attackMultiplier = data.get("attackMultiplier") as string;
    const releaseMultiplier = data.get("releaseMultiplier") as string;
    const vibratoAmount = data.get("vibratoAmount") as string;
    const vibratoFrequency = data.get("vibratoFrequency") as string;
    const pitchBend = data.get("pitchBend") as string;
    const pitchBendDelay = data.get("pitchBendDelay") as string;
    const sustain = data.get("sustain") as string;
    const keyboardOffset = data.get("keyboardOffset") as string;
    const blackKeys = data.getAll("blackKeys") as string[];
    const coloriseIntervals = data.get("coloriseIntervals") as string;
    const octaveStartsFrom = data.get("octaveStartsFrom") as string;

    localStorage.setItem("instrumentName", instrumentName);
    localStorage.setItem("velocity", velocity);
    localStorage.setItem("attackMultiplier", attackMultiplier);
    localStorage.setItem("releaseMultiplier", releaseMultiplier);
    localStorage.setItem("vibratoAmount", vibratoAmount);
    localStorage.setItem("vibratoFrequency", vibratoFrequency);
    localStorage.setItem("pitchBend", pitchBend);
    localStorage.setItem("pitchBendDelay", pitchBendDelay);
    localStorage.setItem("sustain", sustain);
    localStorage.setItem("keyboardOffset", keyboardOffset);
    localStorage.setItem("blackKeys", JSON.stringify(blackKeys));
    localStorage.setItem("coloriseIntervals", JSON.stringify(coloriseIntervals === "on"));
    localStorage.setItem("octaveStartsFrom", octaveStartsFrom);

    KeyboardState.update({
      ...KeyboardState.get(),
      instrumentName,
      velocity: +velocity,
      attackMultiplier: +attackMultiplier,
      releaseMultiplier: +releaseMultiplier,
      vibratoAmount: +vibratoAmount,
      vibratoFrequency: +vibratoFrequency,
      pitchBend: +pitchBend,
      pitchBendDelay: +pitchBendDelay,
      sustain: +sustain,
      keyboardOffset: +keyboardOffset,
      blackKeys,
      coloriseIntervals: coloriseIntervals === "on",
      octaveStartsFrom: +octaveStartsFrom,
    });
  };

  const state = KeyboardState.get();
  const {
    velocity,
    sustain,
    attackMultiplier,
    releaseMultiplier,
    vibratoAmount,
    vibratoFrequency,
    pitchBend,
    pitchBendDelay,
    keyboardOffset,
    coloriseIntervals,
    octaveStartsFrom,
  } = state;

  const blackKeysSet = new Set(state.blackKeys.map((v) => +v));

  render(
    html`
      <form @input=${onInput}>
        <fieldset>
          <legend>Instrument</legend>
          ${instrumentSelect(state.instrumentName, "instrumentName", "Preset")}
          <label>
            <span>Velocity: ${velocity * 100}%</span>
            <input name="velocity" type="range" min="0" max="1" step="0.1" .value=${velocity}/>
          </label>
          <label>
            <span>Sustain after release: ${sustain * 100}%</span>
            <input name="sustain" type="range" min="0.0" max="1.0" step="0.05" .value=${sustain}/>
          </label>
        </fieldset>
        <fieldset>
          <legend>Playstyle</legend>
          <label>
            <span>Attack time &times; ${attackMultiplier}</span>
            <input name="attackMultiplier" type="range" min="0.25" max="8" step="0.25" .value=${attackMultiplier}/>
          </label>
          <label>
            <span>Release time &times; ${releaseMultiplier}</span>
            <input name="releaseMultiplier" type="range" min="0.25" max="8" step="0.25" .value=${releaseMultiplier}/>
          </label>
          <label>
            <span>Vibrato amount: ${vibratoAmount * 100}%</span>
            <input name="vibratoAmount" type="range" min="0.0" max="1" step="0.1" .value=${vibratoAmount}/>
          </label>
          <label>
            <span>Vibrato frequency: ${vibratoFrequency} hz</span>
            <input name="vibratoFrequency" type="range" min="0.0" max="10" step="0.5" .value=${vibratoFrequency}/>
          </label>
          <label>
            <span>Pitch bend: ${pitchBend} ${pitchBend === 1.0 ? "semitone" : "semitones"}</span>
            <input name="pitchBend" type="range" min="-24" max="24" step="1" .value=${pitchBend}/>
          </label>
          <label>
            <span>Pitch bend delay: ${pitchBendDelay * 100}%</span>
            <input name="pitchBendDelay" type="range" min="0.0" max="2.0" step="0.1" .value=${pitchBendDelay}/>
          </label>
        </fieldset>
        <fieldset>
          <legend>Keyboard</legend>
          <label>
            <span>Octave starts from: ${keyLabels[octaveStartsFrom]}</span>
            <input name="octaveStartsFrom" type="range" min="0" max="11" step="1" .value=${octaveStartsFrom}/>
          </label>
          <label>
            <span>WASD offset: ${keyboardOffset}</span>
            <input name="keyboardOffset" type="range" min="12" max="102" step="1" .value=${keyboardOffset}/>
          </label>
          <label>
            <span>Color intervals while playing</span>
            <span><input name="coloriseIntervals" type="checkbox" ?checked=${coloriseIntervals}/> ${coloriseIntervals ? "Enabled" : "Disabled"}</span>
          </label>
          ${blackKeysInput(blackKeysSet)}
        </fieldset>
      </form>

      <p>You can play with mouse, touch, or keyboard. MIDI support coming whenever I manage to buy a device to test it with.</p>
      <p>When playing with a keyboard, use 12345/QWERTY/ASDFG/ZXCVB rows (other keyboard layouts should also work… mostly). You can adjust their notes with the "WASD offset" slider above. Hold shift for full sustain and/or alt for full vibrato.</p>
    `,
    document.getElementById("keyboard-settings") as HTMLElement,
  );
});

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
      <div class="key-checkboxes">${checkboxes}</div>
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

  for (const [group, groupArray] of [...groupArrays.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    options.push(html`<optgroup label=${group}>${groupArray}</optgroup>`);
  }

  return html`
    <label>
      ${label && html`<span>${label}</span>`}
      <select name=${name}>${options}</select>
    </label>
  `;
};

export const Keyboard = new Magic(() => {
  const { blackKeys, instrumentName, octaveStartsFrom } = KeyboardState.get();

  const blackKeysSet = new Set(blackKeys.map((v) => +v));
  const instrumentPreset = allInstrumentPresets[instrumentName as keyof typeof allInstrumentPresets];

  const keys = [];
  const fromNote = frequencyToMidi(instrumentPreset?.highPassFrequency ?? 27.5);
  const toNote = frequencyToMidi(instrumentPreset?.lowPassFrequency ?? 4186.009);
  const fromOctave = Math.floor((fromNote - octaveStartsFrom) / 12);
  const toOctave = Math.ceil((toNote - octaveStartsFrom) / 12);

  let octaveGridTrack = "";
  let isFirstOctave = true;

  for (let octave = fromOctave; octave < toOctave; octave++) {
    for (let note = octave * 12 + octaveStartsFrom; note < (octave + 1) * 12 + octaveStartsFrom; note++) {
      const isBlack = blackKeysSet.has(note % 12);
      const nextIsBlack = blackKeysSet.has((note + 1) % 12);
      keys.push(key(note, isBlack));

      if (isFirstOctave) octaveGridTrack += nextIsBlack === isBlack ? "var(--slot) var(--slot) " : "var(--slot) ";
    }

    isFirstOctave = false;
  }

  render(
    html`
      <h2>Playable demo</h2>
      <div
        class="keys"
        style="--octave-grid-track: ${octaveGridTrack}"
        @pointerdown=${pointerdown}
        @pointerup=${pointerup}
        @pointerout=${pointerout}
        @pointerover=${pointerover}
        @contextmenu=${contextmenu}
      >
        ${keys}
      </div>
    `,
    document.getElementById("keyboard") as HTMLElement,
  );
});

const key = (midiNumber: number, isBlack = false) => {
  const note = midiNumber % 12;
  const octave = Math.floor(midiNumber / 12);

  return html`
    <div
      class="key ${isBlack ? "black" : "white"}"
    >
      <button
        tabindex="-1"
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

const pointerdown = (event: PointerEvent) => {
  const target = event.target as HTMLElement;
  event.stopPropagation();
  if (!target || target === event.currentTarget) return;

  target.releasePointerCapture(event.pointerId);
  pointersDown.add(event.pointerId);

  if (!target.dataset.midiNumber) return;
  attackWithController(event.pointerId, +(target.dataset.midiNumber ?? 0), event.shiftKey, event.altKey);
};

const pointerup = (event: PointerEvent) => {
  pointersDown.delete(event.pointerId);
  releaseWithController(event.pointerId, true, event.shiftKey, event.altKey);

  event.stopPropagation();
  event.preventDefault();
};

const pointerout = (event: PointerEvent) => {
  releaseWithController(event.pointerId, false, event.shiftKey, event.altKey);

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
    attackWithController(event.pointerId, +(target.dataset.midiNumber ?? 0), event.shiftKey, event.altKey);
};

const pointersDown = new Set();
const keyLabels = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

document.addEventListener("keydown", (event: KeyboardEvent) => {
  const { code, repeat, metaKey, ctrlKey } = event;
  if (repeat || metaKey || ctrlKey) return;

  const { keyboardOffset } = KeyboardState.get();

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
  releaseWithController(code, true, event.shiftKey, event.altKey);
});

document.addEventListener("visibilitychange", () => {
  pointersDown.clear();

  for (const [controllerId] of playingControllers) {
    releaseWithController(controllerId);
  }
});

document.body.addEventListener("pointerup", (event: PointerEvent) => {
  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId)) releaseWithController(event.pointerId, event.shiftKey, event.altKey);
});

document.body.addEventListener("pointerout", (event: PointerEvent) => {
  if (event.target !== event.currentTarget) return;

  pointersDown.delete(event.pointerId);
  if (playingControllers.has(event.pointerId)) releaseWithController(event.pointerId, event.shiftKey, event.altKey);
});

type Instrument = ReturnType<typeof createInstrument>;
type ControllerId = PointerEvent["pointerId"] | KeyboardEvent["code"];
const freeInstruments = new Set<Instrument>();
const playingControllers = new Map<ControllerId, Instrument>();

const attackWithController = (controllerId: ControllerId, midiNumber = 0, shiftKey = false, altKey = false) => {
  const {
    instrumentName,
    velocity,
    attackMultiplier,
    vibratoAmount,
    vibratoFrequency,
    pitchBend,
    pitchBendDelay,
    coloriseIntervals,
  } = KeyboardState.get();
  const { audioContext, connectInstrument } = AudioSystem.get();

  if (audioContext.state !== "running") audioContext.resume();

  const isAlreadyPlaying = playingControllers.has(controllerId);
  let instrument = isAlreadyPlaying ? releaseWithController(controllerId, false, shiftKey, altKey) : null;

  const preset = allInstrumentPresets[instrumentName];

  for (const freeInstrument of freeInstruments) {
    if (!instrument && freeInstrument.preset === preset && freeInstrument.previousEndAt <= audioContext.currentTime) {
      // Use instrument
      console.log("adopting", controllerId);
      instrument = freeInstrument;
      freeInstruments.delete(freeInstrument);
    } else if (freeInstrument.previousEndAt + 1 < audioContext.currentTime) {
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

  // TODO: add Pointer Event `pressure` support: <0.5 pulls towards 0.0 and >0.5 pulls towards 1.0.
  // NOTE: Can't use `pressure` for velocity for now, since iPhone always sets it to 0.0 instead of 0.5. -_-
  const velocityTarget =
    velocity + 0.056 * (Math.sin(audioContext.currentTime * 0.382) * 0.5 + 0.5) + 0.056 * Math.random();

  attackInstrument(
    instrument,
    midiToFrequency(midiNumber),
    audioContext.currentTime,
    velocityTarget,
    attackMultiplier,
    0.7,
    altKey ? 1.0 : vibratoAmount,
    vibratoFrequency,
    pitchBend ? midiToFrequency(midiNumber + pitchBend) : undefined,
    pitchBendDelay,
  );

  const key = document.querySelector(`[data-midi-number="${midiNumber}"]`) as HTMLButtonElement;

  if (key) {
    key.classList.add("active");
    controllerKeys.set(controllerId, key);
  }

  if (coloriseIntervals) {
    for (const element of document.querySelectorAll(".fading")) {
      element.classList.remove("fading");
    }

    updateConsonances(midiNumber, 1.0);
  }
};

const updateConsonances = (midiNumber = 0, sign = 1.0) => {
  // const frequency = midiToFrequency(midiNumber);

  for (let index = 0; index < consonances.length; index++) {
    for (const offset of consonances[index]) {
      const key = document.querySelector(`[data-midi-number="${midiNumber + offset}"]`) as HTMLButtonElement;

      if (key) {
        const consonance = ((index / (consonances.length - 1)) * 2.0 - 1.0) * sign;
        // const consonance =
        //   (1 - getRoughness(frequency, midiToFrequency(midiNumber + offset)) / 0.091) * sign;

        ongoingConsonances.set(key, Math.round(((ongoingConsonances.get(key) || 0) + consonance) * 1000) * 0.001);
        updatedConsonanceKeys.add(key);
      }
    }
  }

  for (const key of updatedConsonanceKeys) {
    const relativeConsonance = ongoingConsonances.get(key) ?? 0.0;
    const absoluteConsonance = Math.abs(relativeConsonance);

    const r = mix(1, 0, (relativeConsonance * 0.5 + 0.5) ** Math.SQRT1_2);
    const g = mix(0.09, 0.618, (relativeConsonance * 0.5 + 0.5) ** Math.SQRT1_2);
    const b = mix(0, 1, (relativeConsonance * 0.5 + 0.5) ** 2);
    const alpha = absoluteConsonance ** 0.013;

    const color = `color(display-p3 ${r} ${g} ${b} / ${alpha})`;
    key.style.setProperty("box-shadow", `inset 0 0 2rlh ${color}, 0 0 0.25rlh ${color}`);

    if (sign === -1.0) key.classList.add("fading");
  }

  updatedConsonanceKeys.clear();
};

const mix = (a = 0, b = 1, amount = 0) => a * (1.0 - amount) + b * amount;

const ongoingConsonances = new WeakMap();
const updatedConsonanceKeys = new Set<HTMLElement>();

// // https://www.acousticslab.org/learnmoresra/moremodel.html
// const getRoughness = (frequencyA = 440.0, frequencyB = 440.0, amplitudeA = 1, amplitudeB = 1) => {
//   const minFrequency = Math.min(frequencyA, frequencyB);
//   const maxFrequency = Math.max(frequencyA, frequencyB);
//   const minAmplitude = Math.min(amplitudeA, amplitudeB);
//   const maxAmplitude = Math.max(amplitudeA, amplitudeB);

//   const x = minAmplitude * maxAmplitude;
//   const y = (2 * minAmplitude) / (minAmplitude + maxAmplitude);

//   const b1 = 3.5;
//   const b2 = 5.75;
//   const s1 = 0.0207;
//   const s2 = 18.96;
//   const s = 0.24 / (s1 * minFrequency + s2);
//   const z =
//     Math.E ** (-b1 * s * (maxFrequency - minFrequency)) -
//     Math.E ** (-b2 * s * (maxFrequency - minFrequency));

//   return x ** 0.1 * (0.5 * y ** 3.11) * z;
// };

// When rounded to closest just tones
// https://www.flickr.com/photos/omegatron/7524758406/in/album-72157629941546057
// 1 ~ 16/15 = very high
// 2 ~ 9/8 = over 4
// 6 ~ 45/32 or 64/56 = around 3.5–4.0
// 3 ~ 6/5 = 3.8
// 4 ~ 5/4 = 3.6
// 8 ~ 8/5 = around 3.1
// 11 ~ 15/8 = 3
// 5 ~ 4/3 = 2.9
// 10 ~ 16/9 = around 2.6
// 9 ~ 5/3 = 2.5
// 7 ~ 3/2 = 2.1

// Using the above ranking + some manual adjustments based on how far notes are from their closest just tones
const consonances = [
  [1, -1],
  [2, -2],
  [6, -6],
  [3, -3],
  [4, -4],
  [8, -8],
  [11, -11],
  [10, -10],
  [9, -9],
  [5, -5],
  [7, -7],
  [12, -12],
];

// When based on this
// https://music.stackexchange.com/questions/89641/just-intonation-equal-temperament-consonance-and-dissonance
// Minor Second = 293
// Major Seventh = 148
// Major Second = 147
// Tritone = 101
// Minor Sixth = 101
// Minor Third = 93
// Major Third = 82
// Minor Seventh = 73
// Major Sixth = 54
// Perfect Fourth = 50
// Perfect Fifth = 29

// const consonances = [
//   [1, -1],
//   [11, -11, 2, -2],
//   [6, -6, 8, -8],
//   [3, -3, 4, -4],
//   [10, -10],
//   [9, -9],
//   [5, -5],
//   [7, -7],
// ];

const controllerKeys = new Map();

const releaseWithController = (controllerId: ControllerId, finishAttack = true, shiftKey = false, _altKey = false) => {
  const { audioContext } = AudioSystem.get();
  const instrument = playingControllers.get(controllerId);
  if (!instrument) return;

  const { releaseMultiplier, sustain, coloriseIntervals } = KeyboardState.get();
  const { previousStartAt, previousAttack, previousDecay, previousPitch } = instrument;

  const remainingAttack = finishAttack
    ? Math.max(0.0, previousAttack * 5.0 - (audioContext.currentTime - previousStartAt))
    : 0.0;
  const decayedDuration = Math.max(0.0, audioContext.currentTime - previousStartAt - previousAttack * 5.0);
  const remainingDecay = Math.max(0.0, previousDecay * 5.0 - decayedDuration);

  const releaseAt = audioContext.currentTime + Math.max(remainingAttack, remainingDecay * (shiftKey ? 1.0 : sustain));
  releaseInstrument(instrument, releaseAt, releaseMultiplier, false);

  playingControllers.delete(controllerId);
  freeInstruments.add(instrument);

  const key = controllerKeys.get(controllerId);

  if (key) {
    key.classList.remove("active");
    controllerKeys.delete(controllerId);
  }

  if (coloriseIntervals) updateConsonances(frequencyToMidi(previousPitch), -1.0);

  return instrument;
};
