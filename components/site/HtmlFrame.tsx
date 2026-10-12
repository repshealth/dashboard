'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommentTarget, Device, PinAnchor } from '@/lib/types';

/**
 * Shows a real web page (from the client's GitHub repo) inside a sandboxed frame.
 * The page can't touch the dashboard. A small script added to it reports clicks in
 * comment mode and draws the comment pins, so comments stick to the right element.
 */
const BRIDGE = `<script>(function(){
var mode=false,pins=[],layer;
function path(el){var p=[];while(el&&el.nodeType===1&&el!==document.body&&el!==document.documentElement){var i=1,s=el;while((s=s.previousElementSibling))if(s.tagName===el.tagName)i++;p.unshift(el.tagName.toLowerCase()+':nth-of-type('+i+')');el=el.parentElement;}return 'body>'+p.join('>');}
function section(el){var s=el.closest('section,header,footer,nav,main,[id]');if(!s)return 'Page';var h=s.querySelector('h1,h2,h3');return (h&&h.textContent.replace(/\\s+/g,' ').trim().slice(0,60))||s.id||s.tagName.toLowerCase();}
function send(m){parent.postMessage(Object.assign({reps:1},m),'*');}
function draw(){if(!layer){layer=document.createElement('div');layer.setAttribute('data-reps','');layer.style.cssText='position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647';document.body.appendChild(layer);}
layer.innerHTML='';pins.forEach(function(p){var el=null;try{el=document.querySelector(p.sel);}catch(e){}if(!el)return;var r=el.getBoundingClientRect();var b=document.createElement('button');b.type='button';b.textContent=p.n;
b.style.cssText='position:absolute;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50% 50% 50% 0;border:2px solid #fff;font:700 11px Montserrat,Arial,sans-serif;color:#fff;cursor:pointer;padding:0;box-shadow:0 2px 6px rgba(0,0,0,.3);background:'+(p.draft?'#E8A33D':p.done?'#9B9AA3':'#6C55A3')+(p.on?';outline:3px solid rgba(108,85,163,.35)':'');
b.style.left=(r.left+window.scrollX+r.width*p.fx)+'px';b.style.top=(r.top+window.scrollY+r.height*p.fy)+'px';b.onclick=function(e){e.preventDefault();e.stopPropagation();if(!p.draft)send({type:'pin',id:p.id});};layer.appendChild(b);});}
document.addEventListener('click',function(e){var t=e.target;if(t.closest&&t.closest('[data-reps]'))return;if(mode){e.preventDefault();e.stopPropagation();var r=t.getBoundingClientRect();var img=t.closest('img,svg,picture');
send({type:'pick',anchor:{sel:path(t),fx:(e.clientX-r.left)/Math.max(r.width,1),fy:(e.clientY-r.top)/Math.max(r.height,1)},target:{section:section(t),text:img?(img.getAttribute&&img.getAttribute('alt')||'Image'):(t.textContent||'').replace(/\\s+/g,' ').trim().slice(0,200)}});return;}
var a=t.closest&&t.closest('a[href]');if(a){var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){var el=h.length>1&&document.getElementById(h.slice(1));if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'});}}else e.preventDefault();}
var f=t.closest&&t.closest('form');if(f&&t.type==='submit')e.preventDefault();},true);
document.addEventListener('submit',function(e){e.preventDefault();},true);
window.addEventListener('message',function(e){var d=e.data||{};if(!d.reps)return;
if(d.type==='mode'){mode=!!d.on;document.documentElement.style.cursor=mode?'crosshair':'';}
if(d.type==='pins'){pins=d.pins||[];draw();}
if(d.type==='scroll'){var p=pins.filter(function(x){return x.id===d.id;})[0];if(p){try{var el=document.querySelector(p.sel);if(el)el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}}}
if(d.type==='top')window.scrollTo(0,0);});
window.addEventListener('resize',draw);window.addEventListener('load',draw);setInterval(draw,1500);send({type:'ready'});
})();</script>`;

const cache = new Map<string, Promise<string>>();
const load = (url: string) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }));
  return cache.get(url)!;
};

export interface FramePin { id: string; n: number; anchor: PinAnchor; done?: boolean; on?: boolean; draft?: boolean }

export default function HtmlFrame({ url, device, width, height, cmode = false, pins = [], scrollTo, onPick, onPin }: {
  url: string;
  device: Device;
  /** Visible width and height of the preview area, in px. */
  width: number;
  height: number;
  cmode?: boolean;
  pins?: FramePin[];
  scrollTo?: string | null;
  onPick?: (anchor: PinAnchor, target: CommentTarget) => void;
  onPin?: (id: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;
    setHtml(null); setErr(false);
    load(url).then((h) => alive && setHtml(h)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [url]);

  const doc = useMemo(() => {
    if (html == null) return '';
    return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${BRIDGE}</body>`) : html + BRIDGE;
  }, [html]);

  const post = (m: object) => ref.current?.contentWindow?.postMessage({ reps: 1, ...m }, '*');

  // Messages from the page: only trust our own frame.
  const cb = useRef({ onPick, onPin });
  cb.current = { onPick, onPin };
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data?.reps) return;
      if (e.data.type === 'ready') setReady((n) => n + 1);
      if (e.data.type === 'pick') cb.current.onPick?.(e.data.anchor, e.data.target);
      if (e.data.type === 'pin') cb.current.onPin?.(e.data.id);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  const pinsKey = JSON.stringify(pins.map((p) => ({ id: p.id, n: p.n, ...p.anchor, done: p.done, on: p.on, draft: p.draft })));
  useEffect(() => { if (ready) post({ type: 'pins', pins: JSON.parse(pinsKey) }); }, [ready, pinsKey]);
  useEffect(() => { if (ready) post({ type: 'mode', on: cmode }); }, [ready, cmode]);
  useEffect(() => { if (ready && scrollTo) post({ type: 'scroll', id: scrollTo }); }, [ready, scrollTo]);

  if (err) return <div className="sv-empty"><p>This page couldn&apos;t be loaded.</p></div>;
  if (html == null) return <div className="loading">Loading page…</div>;

  // Desktop pages are drawn at a real desktop width and scaled to fit, like the template sites.
  const DESKTOP = 1280;
  const zoom = device === 'desktop' && width ? Math.min(1, width / DESKTOP) : 1;
  const w = device === 'desktop' ? DESKTOP : width || 390;
  const h = Math.max(200, height);
  return (
    <div style={{ width: w * zoom, height: h, overflow: 'hidden' }}>
      <iframe
        ref={ref}
        className="html-frame"
        title="Website preview"
        sandbox="allow-scripts"
        srcDoc={doc}
        style={{ width: w, height: h / zoom, transform: `scale(${zoom})`, transformOrigin: '0 0', border: 0, display: 'block', background: '#fff' }}
      />
    </div>
  );
}
