import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import type { FarmBoundaryShape, PlaybackGuard } from '@/lib/services/api';
import { borderRadius, COLORS, fontFamily, fontSize, spacing } from '@/src/core/theme';

// Patrol playback: each guard's route redrawn as time moves, a dot where
// they are, the trail broken where they left the farm (as the web Patrol
// Playback does). The clock runs inside the map page; the controls below
// send it play / pause / speed / seek, and it reports the time back.

const SPEEDS = [
  { value: 60, label: '1 min/s' },
  { value: 300, label: '5 min/s' },
  { value: 900, label: '15 min/s' },
];

const HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eee}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
map.setView([0.07,35.75],13);
var bLayer=L.layerGroup().addTo(map), tLayer=L.layerGroup().addTo(map);
var palette=['#EF4444','#3B82F6','#22C55E','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16'];
var G=[], t0=0, t1=0, now=0, playing=false, speed=300, timer=null, lastPost=0;
function post(){var n=Date.now();if(n-lastPost<250&&playing)return;lastPost=n;
  try{window.ReactNativeWebView.postMessage(JSON.stringify({t:now,t0:t0,t1:t1,playing:playing}));}catch(e){}}
window.pbBoundaries=function(shapes){bLayer.clearLayers();(shapes||[]).forEach(function(s){
  var l=L.geoJSON(s.geometry,{style:{color:'#1f1f1c',weight:2,opacity:0.8,fillColor:'#1f1f1c',fillOpacity:0.04,dashArray:'6 4'}});
  l.bindTooltip(s.farm,{sticky:true});l.addTo(bLayer);});};
function draw(){
  G.forEach(function(g){
    var segs=[],cur=[],last=null;
    for(var i=0;i<g.p.length;i++){var p=g.p[i];if(p.t>now)break;
      if(p.brk&&cur.length){segs.push(cur);cur=[];}cur.push([p.lat,p.lng]);last=p;}
    if(cur.length)segs.push(cur);
    g.line.setLatLngs(segs);
    if(last){g.dot.setLatLng([last.lat,last.lng]);if(!tLayer.hasLayer(g.dot))g.dot.addTo(tLayer);}
    else if(tLayer.hasLayer(g.dot)){tLayer.removeLayer(g.dot);}
  });
  post();
}
window.pbLoad=function(data){
  tLayer.clearLayers();G=[];var b=[];t0=Infinity;t1=-Infinity;
  (data.guards||[]).forEach(function(g,i){
    var c=palette[i%palette.length];
    var pts=g.points.map(function(p){var t=Date.parse(p.t.replace(' ','T'));if(t<t0)t0=t;if(t>t1)t1=t;b.push([p.lat,p.lng]);return {t:t,lat:p.lat,lng:p.lng,brk:p.brk};});
    var line=L.polyline([],{color:c,weight:3,opacity:0.85}).addTo(tLayer);
    var dot=L.circleMarker([0,0],{radius:7,color:'#fff',weight:2,fillColor:c,fillOpacity:1});
    dot.bindTooltip(g.name,{permanent:false});
    G.push({p:pts,line:line,dot:dot});
  });
  if(!isFinite(t0)){t0=Date.parse((data.from||'').replace(' ','T'))||0;t1=Date.parse((data.to||'').replace(' ','T'))||0;}
  if(b.length)map.fitBounds(b,{padding:[24,24]});
  now=t0;draw();
};
function tick(){now+=speed*100;if(now>=t1){now=t1;pause();}draw();}
function pause(){playing=false;if(timer){clearInterval(timer);timer=null;}post();}
window.pbPlay=function(){if(now>=t1)now=t0;playing=true;if(!timer)timer=setInterval(tick,100);post();};
window.pbPause=function(){pause();};
window.pbSpeed=function(s){speed=s;};
window.pbSeek=function(f){now=t0+(t1-t0)*Math.max(0,Math.min(1,f));draw();};
window.pbRestart=function(){now=t0;draw();};
</script></body></html>`;

function clock(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlaybackMap({
  guards,
  boundaries,
  from,
  to,
}: {
  guards: PlaybackGuard[];
  boundaries?: FarmBoundaryShape[];
  from: string;
  to: string;
}) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState({ t: 0, t0: 0, t1: 0, playing: false });
  const [speed, setSpeed] = useState(300);
  const [barWidth, setBarWidth] = useState(1);
  const payload = useMemo(() => JSON.stringify({ guards, from, to }), [guards, from, to]);
  const run = (js: string) => web.current?.injectJavaScript(`${js}; true;`);

  useEffect(() => {
    if (!ready) return;
    run(`window.pbBoundaries(${JSON.stringify(boundaries ?? [])})`);
  }, [ready, boundaries]);

  useEffect(() => {
    if (!ready) return;
    run(`window.pbLoad(${payload})`);
    run(`window.pbSpeed(${speed})`);
  }, [ready, payload]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      setState(JSON.parse(e.nativeEvent.data));
    } catch {
      // ignore
    }
  };
  const progress = state.t1 > state.t0 ? (state.t - state.t0) / (state.t1 - state.t0) : 0;

  return (
    <View>
      <View style={s.mapWrap}>
        <WebView
          ref={web}
          source={{ html: HTML }}
          style={{ flex: 1 }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          androidLayerType="hardware"
          onLoadEnd={() => setReady(true)}
          onMessage={onMessage}
        />
      </View>
      <Text style={s.clock}>
        {clock(state.t)} <Text style={s.clockRange}>· {clock(state.t0)} – {clock(state.t1)}</Text>
      </Text>
      <Pressable
        style={s.bar}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width || 1)}
        onPress={(e) => run(`window.pbSeek(${e.nativeEvent.locationX / barWidth})`)}
        accessibilityLabel="Jump to a moment"
      >
        <View style={[s.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </Pressable>
      <View style={s.controls}>
        <Pressable style={s.ctrl} onPress={() => run('window.pbRestart()')} accessibilityLabel="Back to the start">
          <Ionicons name="play-skip-back" size={18} color={COLORS.text} />
        </Pressable>
        <Pressable
          style={[s.ctrl, s.play]}
          onPress={() => run(state.playing ? 'window.pbPause()' : 'window.pbPlay()')}
          accessibilityLabel={state.playing ? 'Pause' : 'Play'}
        >
          <Ionicons name={state.playing ? 'pause' : 'play'} size={22} color="#fff" />
        </Pressable>
        {SPEEDS.map((sp) => (
          <Pressable
            key={sp.value}
            style={[s.speed, speed === sp.value && s.speedOn]}
            onPress={() => {
              setSpeed(sp.value);
              run(`window.pbSpeed(${sp.value})`);
            }}
          >
            <Text style={[s.speedText, speed === sp.value && s.speedTextOn]}>{sp.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  mapWrap: {
    height: 360,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgMuted,
  },
  clock: { fontFamily: fontFamily.semiBold, fontSize: fontSize.md, color: COLORS.text, marginTop: spacing.md },
  clockRange: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: COLORS.textMuted },
  bar: { height: 14, borderRadius: 7, backgroundColor: COLORS.bgMuted, overflow: 'hidden', marginTop: spacing.sm },
  barFill: { height: 14, backgroundColor: '#1E88E5' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  ctrl: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  play: { backgroundColor: '#1E88E5', borderColor: '#1E88E5', width: 48, height: 48, borderRadius: 24 },
  speed: {
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  speedOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  speedText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: COLORS.textSecondary },
  speedTextOn: { color: COLORS.bg },
});
