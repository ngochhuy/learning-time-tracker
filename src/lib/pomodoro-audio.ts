export type PomodoroSound = "off" | "rain" | "tea" | "ocean" | "bowl";
export type PomodoroChime = "ceramic" | "tibetan" | "rain" | "silent";

/** Small synthesized soundscapes: no remote media, autoplay, or microphone access. */
export class PomodoroAudio {
  private context: AudioContext | null = null;
  private ambient: AudioNode[] = [];

  private getContext() {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
    return this.context;
  }

  stop() {
    for (const node of this.ambient) {
      if ("stop" in node) {
        try { (node as AudioBufferSourceNode | OscillatorNode).stop(); } catch { /* Already stopped. */ }
      }
      node.disconnect();
    }
    this.ambient = [];
  }

  start(sound: PomodoroSound, volume: number) {
    this.stop();
    if (sound === "off" || volume <= 0) return;
    const context = this.getContext();
    const master = context.createGain();
    master.gain.value = Math.min(1, Math.max(0, volume / 100)) * 0.15;
    master.connect(context.destination);
    this.ambient.push(master);

    if (sound === "tea" || sound === "bowl") {
      const oscillator = context.createOscillator();
      oscillator.type = sound === "bowl" ? "sine" : "triangle";
      oscillator.frequency.value = sound === "bowl" ? 432 : 220;
      oscillator.connect(master);
      oscillator.start();
      this.ambient.push(oscillator);
      return;
    }

    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = sound === "ocean" ? "lowpass" : "highpass";
    filter.frequency.value = sound === "ocean" ? 380 : 1_200;
    noise.connect(filter);
    filter.connect(master);
    noise.start();
    this.ambient.push(noise, filter);
    if (sound === "ocean") {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = 0.12;
      depth.gain.value = master.gain.value * 0.45;
      lfo.connect(depth);
      depth.connect(master.gain);
      lfo.start();
      this.ambient.push(lfo, depth);
    }
  }

  chime(kind: PomodoroChime, volume: number) {
    if (kind === "silent" || volume <= 0) return;
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = kind === "tibetan" ? 432 : kind === "rain" ? 900 : 660;
    oscillator.type = kind === "rain" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, context.currentTime + 1);
    gain.gain.setValueAtTime(Math.max(0.001, volume / 600), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  close() {
    this.stop();
    if (this.context) void this.context.close();
    this.context = null;
  }
}
