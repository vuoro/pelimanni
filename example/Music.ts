import { html, render, type TemplateResult } from "lit-html";
import { live } from "lit-html/directives/live.js";
import * as allInstruments from "../instrumentPresets.js";
import type { InstrumentPreset, Playable } from "../schedule.js";
import { heavensTower } from "./heavens-tower.js";
import { Magic } from "./magic.js";

export const Music = new Magic(
  (
    previousMusic?: {
      cycle: number;
      instruments: Map<number, InstrumentPreset>;
      tracks: [InstrumentPreset, Playable][];
    },
    message?: { type: string; slot: number; name: string },
  ) => {
    // const song = import.meta.env.DEV ? party1() : heavensTower();
    const song = heavensTower();

    const instrumentsByName = new Map(Object.entries(allInstruments));

    let instruments = previousMusic?.instruments;

    if (!instruments) {
      instruments = new Map();

      let slot = 0;
      for (const [instrument] of song.tracks) {
        instruments.set(slot, instrument as InstrumentPreset);

        slot++;
      }
    }

    if (message) {
      switch (message.type) {
        case "slots": {
          const { slot, name } = message;
          instruments.set(slot, instrumentsByName.get(name) as InstrumentPreset);
          break;
        }
        default: {
          console.warn("Unrecognized message", message);
        }
      }
    }

    const handleChange = (event: Event) => {
      const { name: slot, value: name } = event.target as HTMLSelectElement;
      Music.update({ type: "slots", slot: +slot, name });
    };

    const trackOptions: TemplateResult[] = [];

    for (let slot = 0; slot < song.tracks.length; slot++) {
      const instrumentOptions: TemplateResult[] = [];

      for (const name in allInstruments) {
        const instrument = allInstruments[name as keyof typeof allInstruments];
        instrumentOptions.push(html`
          <option value=${name} ?selected=${live(instruments.get(slot) === instrument)}>${name}</option>
        `);
      }

      trackOptions.push(html`
        <label>
          Track #${slot}
          <select name=${slot}>
            <option ?selected=${live(instruments.get(slot) === null)}>-- no instrument --</option>
            ${instrumentOptions}
          </select>
        </label>
      `);
    }

    render(
      html`<form @change=${handleChange}>${trackOptions}</form>`,
      document.getElementById("instruments") as HTMLElement,
    );

    const { cycle } = song;
    const tracks = [];
    let slot = 0;

    for (const [, playable] of song.tracks) {
      const instrument = instruments.get(slot);
      slot++;
      if (!instrument) continue;

      tracks.push([instrument, playable] as [InstrumentPreset, Playable]);
    }

    return { cycle, tracks, instruments };
  },
);
