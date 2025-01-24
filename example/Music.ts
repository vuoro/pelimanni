import { html, render, type TemplateResult } from "lit-html";
import * as allInstruments from "../instrumentPresets.js";
import type { InstrumentPreset, Playable } from "../schedule.js";
import { AudioSystem } from "./AudioSystem.js";
import { heavensTower } from "./heavens-tower.js";
import { instrumentSelect } from "./Keyboard.js";
import { Magic } from "./magic.js";

export const Music = new Magic(
  (
    previousMusic?: {
      cycle: number;
      instruments: Map<number, string>;
      tracks: [InstrumentPreset, Playable][];
      shouldPlay: boolean;
    },
    message?: { type: string; key: number; value: string | boolean | number },
  ) => {
    // const song = import.meta.env.DEV ? party1() : heavensTower();
    const song = heavensTower();

    let instruments = previousMusic?.instruments;
    let shouldPlay = previousMusic?.shouldPlay || false;

    if (!instruments) {
      instruments = new Map();

      let slot = 0;
      for (const [instrument] of song.tracks) {
        let name = "unknown";

        for (const key in allInstruments) {
          if (instrument === allInstruments[key]) {
            name = key;
            break;
          }
        }

        instruments.set(slot, name);
        slot++;
      }
    }

    if (message) {
      switch (message.type) {
        case "slots": {
          const { key: slot, value: name } = message;
          instruments.set(slot, name);
          break;
        }
        case "shouldPlay": {
          const { value: should } = message;
          shouldPlay = !!should;
          break;
        }
        default: {
          console.warn("Unrecognized message", message);
        }
      }
    }

    const handleChange = (event: Event) => {
      const { name: slot, value: name } = event.target as HTMLSelectElement;
      Music.update({ type: "slots", key: +slot, value: name });
    };

    const trackOptions: TemplateResult[] = [];

    for (let slot = 0; slot < song.tracks.length; slot++) {
      trackOptions.push(html`
        ${instrumentSelect(instruments.get(slot), slot)}
      `);
    }

    const { cycle } = song;
    const tracks = [];
    const trackControls = [];
    let slot = 0;

    for (const [, playable] of song.tracks) {
      const instrumentName = instruments.get(slot);
      const instrument = allInstruments[instrumentName];

      trackControls.push(html`
        <fieldset>
          <legend>Track ${slot}</legend>
          ${trackOptions[slot]}
          <code>
            ${JSON.stringify(
              playable,
              (key, value) => (value === null ? "PAUSE" : value === undefined ? "EXTENDER" : value),
              2,
            )
              .replace(/"PAUSE"/g, "x")
              .replace(/"EXTENDER"/g, "e")}
          </code>
        </fieldset>
      `);

      slot++;
      if (!instrument) continue;

      tracks.push([instrument, playable] as [InstrumentPreset, Playable]);
    }

    render(
      html`
        <form @change=${handleChange}>
          <h2>Sequencing demo</h2>
          <p>
            Plays an adaptation of a part from <cite>Heaven's Tower</cite> by Naoshi Mizuta, from
            <cite>Final Fantasy XI Original Soundtrack</cite>
          </p>
          ${playButton(shouldPlay)}
          ${trackControls}
        </form>
        `,
      document.getElementById("instruments") as HTMLElement,
    );

    return { cycle, tracks, instruments, shouldPlay };
  },
);

const playButton = (shouldPlay: boolean) => {
  const title = shouldPlay ? "Stop demo song" : "Play demo song";
  const onClick = () => {
    const { audioContext } = AudioSystem.get();
    if (audioContext.state !== "running") audioContext.resume();

    Music.update({ type: "shouldPlay", value: !shouldPlay });
  };

  return html`
    <button type="button" @click=${onClick}>${title}</button>
  `;
};
