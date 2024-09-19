export function midiToFrequency(midiNumber = 0, tuning = 440.0, _root = 0) {
  return (tuning / 32) * 2 ** ((midiNumber - 9 + 60) / 12);
}

export function midiToJustFrequency(midiNumber = 0, tuning = 440.0, root = 0) {
  const octave = Math.floor((midiNumber - 9 - root) / 12);
  const noteAboveRoot = (midiNumber - 9 - root + 240) % 12;
  return (tuning / 32) * 2 ** ((octave * 12 + root + 60) / 12) * justToneRatios[noteAboveRoot];
}

// https://johncarlosbaez.wordpress.com/2023/11/15/just-intonation-part-4/
const justToneRatios = [1.0, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8, 2.0];
