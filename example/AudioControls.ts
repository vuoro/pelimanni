import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { AudioSystem, configureReverb, defaultReverbOptions } from "./AudioSystem.js";
import { Magic } from "./magic.js";

export const AudioControls = new Magic(() => {
  const { audioContext, mainGain, effectsGain, musicGain } = AudioSystem.get();

  const isRunning = audioContext.state === "running";
  const action = () => (isRunning ? audioContext.suspend() : audioContext.resume());
  const actionTitle = isRunning ? "Suspend audio" : "Enable audio";

  const onStateChange = () => {
    AudioControls.update({ type: "refresh" });
  };

  audioContext.addEventListener("statechange", onStateChange, { once: true });

  const reverbSliders = [];

  for (const key in defaultReverbOptions) {
    reverbSliders.push(reverbSlider(key as keyof typeof defaultReverbOptions));
  }

  return render(
    html`
      <form>
        <h2>Audio settings</h2>
        <button type="button" @click=${action}>${actionTitle}</button>

        <fieldset>
          <legend>Volume</legend>
          ${volumeSlider("Main", mainGain, 1.0)}
          <!-- ${volumeSlider("Effects", effectsGain, 0.5)} -->
          ${volumeSlider("Music", musicGain, 0.5)}
        </fieldset>

        <datalist id="gain-steps">
          <option value="0.5"></option>
        </datalist>

        <fieldset>
          <legend><a href="https://khoin.github.io/DattorroReverbNode/">Dattorro's Reverb</a></legend>
          ${reverbSliders}
        </fieldset>
      </form>
    `,
    document.getElementById("audio-controls") as HTMLElement,
  );
});

const volumeSlider = (title: string, gainNode: GainNode, maxGain: number) => {
  const handleInput = ({ target }: Event) => {
    if (!(target instanceof HTMLInputElement)) return;
    gainNode.gain.setTargetAtTime(
      Number.parseFloat(target.value) * maxGain,
      gainNode.context.currentTime,
      0.001,
    );
  };

  return html`
    <label>
      <span>${title}</span>
      <input
        type="range"
        .value=${live(gainNode.gain.value / maxGain)}
        @input=${handleInput}
        min="0"
        max="1"
        step="0.025"
        list="gain-steps"
      />
    </label>
  `;
};

const reverbSlider = (title: keyof typeof defaultReverbOptions) => {
  const handleInput = async ({ target }: Event) => {
    if (!(target instanceof HTMLInputElement)) return;
    const { audioContext, reverb } = AudioSystem.get();
    configureReverb(audioContext, await reverb, { [title]: Number.parseFloat(target.value) });
  };

  return html`
    <label>
      <span>${title}</span>
      <input type="range" @input=${handleInput} min="0" max="1" step="0.0001" value="${defaultReverbOptions[title]}" />
    </label>
  `;
};
