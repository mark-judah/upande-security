import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { ENGINE_HTML } from '@/lib/mrz/engineHtml';
import { parseMrz } from '@/lib/utils/mrz';

// One object for the component's lifetime, so re-renders never reload the page.
const ENGINE_SOURCE = { html: ENGINE_HTML };

type Result ={ type: 'result'; id: number; lines: string[] | null; reason: string; ms: number };
type EngineMsg = { type: 'ready' } | Result | { type: 'error'; id: number; message: string };

const REASONS: Record<string, string> = {
  'no MRZ found': 'Could not find the 3 MRZ lines - move closer to the back of the card',
  'did not check out': 'The MRZ did not read clearly - hold steady, avoid glare',
};

/**
 * Beta: our own MRZ reader (mrz-scanner, trained on Kenyan ID layouts)
 * instead of ML Kit. The guard points at the back of the card and taps SCAN;
 * the photo goes to a hidden WebView that finds the three MRZ lines, reads
 * them and returns them only if every check digit passes. The result is
 * validated again here with the same parseMrz the ML Kit path uses.
 */
export function MrzPhotoScanner({
  onCard,
  onUseMlKit,
  onManual,
}: {
  onCard: (name: string | undefined, idNumber: string | undefined) => void;
  onUseMlKit: () => void;
  onManual: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const web = useRef<WebView>(null);
  const pending = useRef(new Map<number, (m: EngineMsg) => void>());
  const nextId = useRef(1);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: EngineMsg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      setReady(true);
      return;
    }
    const done = pending.current.get(msg.id);
    pending.current.delete(msg.id);
    done?.(msg);
  }, []);

  // A photo around 1280-1600 px across is plenty for the MRZ and quick to
  // move and decode; full-resolution camera photos are 10x the data.
  const onCameraReady = useCallback(async () => {
    try {
      const sizes = (await camera.current?.getAvailablePictureSizesAsync()) ?? [];
      const parsed = sizes
        .map((s) => ({ s, w: Math.max(...s.split('x').map(Number)) }))
        .filter((p) => p.w >= 1200)
        .sort((a, b) => a.w - b.w);
      if (parsed.length) setPictureSize(parsed[0].s);
    } catch {
      // keep the camera's default size
    }
  }, []);

  const scan = useCallback(async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.85 });
      if (!photo?.base64) throw new Error('No photo');
      const id = nextId.current++;
      const reply = await new Promise<EngineMsg>((resolve) => {
        pending.current.set(id, resolve);
        web.current?.postMessage(JSON.stringify({ type: 'read', id, jpeg: photo.base64 }));
      });
      if (reply.type === 'error') {
        setMessage('Scanner error: ' + reply.message);
        return;
      }
      if (reply.type !== 'result') return;
      const card = reply.lines ? parseMrz(reply.lines.join('\n')) : null;
      if (card) {
        onCard(card.name, card.idNumber);
        return;
      }
      setMessage(`${REASONS[reply.reason] ?? 'No read'} (${(reply.ms / 1000).toFixed(1)} s)`);
    } catch (e) {
      setMessage('Could not take the photo - try again');
      if (__DEV__) console.warn('[MrzPhotoScanner]', e);
    } finally {
      setBusy(false);
    }
  }, [ready, busy, onCard]);

  useEffect(() => () => pending.current.clear(), []);

  return (
    <View style={s.root}>
      <CameraView ref={camera} style={s.camera} facing="back" pictureSize={pictureSize} onCameraReady={onCameraReady} />
      <View pointerEvents="none" style={s.overlay}>
        <Text style={s.badge}>NEW SCANNER (BETA)</Text>
        {/* No frame: the engine finds the MRZ anywhere in the photo. */}
        <Text style={s.hint}>Point at the back of the ID -{'\n'}the 3 lines of letters and {'<<<'} must be in view</Text>
      </View>
      <View style={s.controls}>
        {message ? <Text style={s.message}>{message}</Text> : null}
        <TouchableOpacity
          onPress={scan}
          disabled={!ready || busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          style={[s.scanBtn, (!ready || busy) && { opacity: 0.6 }]}
        >
          {busy || !ready ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <MaterialIcons name="document-scanner" size={22} color="#000000" />
          )}
          <Text style={s.scanText}>{!ready ? 'Loading scanner…' : busy ? 'Reading…' : 'SCAN'}</Text>
        </TouchableOpacity>
        <View style={s.links}>
          <TouchableOpacity onPress={onUseMlKit} style={s.link}>
            <Text style={s.linkText}>Use the old scanner</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onManual} style={s.link}>
            <Text style={s.linkText}>Enter details manually</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* WebView's own container defaults to flex: 1 - left unboxed it takes
          half the screen, invisibly, on top of the buttons. */}
      <View pointerEvents="none" style={s.engine}>
        <WebView
          ref={web}
          source={ENGINE_SOURCE}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={onMessage}
          containerStyle={s.engineFill}
          style={s.engineFill}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 48, left: 0, right: 0, alignItems: 'center' },
  badge: {
    color: '#000000',
    backgroundColor: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 12,
  },
  hint: { color: '#FFFFFF', fontSize: 13, textAlign: 'center', marginTop: 14, textShadowColor: '#000000', textShadowRadius: 4 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 32, alignItems: 'center' },
  message: { color: '#FBBF24', fontSize: 13, textAlign: 'center', marginBottom: 12, textShadowColor: '#000000', textShadowRadius: 4 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minHeight: 52,
    paddingHorizontal: 28,
    gap: 8,
  },
  scanText: { color: '#000000', fontWeight: '700', fontSize: 16 },
  links: { flexDirection: 'row', marginTop: 10 },
  link: { padding: 10 },
  linkText: { color: '#FFFFFF', textDecorationLine: 'underline' },
  engine: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0 },
  engineFill: { flex: 1 },
});
