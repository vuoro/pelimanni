# Web Audio API musical instruments & utilities

**Big disclaimer:** I'm an audio newbie! At the time of writing it's been 3 months since I first started even looking into audio, and I've never seriously played an instrument. On top of it all I'm also somewhat hearing-impaired. So please don't expect faithful recreations of timbres or even particularly great results. That said, if you're an audio pro and have suggestions for improvements, please let me know!

Demo: https://music.vuoro.dev/

# Usage

This readme is a combination of tutorial, examples, and documentation. It'd be nicer to keep them separate, but this is all I have time for, sadly. Also, working with audio is rather complex and can even be dangerous (see the warnings about connecting instruments later on), so this kind of format may be the safest option.

## Installation

```bash
npm install @vuoro/pelimanni
```

## Instruments

A set of monophonic pretend classical instruments, made with subtractive synthesis methods.

The following are all the instrument presets currently implemented. You can tweak them or create new ones simply by creating a new object based on one of them: `{...viola: attack: viola * 2.0}`. See `genericInstrument` in `instrumentPresets.js` for all the available options.

```js
  import {
    flute, piccolo, // open-ended woodwinds
    oboe, bassoon, contrabassoon, // double-reed woodwinds
    clarinet, saxophone, // single-reed woodwinds
    trumpet, trombone, bassTrombone, frenchHorn, tuba, // brass
    violin, viola, cello, contrabass, // bowed strings
    pluckedViolin, pluckedViola, pluckedCello, pluckedContrabass, // plucked strings
    hammeredDulcimer // string percussion (missing the hammer blow noise, for now)
  } from "@vuoro/pelimanni/instrumentPresets.js";
```

The presets define the instrument's timbre. They also, at runtime, combine with various simple heuristics to make each instrument play a little differently depending on the surrounding context: the exact note being played, the preceding note and when it was played, velocity, duration etc. This makes them sound more natural.

To play the instruments, you must create an `AudioContext`, resume it, create the instrument, connect it, and call `playInstrument` with it.

```js
  import {createInstrument, playInstrument, destroyInstrument} from "@vuoro/pelimanni/instruments.js";

  // Create an AudioContext and an instrument
  const audioContext = new AudioContext();
  const violaPlucker = createInstrument(pluckedViola, audioContext);

  // Connect them
  // **Warning**: in reality I recommend adding several extra nodes between the instrument(s) and the destination.
  // Otherwise bugs you cause may literally cause **PHYSICAL PAIN** to yourself or your users.
  // Yeah. Working with audio is a bit scary. :|
  // I use the following, but I'm uncertain if they're enough for every possible scenario.
  // 1. A DynamicsCompressor to guard against super high volumes.
  // 2. A set of BiquadFilters to cut off frequencies below (~20 hz) and above (~20k hz) human hearing limits.
  violaPlucker.output.connect(audioContext.destination);

  // Play the instrument
  // Note: in reality you need to first call audioContext.resume() from a user gesture event handler.
  // Before that you will hear no sound.
  const frequency = 440;
  const at = audioContext.currentTime + 0.04;
  const duration = 0.2;
  const velocity = 1.0; // optional
  const volume = 0.5; // optional
  const vibratoAmount = 0.0; // optional

  playInstrument(violaPlucker, frequency, at, duration, velocity, volume, vibratoAmount);
```

When you don't need the instrument anymore you can destroy it, to stop and disconnect its OscillatorNodes. (I'm not sure how necessary this actually is. The Web Audio API is confusing on this front.)

```js
destroyInstrument(violaPlucker);
```

## Note number to frequency conversion

`midiToFrequency` converts numbers to notes using the standard "12 note equal temperament" system: every note is slightly out of tune, but sounds fine.

`midiToJustFrequency` uses a "12 note 5-limit just intonation" system instead. Some note intervals are more in tune, and some are less. Especially helps make bowed strings sound better. It takes an additional `root` parameter, which is a note number used as a basis of the frequency ratios. I think the closer your notes are to the root, the better they will sound. I'm not sure though, because this stuff is a bit out of my league.

In both functions note 0 is C4. I think this deviates from the midi number standard, but it's nicer this way.

```js
import { midiToFrequency } from "@vuoro/pelimanni/notes.js";

const tuning = 440.0; // optional

const frequency = midiToFrequency(0, tuning);
playInstrument(violaPlucker, frequency, at, duration);

const root = 0; // optional
const niceFrequency = midiToFrequency(0, root, tuning);
playInstrument(violaPlucker, niceFrequency, at + 1.0, duration);
```

## Sequencing notes into music

Sequencing is a bit more involved feature. It lets you compose repeating tracks of music with nested arrays of numbers.

First choose a `cycle` duration: this is how long the outermost note or array of notes in your track will be.

```js
const cycle = 0.2; // in seconds
```

