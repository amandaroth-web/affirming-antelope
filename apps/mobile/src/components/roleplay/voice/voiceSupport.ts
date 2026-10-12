import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

/** The server takes at most 60 seconds (docs/voice.md). We stop just short of it. */
export const MAX_RECORDING_MS = 59_000;
/** From here the timer turns warm and says how long is left. */
export const SOFT_CAP_MS = 50_000;
/** Shorter than this is a tap, not a turn. */
export const MIN_RECORDING_MS = 450;

/**
 * The container to record in (MediaRecorder), both on the transcribe contract:
 * WebKit (Safari, and every iOS browser) records mp4/AAC. Newer Safari also claims webm,
 * but its webm takes came out empty in testing, so WebKit always asks for mp4 first.
 * Chrome and Firefox record webm/opus.
 */
export function webMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const webkit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
  const order = webkit ? ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return order.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Speech, mono, small: a minute is about half a megabyte (the limit is 5 MB). */
export const RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: Platform.OS === 'web' ? webMimeType() : undefined, bitsPerSecond: 64000 },
};

/** Can this device record at all? Native always can; a browser needs getUserMedia + MediaRecorder. */
export function canRecordHere(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

/** The server said voice is off (503 `voice_unavailable`): Type for the rest of this app session. */
let resting = false;
export function markVoiceResting() {
  resting = true;
}

/** Talk is offered (and the default) when this device can record and the server hasn't turned voice off. */
export function voiceAvailable(): boolean {
  return canRecordHere() && !resting;
}

/** File name + type for the upload: what the recorder actually produced. */
export function audioPart(mime: string | undefined): { name: string; type: string } {
  if (Platform.OS !== 'web') return { name: 'turn.m4a', type: 'audio/m4a' };
  const type = mime || 'audio/webm';
  return { name: type.includes('mp4') ? 'turn.mp4' : type.includes('ogg') ? 'turn.ogg' : 'turn.webm', type };
}
