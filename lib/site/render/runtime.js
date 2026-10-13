/* Makes an exported website page work on its own, without React: scroll reveals, counting
   numbers, the feature showcase, FAQ, before and after slider, countdown and the forms.
   Added to the end of every page the dashboard saves as HTML. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canWatch = 'IntersectionObserver' in window;
  var all = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };

  // Sections fade in as they scroll into view.
  all('.sk').forEach(function (root) {
    if (reduce || !canWatch) return;
    root.classList.add('sk-armed');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    all('.sk-rv', root).forEach(function (el) { io.observe(el); });
  });

  // "2,000+" counts up the first time it's seen.
  all('[data-count]').forEach(function (el) {
    var m = (el.getAttribute('data-count') || '').match(/^([^\d]*)([\d,.]+)(.*)$/);
    if (!m || reduce || !canWatch) return;
    var target = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / 1400);
        el.textContent = m[1] + (target * (1 - Math.pow(1 - k, 3))).toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.4 });
    io.observe(el);
  });

  // Feature showcases step through on a timer; hovering or clicking one holds it.
  all('[data-cycle]').forEach(function (sec) {
    var by = function (a) { return function (x, y) { return +x.getAttribute(a) - +y.getAttribute(a); }; };
    var items = all('[data-ci]', sec).sort(by('data-ci')), slides = all('[data-cs]', sec).sort(by('data-cs'));
    if (!items.length) return;
    var ms = +sec.getAttribute('data-cycle') || 4200, at = 0, held = false, timer;
    function show(n) {
      at = n;
      items.forEach(function (el, k) {
        var on = k === n;
        el.classList.toggle('on', on);
        if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', on);
        if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', on);
        var bar = el.querySelector('[class$="-bar"] i');
        if (bar && on) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
      });
      slides.forEach(function (el, k) { el.classList.toggle('on', k === n); el.setAttribute('aria-hidden', k !== n); });
    }
    function run() { clearInterval(timer); if (!reduce && !held && items.length > 1) timer = setInterval(function () { show((at + 1) % items.length); }, ms); }
    items.forEach(function (el, k) {
      var pick = function () { held = true; clearInterval(timer); show(k); };
      el.addEventListener('mouseenter', pick); el.addEventListener('focus', pick); el.addEventListener('click', pick);
    });
    sec.addEventListener('mouseleave', function () { held = false; run(); });
    run();
  });

  // FAQ: one answer open at a time.
  all('[data-faq]').forEach(function (q) {
    var b = q.querySelector('button');
    if (!b) return;
    b.addEventListener('click', function () {
      var open = !q.classList.contains('open');
      all('[data-faq]', q.parentNode).forEach(function (o) { o.classList.remove('open'); var ob = o.querySelector('button'); if (ob) ob.setAttribute('aria-expanded', 'false'); });
      if (open) { q.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
    });
  });

  // Drag to compare before and after.
  all('[data-compare]').forEach(function (c) {
    var r = c.querySelector('input[type=range]');
    if (r) r.addEventListener('input', function () { c.style.setProperty('--at', r.value + '%'); });
  });

  // A soft light that follows the pointer across cards.
  all('[data-spot]').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var b = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - b.left) / Math.max(b.width, 1)) * 100 + '%');
      el.style.setProperty('--my', ((e.clientY - b.top) / Math.max(b.height, 1)) * 100 + '%');
    });
  });

  // Days, hours and minutes until 8am on launch day.
  all('[data-countdown]').forEach(function (el) {
    var m = (el.getAttribute('data-countdown') || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return;
    var at = new Date(+m[1], +m[2] - 1, +m[3], 8).getTime();
    function tick() {
      var left = Math.max(0, at - Date.now());
      var v = { d: Math.floor(left / 864e5), h: Math.floor((left % 864e5) / 36e5), m: Math.floor((left % 36e5) / 6e4) };
      all('[data-k]', el).forEach(function (b) { b.textContent = String(v[b.getAttribute('data-k')]).padStart(2, '0'); });
    }
    tick(); setInterval(tick, 30000);
  });

  // Forms send leads to the client's dashboard.
  all('form[data-capture]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = { client: f.getAttribute('data-client'), source: f.getAttribute('data-source'), form: f.getAttribute('data-form'), page: f.getAttribute('data-page') || location.pathname };
      all('input[name]', f).forEach(function (i) { body[i.name] = i.value; });
      var btn = f.querySelector('button[type=submit]'), note = f.querySelector('[data-note]');
      var done = function () { var p = document.createElement('p'); p.className = f.getAttribute('data-thanks-class') || ''; p.textContent = f.getAttribute('data-thanks') || 'Thanks!'; f.innerHTML = ''; f.appendChild(p); };
      var ep = f.getAttribute('data-endpoint');
      if (!ep) { done(); return; }
      if (btn) btn.disabled = true;
      fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(); done(); })
        .catch(function () { if (btn) btn.disabled = false; if (note) note.textContent = 'That did not go through. Please try again.'; });
    });
  });
})();
