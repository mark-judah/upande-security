import { AudioModule, createAudioPlayer, type AudioPlayer } from 'expo-audio';

let scanPlayer: AudioPlayer | null = null;
let submitPlayer: AudioPlayer | null = null;
let errorPlayer: AudioPlayer | null = null;
let configured = false;

async function ensureConfigured() {
  if (configured) return;
  configured = true;
  try {
    await AudioModule.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  } catch {
    // older runtime — silent mode may already be the default
  }
}

function ensurePlayers() {
  if (!scanPlayer) {
    scanPlayer = createAudioPlayer(require('../../assets/sounds/beep.mp3'));
  }
  if (!submitPlayer) {
    submitPlayer = createAudioPlayer(require('../../assets/sounds/submit.mp3'));
  }
  if (!errorPlayer) {
    errorPlayer = createAudioPlayer(require('../../assets/sounds/error.mp3'));
  }
}

function fireAndForget(p: AudioPlayer | null) {
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // best-effort
  }
}

export async function playBeep() {
  await ensureConfigured();
  ensurePlayers();
  fireAndForget(scanPlayer);
}

export async function playSubmit() {
  await ensureConfigured();
  ensurePlayers();
  fireAndForget(submitPlayer);
}

export async function playError() {
  await ensureConfigured();
  ensurePlayers();
  fireAndForget(errorPlayer);
}
