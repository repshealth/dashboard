/**
 * The one-line tracking snippet for a funnel page. It counts one view per page load, keeps an
 * anonymous visitor id in the browser (for unique visitors), and never slows the page down.
 */
export function trackingSnippet(base: string, funnelId: string) {
  const endpoint = `${base.replace(/\/+$/, '')}/api/fv`;
  return `<script>/* REPS funnel tracking */(function(){try{var k="reps_v",v;try{v=localStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v)}}catch(e){v=Math.random().toString(36).slice(2)}var q=new URLSearchParams(location.search),b=JSON.stringify({f:"${funnelId}",v:v,r:document.referrer,s:q.get("utm_source")||"",w:innerWidth});navigator.sendBeacon?navigator.sendBeacon("${endpoint}",b):fetch("${endpoint}",{method:"POST",body:b,keepalive:true,mode:"no-cors"})}catch(e){}})();</script>`;
}
