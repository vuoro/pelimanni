import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { AudioSystem, defaultReverbParameters } from "./AudioSystem.js";
import { Magic } from "./magic.js";

export const AudioControls = new Magic(() => {
  const { audioContext, mainGain } = AudioSystem.get();

  const isRunning = audioContext.state === "running";
  const action = () => (isRunning ? audioContext.suspend() : audioContext.resume());
  const actionTitle = isRunning ? "Suspend audio" : "Enable audio";

  const onStateChange = () => {
    AudioControls.update({ type: "refresh" });
  };

  audioContext.addEventListener("statechange", onStateChange, { once: true });

  const reverbSliders = [];

  for (const key in defaultReverbParameters) {
    reverbSliders.push(reverbSlider(key as keyof typeof defaultReverbParameters));
  }

  return render(
    html`
      <form>
        <h2>Audio settings</h2>
        <button type="button" @click=${action}>${actionTitle}</button>

        <fieldset>
          <legend>Volume</legend>
          ${volumeSlider("Main", mainGain, 1.0)}
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
    gainNode.gain.setTargetAtTime(Number.parseFloat(target.value) * maxGain, gainNode.context.currentTime, 0.001);
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

const reverbSlider = (title: keyof typeof defaultReverbParameters) => {
  const handleInput = async ({ target }: Event) => {
    if (!(target instanceof HTMLInputElement)) return;
    const { audioContext, reverb } = AudioSystem.get();
    const reverbNode = await reverb;

    const value = Number.parseFloat(target.value) * (title === "preDelay" ? audioContext.sampleRate : 1);

    reverbNode.parameters.get(title)?.setTargetAtTime(value, audioContext.currentTime, 0.013);
  };

  const max = title.startsWith("excursion") ? 2 : 1;

  return html`
    <label>
      <span>${title}</span>
      <input type="range" @input=${handleInput} min="0" max="${max}" step="0.001" value="${defaultReverbParameters[title]}" />
    </label>
  `;
};
