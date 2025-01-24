export function midiToFrequency(midiNumber = 0, tuning = 440.0, _root = 0) {
  return (tuning / 32) * 2 ** ((midiNumber - 9) / 12);
}
