import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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

type MapPoint = { lat: number; lng: number; g: string; pt: string; at: string };

function toMapData(points: PatrolPoint[]): MapPoint[] {
  return points
    .filter((p) => p.lat && p.lng && !Number.isNaN(Number(p.lat)) && !Number.isNaN(Number(p.lng)))
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      g: p.guard || '—',
      pt: p.patrol || '—',
      at: p.at || '',
    }));
}

// Static shell — built ONCE, never regenerated when new points come in. New
// data is pushed into the already-running Leaflet instance via
// injectJavaScript (window.updateMapData) instead of reloading the WebView.
//
// Reloading the WebView (the old approach: rebuild the whole HTML string,
// with all point data embedded in it, on every points change, and hand it
// to <WebView source={{html}}>) recreates the Leaflet map from scratch on
// every single data refresh — a genuine page reload, not a data update —
// which wipes whatever zoom/pan the user had set and re-fits the map to
// the full bounds every time. That's the reported bug: "every time new
// points come in it reloads the page and zooms out." Bounds are now only
// auto-fit the first time real data arrives; a later injectMapData call
// (a background refresh bringing in new points) redraws the tracks/markers
// in place and leaves the user's current view alone.
const MAP_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}</style>
</head><body><div id="map"></div><script>
var map=null,layerGroup=null,hasFitOnce=false;
var colors={},palette=['#EF4444','#3B82F6','#22C55E','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16'],ci=0;
function color(g){if(!(g in colors)){colors[g]=palette[ci%palette.length];ci++;}return colors[g];}

function initMap(){
  map=L.map('map',{preferCanvas:true,zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  layerGroup=L.layerGroup().addTo(map);
  map.setView([0.07,35.75],13);
}

var lastPts=[];

function renderPoints(pts){
  layerGroup.clearLayers();
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
      L.polyline(latlngs,{color:c,weight:3,opacity:0.85,lineJoin:'round'}).addTo(layerGroup).bindPopup('Guard: '+arr[0].g+'<br>'+k+'<br>'+arr.length+' points');
    }
    var st=arr[0],en=arr[arr.length-1];
    L.circleMarker([st.lat,st.lng],{radius:5,color:'#fff',weight:2,fillColor:'#22C55E',fillOpacity:1}).addTo(layerGroup).bindPopup('Start · '+st.g+'<br>'+st.at);
    if(latlngs.length>1){
      L.circleMarker([en.lat,en.lng],{radius:5,color:'#fff',weight:2,fillColor:'#EF4444',fillOpacity:1}).addTo(layerGroup).bindPopup('End · '+en.g+'<br>'+en.at);
    }
  });
  if(bounds.length&&!hasFitOnce){
    map.fitBounds(bounds,{padding:[24,24]});
    hasFitOnce=true;
  }
}

window.updateMapData=function(pts){
  lastPts=pts;
  try{ renderPoints(pts); }catch(e){}
};

// Zoom the map to just one guard's points — tapping a "By Guard" table row
// calls this via injectJavaScript. Single point: center + close zoom.
// Multiple: fit to that guard's own bounds, same padding as the initial
// fit. Filters from the last data the map already has, not a fresh fetch.
window.zoomToGuard=function(guardName){
  try{
    var pts=lastPts.filter(function(p){return p.g===guardName;});
    if(!pts.length){return;}
    var bounds=pts.map(function(p){return [p.lat,p.lng];});
    if(bounds.length===1){
      map.setView(bounds[0],17);
    }else{
      map.fitBounds(bounds,{padding:[40,40]});
    }
  }catch(e){}
};

try{ initMap(); }catch(e){document.body.innerHTML='<div style="padding:16px;font-family:sans-serif;color:#666">Map failed to load.</div>';}
</script></body></html>`;

export type PatrolMapHandle = { zoomToGuard: (guard: string) => void };

const MapInner = forwardRef<PatrolMapHandle, { points: PatrolPoint[] }>(function MapInner(
  { points },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const data = useMemo(() => toMapData(points), [points]);

  useImperativeHandle(ref, () => ({
    zoomToGuard: (guard: string) => {
      webRef.current?.injectJavaScript(`window.zoomToGuard(${JSON.stringify(guard)}); true;`);
    },
  }));

  // Push new/changed data into the already-loaded page — never touches
  // `source`, so the WebView itself never reloads.
  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.updateMapData(${JSON.stringify(data)}); true;`);
  }, [data, ready]);

  if (!data.length) return <Fallback msg="No GPS points in range" />;

  return (
    <WebView
      ref={webRef}
      source={{ html: MAP_HTML }}
      style={s.web}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      androidLayerType="hardware"
      renderError={() => <Fallback msg="Map failed to load" />}
      onError={() => {}}
      onRenderProcessGone={() => {}}
      onLoadEnd={() => {
        setReady(true);
        webRef.current?.injectJavaScript(`window.updateMapData(${JSON.stringify(data)}); true;`);
      }}
    />
  );
});

export const PatrolMap = forwardRef<PatrolMapHandle, { points: PatrolPoint[] }>(
  function PatrolMap({ points }, ref) {
    return (
      <View style={s.wrap}>
        <MapBoundary>
          <MapInner points={points} ref={ref} />
        </MapBoundary>
      </View>
    );
  },
);

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
