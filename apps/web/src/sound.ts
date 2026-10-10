// Sonido chiptune generado con WebAudio. Apagado por defecto.
let ctx: AudioContext | null = null;
export let soundOn = false;
export const setSound = (on: boolean) => { soundOn = on; };

export const blip = (kind: 'coin' | 'build' | 'error') => {
  if (!soundOn) return;
  ctx ??= new AudioContext();
  const notes = kind === 'coin' ? [988, 1319] : kind === 'build' ? [523, 659, 784] : [220, 165];
  notes.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = 'square';
    o.frequency.value = f;
    const t0 = ctx!.currentTime + i * 0.07;
    g.gain.setValueAtTime(0.06, t0);
    g.gain.setValueAtTime(0, t0 + 0.065);
    o.connect(g).connect(ctx!.destination);
    o.start(t0);
    o.stop(t0 + 0.07);
  });
};
