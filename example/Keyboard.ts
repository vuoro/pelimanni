import { html, render } from "lit-html";
import * as allInstrumentPresets from "../instrumentPresets.js";
import { createInstrument, destroyInstrument, playInstrument } from "../instruments";
import { midiToJustFrequency } from "../notes";
import { AudioSystem } from "./AudioSystem";
import { Magic } from "./magic";

export const Keyboard = new Magic(
  (
    state: {
      instrument: null | ReturnType<typeof createInstrument>;
      instrumentName: keyof typeof allInstrumentPresets;
      velocity: number;
      duration: number;
    } = {
      instrument: null,
      instrumentName: ((localStorage.getItem("instrumentName") ?? "none") in allInstrumentPresets
        ? localStorage.getItem("instrumentName")
        : "piano") as keyof typeof allInstrumentPresets,
      velocity: +(localStorage.getItem("velocity") ?? 0.5),
      duration: +(localStorage.getItem("duration") ?? 0.2),
    },
    message?: {
      instrumentName?: keyof typeof allInstrumentPresets;
      velocity?: number;
      duration?: number;
    },
  ) => {
    const { audioContext, connectInstrument } = AudioSystem.get();

    if (!state.instrument) {
      state.instrument =
        state.instrument ||
        createInstrument(allInstrumentPresets[state.instrumentName], audioContext);
      connectInstrument(state.instrument);
    }

    if (message) {
      if (message.instrumentName) {
        if (state.instrument) destroyInstrument(state.instrument);

        state.instrumentName = message.instrumentName;
        state.instrument = createInstrument(
          allInstrumentPresets[state.instrumentName],
          audioContext,
        );
        connectInstrument(state.instrument);
      }

      if (message.velocity !== undefined) state.velocity = message.velocity;
      if (message.duration !== undefined) state.duration = message.duration;
    }

    const keys = Keys.get();

    const change = (event: Event) => {
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const instrumentName = data.get("instrumentName") as keyof typeof allInstrumentPresets;
      const velocity = data.get("velocity") as string;
      const duration = data.get("duration") as string;

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
    };

    render(
      html`
        <form @change=${change}>
          ${instrumentSelect(state.instrumentName)}
          ${velocityInput(state.velocity)}
          ${durationInput(state.duration)}
        </form>
        ${keys}
      `,
      keyboardElement,
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
        <input name="duration" type="number" min="0.001" max="30" step="0.1" .value=${duration}/>
      </label>
    </div>
  `;
};

const instrumentSelect = (selected: string) => {
  const options = [];

  for (const name in allInstrumentPresets) {
    options.push(html`<option value="${name}" ?selected=${selected === name}>${name}</option>`);
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

  for (let octave = 10; octave > 0; octave--) {
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
    playNote(+(target.dataset.midiNumber ?? 0));
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
    playNote(+(target.dataset.midiNumber ?? 0));
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
    ${labels[note]}<sup>${octave - 1}</sup>
  </button>`;
};

const keyboardElement = document.getElementById("keyboard") as HTMLElement;

const pointersDown = new Set();

const playNote = (midiNumber = 0) => {
  const { instrument, velocity, duration } = Keyboard.get();
  const { audioContext } = AudioSystem.get();
  if (audioContext.state !== "running") audioContext.resume();

  console.log(midiToJustFrequency(midiNumber));

  playInstrument(
    instrument,
    midiToJustFrequency(midiNumber),
    audioContext.currentTime + 0.04,
    duration,
    velocity,
    0.5,
  );
};
