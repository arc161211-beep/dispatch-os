const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/maplibre-gl-JR8eJ17e.css"])))=>i.map(i=>d[i]);
import{M as H,_ as P}from"./index-Bv2WWN0Q.js";import{j as m}from"./radix-ui-D69oGojO.js";import{a as x}from"./react-vendor-CMbTw_U-.js";import{f as T}from"./dates-DB8aKpsh.js";let h=null;async function A(){return h||(await P(()=>Promise.resolve({}),__vite__mapDeps([0])),h=await P(()=>import("./maplibre-gl-CTo6lObu.js"),[]),h)}const C="https://tiles.openfreemap.org/styles/liberty";function I(i){return'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2.81A2 2 0 0 1 20 8v8a2 2 0 0 1-2 2h-2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>'}function D(i){return`<div style="width:28px;height:28px;border-radius:50%;background:${i};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">${I()}</div>`}function q({trucks:i,height:j="h-80",className:R,emptyState:S,onTruckClick:v}){const y=x.useRef(null),u=x.useRef(null),$=x.useRef([]),n=x.useMemo(()=>i.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)),[i]),w=x.useCallback(()=>{for(const s of $.current)s.remove();$.current=[]},[]);return x.useEffect(()=>{if(!y.current||n.length===0)return;let s=!1;return(async()=>{const a=await A();if(s||!y.current)return;if(u.current){w();const l=u.current,t=new a.LngLatBounds;for(const e of n){const b=Date.now()-e.at,L=b<900*1e3,k=b>=900*1e3&&b<3600*1e3,f=L?"#16a34a":k?"#f59e0b":"#6b7280",c=document.createElement("div");c.innerHTML=D(f),c.style.cursor="pointer";const d=new a.Marker({element:c}).setLngLat([e.lon,e.lat]).addTo(l),r=Date.now()-e.at,p=r<900*1e3,M=r>=900*1e3&&r<3600*1e3,N=!e.trackingActive&&r>=900*1e3,_=p?"Live":M?"Stale":N?"Stopped":e.availability??"Unknown",E=e.location??`${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`,z=p?"Live":`Last known — ${T(e.at)}`,F=e.source?` · ${e.source.replace("_"," ")}`:"";d.setPopup(new a.Popup({offset:16,closeButton:!1}).setHTML(`
              <div style="min-width:200px;font-family:system-ui,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <strong style="font-size:14px">${o(e.unitNumber)}${e.type?` (${o(e.type)})`:""}</strong>
                  <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${p?"#dcfce7":"#fef3c7"};color:${p?"#166534":"#92400e"}">${o(_)}</span>
                </div>
                ${e.driverName?`<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${o(e.driverName)}</div>`:""}
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
                  📍 ${o(E)}
                </div>
                <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
                  <span>${p?"🟢":"🟡"}</span> ${o(z)}${o(F)}
                  ${e.accuracy?` · ±${Math.round(e.accuracy)}m`:""}
                </div>
                <div style="margin-top:8px">
                  <a href="/trucks/${encodeURIComponent(e.truckId)}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details →</a>
                </div>
              </div>
            `)),v&&c.addEventListener("click",()=>v(e)),t.extend([e.lon,e.lat]),$.current.push(d)}n.length===1?(l.setCenter([n[0].lon,n[0].lat]),l.setZoom(12)):n.length>1&&l.fitBounds(t,{padding:60});return}const B=n.length===1?[n[0].lon,n[0].lat]:[-98.5,39.8],g=new a.Map({container:y.current,style:C,center:B,zoom:n.length===1?12:4,attributionControl:{compact:!0},scrollZoom:!0});g.addControl(new a.NavigationControl({showCompass:!1}),"top-right"),g.on("load",()=>{if(s)return;const l=new a.LngLatBounds;for(const t of n){const e=Date.now()-t.at,b=e<900*1e3,L=e>=900*1e3&&e<3600*1e3,k=b?"#16a34a":L?"#f59e0b":"#6b7280",f=document.createElement("div");f.innerHTML=D(k),f.style.cursor="pointer";const c=new a.Marker({element:f}).setLngLat([t.lon,t.lat]).addTo(g),d=Date.now()-t.at,r=d<900*1e3,p=d>=900*1e3&&d<3600*1e3,M=!t.trackingActive&&d>=900*1e3,N=r?"Live":p?"Stale":M?"Stopped":t.availability??"Unknown",_=t.location??`${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}`,E=r?"Live":`Last known — ${T(t.at)}`,z=t.source?` · ${t.source.replace("_"," ")}`:"";c.setPopup(new a.Popup({offset:16,closeButton:!1}).setHTML(`
              <div style="min-width:200px;font-family:system-ui,sans-serif">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                  <strong style="font-size:14px">${o(t.unitNumber)}${t.type?` (${o(t.type)})`:""}</strong>
                  <span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:${r?"#dcfce7":"#fef3c7"};color:${r?"#166534":"#92400e"}">${o(N)}</span>
                </div>
                ${t.driverName?`<div style="font-size:12px;color:#6b7280;margin-bottom:4px">Driver: ${o(t.driverName)}</div>`:""}
                <div style="font-size:12px;color:#6b7280;margin-bottom:4px">
                  📍 ${o(_)}
                </div>
                <div style="font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px">
                  <span>${r?"🟢":"🟡"}</span> ${o(E)}${o(z)}
                  ${t.accuracy?` · ±${Math.round(t.accuracy)}m`:""}
                </div>
                <div style="margin-top:8px">
                  <a href="/trucks/${encodeURIComponent(t.truckId)}" style="font-size:12px;color:#2563eb;text-decoration:underline">View truck details →</a>
                </div>
              </div>
            `)),v&&f.addEventListener("click",()=>v(t)),l.extend([t.lon,t.lat]),$.current.push(c)}n.length>1&&g.fitBounds(l,{padding:60})}),u.current=g})(),()=>{s=!0,w(),u.current&&(u.current.remove(),u.current=null)}},[n,v,w]),n.length===0?m.jsx("div",{className:`relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden ${j} ${R??""}`,children:S??m.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-center p-4",children:[m.jsx(H,{className:"size-6 text-muted-foreground"}),m.jsx("p",{className:"mt-2 text-sm text-muted-foreground",children:"No truck locations available"}),m.jsx("p",{className:"text-xs text-muted-foreground/70 mt-1",children:"Truck positions appear when drivers share GPS data"})]})}):m.jsx("div",{ref:y,className:`relative rounded-lg border border-border/50 overflow-hidden ${j} ${R??""}`})}function o(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}export{q as T};
