import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

function Fallback({ msg }: { msg: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{msg}</Text>
    </View>
  );
}

/**
 * Catches WebView/native-module failures so a build without the WebView
 * native module doesn't crash the SOS Alert screen. Mirrors MapBoundary in
 * components/reports/PatrolMap.tsx.
 */
class MapBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — fallback UI is shown */
  }
  render() {
    if (this.state.failed) {
      return <Fallback msg="Map unavailable on this build." />;
    }
    return this.props.children;
  }
}

function MapInner({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}
.pulse{width:20px;height:20px;border-radius:10px;background:#EF4444;border:3px solid #fff;box-shadow:0 0 0 rgba(239,68,68,0.6);animation:pulse 1.5s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)}70%{box-shadow:0 0 0 20px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
</style>
</head><body><div id="map"></div><script>
try{
var lat=${lat}, lng=${lng};
var map=L.map('map',{zoomControl:true}).setView([lat,lng],17);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var icon=L.divIcon({className:'',html:'<div class="pulse"></div>',iconSize:[20,20]});
L.marker([lat,lng],{icon:icon}).addTo(map).bindPopup(${JSON.stringify(label)}).openPopup();
}catch(e){document.body.innerHTML='<div style="padding:16px;font-family:sans-serif;color:#666">Map failed to load.</div>';}
</script></body></html>`;

  return (
    <WebView
      source={{ html }}
      style={s.web}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      androidLayerType="hardware"
      renderError={() => <Fallback msg="Map failed to load" />}
      onError={() => {}}
      onRenderProcessGone={() => {}}
    />
  );
}

type Props = { lat: number | null; lng: number | null; label: string };

export function SosLocationMap({ lat, lng, label }: Props) {
  return (
    <View style={s.wrap}>
      <MapBoundary>
        {lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) ? (
          <MapInner lat={lat} lng={lng} label={label} />
        ) : (
          <Fallback msg="No location received with this alert" />
        )}
      </MapBoundary>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 260,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMuted,
  },
  web: { flex: 1, backgroundColor: COLORS.bgMuted },
  empty: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
