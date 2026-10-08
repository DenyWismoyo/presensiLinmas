/**
 * Feedback Utility: Audio Chimes & Haptic Vibration untuk Lapangan
 * Menggunakan Web Audio API murni (tanpa file mp3 eksternal) dan Navigator Vibrate.
 */

// Memainkan nada lonceng sukses (ting-tong)
export function playSuccessChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Nada 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nada 2: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (e) {
    // Graceful fallback
    console.debug('Web Audio not supported:', e);
  }
}

// Memainkan nada peringatan darurat SOS (sirine cepat)
export function playEmergencyAlarm() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const startTime = now + i * 0.25;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, startTime);
      osc.frequency.exponentialRampToValueAtTime(1400, startTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.24);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.24);
    }
  } catch (e) {
    console.debug('Web Audio alarm error:', e);
  }
}

// Haptic feedback getaran ponsel
export function triggerHaptic(pattern: number[] = [80, 40, 80]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored
    }
  }
}

// Text-to-Speech Ramah Anggota Linmas
export function speakNotification(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignored
  }
}
