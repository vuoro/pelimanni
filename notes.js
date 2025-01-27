export function midiToFrequency(midiNumber = 0, tuning = 440.0) {
  return tuning * 2 ** ((midiNumber - 69) / 12);
}

export function frequencyToMidi(frequency = 440.0, tuning = 440.0) {
  return 69 + Math.round((12 * Math.log(frequency / tuning)) / Math.LN2);
}
