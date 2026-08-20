const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/leaflet-CIGW-MKW.css","assets/leaflet-src-0a4CUFvo.js","assets/react-vendor-yKKif88o.js"])))=>i.map(i=>d[i]);
import{_ as g}from"./index-DSFlTHll.js";import{j as n}from"./radix-ui-DtfuuZGa.js";import{a as l}from"./react-vendor-yKKif88o.js";import{b as _}from"./dates-noBz1YBf.js";import{M as L}from"./map-pin-CmDAgqEk.js";let u=null;async function N(){return u||(await g(()=>Promise.resolve({}),__vite__mapDeps([0])),u=await g(()=>import("./leaflet-src-0a4CUFvo.js").then(c=>c.l),__vite__mapDeps([1,2])),u)}function A({trucks:c,height:f="h-80",className:x,emptyState:b,onTruckClick:p}){const d=l.useRef(null),r=l.useRef(null),h=l.useRef([]),t=l.useMemo(()=>c.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)),[c]);return l.useEffect(()=>{if(!d.current||t.length===0)return;let s=!1;return(async()=>{const o=await N();if(s||!d.current)return;r.current&&(r.current.remove(),r.current=null);const i=o.map(d.current,{zoomControl:!0,attributionControl:!0,scrollWheelZoom:!0});o.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',maxZoom:18}).addTo(i);const v=o.latLngBounds([]);for(const e of t){const a=Date.now()-e.at<900*1e3,y=a?o.divIcon({className:"",html:`<div style="width:28px;height:28px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>
              </div>`,iconSize:[28,28],iconAnchor:[14,14]}):o.divIcon({className:"",html:`<div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>`,iconSize:[28,28],iconAnchor:[14,14]}),m=o.marker([e.lat,e.lon],{icon:y}).addTo(i),w=e.availability??"Unknown",$=e.location??`${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`,k=a?"Live":`Last known — ${_(e.at)}`,j=e.source?` · ${e.source.replace("_"," ")}`:"";m.bindPopup(`
          <div style="min-width:200px;font-family:system-ui,sans-serif">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <strong style="font-size:14px">${e.unitNumber}${e.type?` (${e.type})`:""}</strong>
              <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${a?"#dcfce7":"#fef3c7"};color:${a?"#166534":"#92400e"}">${w}</span>
            </div>
            ${e.driverName?`<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${e.driverName}</div>`:""}
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
              <span style="color:#6b7280">📍</span> ${$}
            </div>
            <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
              <span>${a?"🟢":"🟡"}</span> ${k}${j}
              ${e.accuracy?` · ±${Math.round(e.accuracy)}m`:""}
            </div>
            <div style="margin-top:8px">
              <a href="/trucks/${e.truckId}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details →</a>
            </div>
          </div>
        `),p&&m.on("click",()=>p(e)),v.extend([e.lat,e.lon]),h.current.push(m)}t.length===1?i.setView([t[0].lat,t[0].lon],12):t.length>1&&i.fitBounds(v.pad(.15)),r.current=i,setTimeout(()=>i.invalidateSize(),100)})(),()=>{s=!0,h.current=[],r.current&&(r.current.remove(),r.current=null)}},[t,p]),t.length===0?n.jsx("div",{className:`relative rounded-lg border bg-muted/30 overflow-hidden ${f} ${x??""}`,children:b??n.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-center p-4",children:[n.jsx(L,{className:"size-6 text-muted-foreground"}),n.jsx("p",{className:"mt-2 text-sm text-muted-foreground",children:"No truck locations available"}),n.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:"Truck positions appear when drivers share GPS data"})]})}):n.jsx("div",{ref:d,className:`relative rounded-lg border overflow-hidden ${f} ${x??""}`})}export{A as T};
