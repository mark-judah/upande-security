import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { PatrolPoint } from '@/lib/services/api';
import { COLORS, borderRadius, fontFamily, fontSize, spacing } from '@/src/core/theme';

function Fallback({ msg }: { msg: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{msg}</Text>
    </View>
  );
}

/** Catches WebView/native-module failures so the whole Reports screen never crashes. */
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
      return <Fallback msg="Map unavailable on this build. Rebuild the app to enable it." />;
    }
    return this.props.children;
  }
}

function MapInner({ points }: { points: PatrolPoint[] }) {
  const valid = points.filter(
    (p) => p.lat && p.lng && !Number.isNaN(Number(p.lat)) && !Number.isNaN(Number(p.lng)),
  );
  if (!valid.length) return <Fallback msg="No GPS points in range" />;

  const data = valid.map((p) => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
    g: p.guard || '—',
    pt: p.patrol || '—',
    at: p.at || '',
  }));

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}</style>
</head><body><div id="map"></div><script>
try{
var pts=${JSON.stringify(data)};
var map=L.map('map',{preferCanvas:true,zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var colors={},palette=['#EF4444','#3B82F6','#22C55E','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16'],ci=0;
function color(g){if(!(g in colors)){colors[g]=palette[ci%palette.length];ci++;}return colors[g];}

// Group points into tracks per patrol, ordered chronologically, and draw a path.
var groups={};
pts.forEach(function(p){(groups[p.pt]=groups[p.pt]||[]).push(p);});
var bounds=[];
Object.keys(groups).forEach(function(k){
  var arr=groups[k];
  arr.sort(function(a,b){return a.at<b.at?-1:(a.at>b.at?1:0);});
  var latlngs=[];
  arr.forEach(function(p){latlngs.push([p.lat,p.lng]);bounds.push([p.lat,p.lng]);});
  var c=color(arr[0].g);
  if(latlngs.length>1){
    L.polyline(latlngs,{color:c,weight:3,opacity:0.85,lineJoin:'round'}).addTo(map).bindPopup('Guard: '+arr[0].g+'<br>'+k+'<br>'+arr.length+' points');
  }
  var st=arr[0],en=arr[arr.length-1];
  L.circleMarker([st.lat,st.lng],{radius:5,color:'#fff',weight:2,fillColor:'#22C55E',fillOpacity:1}).addTo(map).bindPopup('Start · '+st.g+'<br>'+st.at);
  if(latlngs.length>1){
    L.circleMarker([en.lat,en.lng],{radius:5,color:'#fff',weight:2,fillColor:'#EF4444',fillOpacity:1}).addTo(map).bindPopup('End · '+en.g+'<br>'+en.at);
  }
});
if(bounds.length){map.fitBounds(bounds,{padding:[24,24]});}else{map.setView([0.07,35.75],13);}
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

export function PatrolMap({ points }: { points: PatrolPoint[] }) {
  return (
    <View style={s.wrap}>
      <MapBoundary>
        <MapInner points={points} />
      </MapBoundary>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 320,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: spacing.lg,
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