Now you can start composing sequences. The main idea is to use arrays to subdivide time. (I first saw this concept in the very cool music live programming framework [Strudel](https://strudel.cc).)

```js
[0];        // will play note 0 for 0.2s, every 0.2s
[0, 1];     // 0 for 0.1s, then 1 for 0.1s, every 0.2s
[0, [1, 2]] // 0 for 0.1s, then 1 for 0.05s, then 2 for 0.05s, every 0.2s
```

You can add pauses by adding `null`s to the arrays.

```js
const x = null;
[0, [x, 2]]; // 0 for 0.1s, then pause for 0.05s, then 2 for 0.05s, every 0.2s
```

Similarly, you can extend notes by adding `undefined`s.

```js
const e = undefined;
[0, [e, 2]]; // 0 for 0.1 + 0.5s, then 2 for 0.05s, every 0.2s
```

You can also add configuration objects to the ends of the arrays, for more control. There can be any number of them, to make spreading arrays easier.

```js
// Adds to or subtracts from the note numbers
[0, 1, 2, { transpose: 5 }]; // becomes [5, 6, 7]

// Picks one note, instead of subdividing time, progresses sequentially
[0, 1, 2, { alternate: true }]; // 0 for 0.2s, then 1 for 0.2s, then 2 for 0.2s

// Plays all notes at once, instead of subdividing time
[0, 5, 7, { chord: true }]; // 0, 5, 7 at the same time for 0.2s

// These are passed through to the playNote function (see below)
// ´velocity` is how strongly the note is played, but does not affect the volume: best stay between 0–1
// `volume` is how loud it should be: don't go above 1.0
// `vibrato` makes most of the note waver: off at 0.0, very aggressive at 1.0
// `root` is used for `midiToJustFrequency` (see earlier above)
[0, { velocity: 1.0, volume: 1.0, vibrato: 1.0, root: 0 }]

// Multiple objects are ok: later ones will be merged over earlier ones.
// Both of these end up the same:
[0, x, { transpose: 1, vibrato: 0.5 }, { transpose: 2 }]
[0, x, { transpose: 2, vibrato: 0.5 }];

// If all these inline objects are getting messy or repetitive, consider defining them beforehand:
const v0 = [0, { vibrato: 0.5 }];
[5, 4, 0, 2, v0, e, e, e];
[2, 4, 5, 2, v0, e, e, e];
```

Now that you've got some sequences, you can pair them up with instruments into tracks.

```js
const alternate = true;

const violaSequence = [[0, 2, 4, 5], [5, 4, 2, 0], { alternate }];
const celloSequence = [0, 2, 4, 5, { alternate, vibrato: 0.5 }];

const tracks = [
  [pluckedViola, violaSequence],
  [pluckedCello, celloSequence],
];
```

And now you can start using `scheduleMusic` to make the tracks play. It will take care of the timekeeping, but you will have to create your own `playNote` function.

`playNote` will receive the instrument preset, note number, and other data required for playing it. Below is a _simple_ implementation of it: it does not support polyphony (playing multiple sounds from the same instrument at once, like chords) or cleaning up unused instruments.

```js
const instruments = new Map();

const playNote = (instrumentPreset, noteNumber, at, duration, velocity, volume, vibrato) => {
  // Get the created instrument, if it exists
  let instrument = instruments.get(instrumentPreset);

  // Create the instrument, if it doesn't exist yet
  if (!instrument) {
    instrument = createInstrument(instrumentPreset, audioContext);
    instruments.set(instrumentPreset, instrument);

    // And connect it
    // **Warning**: in reality I recommend adding several extra nodes between the instrument(s) and the destination.
    // Otherwise bugs you cause may literally cause **PHYSICAL PAIN** to yourself or your users.
    // Yeah. Working with audio is a bit scary. :|
    // I use the following, but I'm uncertain if they're enough for every possible scenario.
    // 1. A DynamicsCompressor to guard against super high volumes.
    // 2. A set of BiquadFilters to cut off frequencies below (~20 hz) and above (~20k hz) human hearing limits.
    instrument.output.connect(audioContext.destination);
  }

  // Play it
  const frequency = midiToFrequency(noteNumber);
  playInstrument(instrument, frequency, at, duration, velocity, vibrato);
}
```

And finally, you just have to call `scheduleMusic` at the appropriate time interval. If the page is visible, it will schedule up to `playAhead` seconds of your tracks. If the page is hidden, it will add 1 second to `playAhead`, since 1s is as often as you can call any loop in an inactive browser tab. If some kind of lagspike still manages to make the scheduler fall behind, it will skip enough notes to get back to schedule.

A larger `playAhead` will make skipped notes and lag-caused audio glitches less likely, but will also delay any live changes you might be making to the tracks. Anything between 0.04–0.5 seconds should be a good choice.

Below I'm calling it on an interval 4 times as fast as the `playAhead`, and also whenever the page's visibility changes. This combination should let music play gaplessly.

The required parameters are:
- your `tracks`: array of `[instrumentPreset, sequence]`
- your `cycle` from earlier above
- your `AudioContext`
- your `playNote` function from above

```js
import { scheduleMusic } from "@vuoro/pelimanni/schedule.js";

const playAhead = 0.1;
const callScheduleMusic = () => scheduleMusic(tracks, cycle, audioContext, playNote, playAhead);

setInterval(callScheduleMusic, playAhead / 4.0 * 1000.0);
document.addEventListener("visibilitychange", tryToScheduleMusic);
```

# Performance

Performance has not been tested properly, but seems tolerable: on a M2 Mac Studio I can play at least 32 instruments concurrently without any glitching. Web Audio API seems to handle all of them on a single CPU core, so that's probably something to adjust expectations around.

Internally each instrument uses the following:

1. 1–3 main `OscillatorNode`s to make the sound.
2. Another `OscillatorNode`: shared for vibrato, LFO effects, and brass-style initial note instability.
3. A `WaveShaperNode` for each pulse oscillator the instrument may have.
4. A low-pass and a high-pass `BiquadfilterNode`.
5. 1–6 peaking `BiquadfilterNode`s for shaping the timbre.
6. 1–4 `GainNode`s.
7. And lots of `setTargetAtTime` to manage the envelopes of each oscillator and filter.

I've tried to avoid object allocation when notes are scheduled or instruments are played, to minimise garbage collection pauses.

# Inspirations and resources that helped me figure all of this out

- https://strudel.cc
- https://www.soundonsound.com/series/synth-secrets-sound-sound
- https://en.xen.wiki
