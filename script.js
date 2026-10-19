/* Presentation logic — works like PowerPoint: every "Next" (→ key, scroll, button) reveals the next item
   on the slide, then moves to the next slide. You normally don't need to edit this file. */
const $ = (s, r = document) => r.querySelector(s);
const slides = [...document.querySelectorAll('.slide')];
const total = slides.length, pad = n => String(n + 1).padStart(2, '0');
let cur = 0, step = 0, locked = false;

/* Each slide has a number of steps and an apply(step) function.
   Default: any element with data-step="N" (in index.html) appears when step >= N. */
const info = slides.map(s => {
  const els = [...s.querySelectorAll('[data-step]')];
  const count = els.reduce((m, e) => Math.max(m, +e.dataset.step), 0);
  const tl = s.querySelector('.tl');
  return { count, apply(st) {
    els.forEach(e => e.classList.toggle('show', +e.dataset.step <= st));
    if (tl) tl.style.setProperty('--p', st ? (st >= count ? 1 : (st - .5) / count) : 0); // timeline line grows
  } };
});

const keepAlive = [];   // preloaded images stay in memory so they show instantly
/* Projects slide (#s4): each Next opens the next project in the detail panel (then its screenshots, if any) */
const panel = $('#pdetail');
const cards = [...document.querySelectorAll('.card')];
const plan = [];   // [cardIndex, screenshotIndex]
cards.forEach((c, i) => {
  const n = c.querySelectorAll('.shots span').length;
  if (!n) plan.push([i, -1]); else for (let j = 0; j < n; j++) plan.push([i, j]);
});
function showProject(ci, sj) {
  const c = cards[ci], v = c.querySelector('.vis'), big = $('#mvis');
  const shots = [...c.querySelectorAll('.shots span')];
  const src = sj >= 0 ? shots[sj] : v;
  big.className = sj >= 0 ? 'vis big' : v.className + ' big';
  big.style.cssText = src.style.cssText;
  $('#mstep').textContent = `PROJECT ${ci + 1} OF ${cards.length}` + (shots.length ? ` · SCREENSHOT ${sj + 1}/${shots.length}` : '');
  $('#mtype').textContent = c.querySelector('em').textContent;
  $('#mtitle').textContent = c.querySelector('h3').textContent;
  $('#mdesc').textContent = c.querySelector('p').textContent;
  $('#mlist').innerHTML = c.querySelector('.detail').innerHTML;
  const box = $('#mshots'); box.innerHTML = '';
  shots.forEach((sp, k) => {
    const t = document.createElement('div');
    t.className = 'th' + (k === sj ? ' on' : ''); t.style.cssText = sp.style.cssText; box.append(t);
  });
  cards.forEach((x, k) => x.classList.toggle('on', k === ci));
  const body = panel.querySelector('.body');                       // replay the swap animation
  panel.classList.remove('live'); void body.offsetWidth; panel.classList.add('live');
}
info[slides.indexOf($('#s4'))] = { count: plan.length, apply(st) {
  if (st) return showProject(...plan[st - 1]);
  panel.classList.remove('live'); cards.forEach(x => x.classList.remove('on'));
} };

/* Photo + pet slides (#s5, #s6): each Next EXPANDS the next photo / pet into a big full-quality viewer (no clicking) */
const photoUrl = el => { const m = /url\(["']?([^"')]+)/.exec(getComputedStyle(el).getPropertyValue('--img')); return m ? m[1] : ''; };
['s3', 's5', 's6'].forEach(id => {
  const slide = $('#' + id), items = [...slide.querySelector('.gallery').children];
  const v = document.createElement('div'); v.className = 'viewer';
  v.innerHTML = '<div class="vframe"><img class="vimg" alt="" decoding="async"></div><div class="vcap"><small></small><h3></h3><p></p></div>';
  slide.append(v);
  const frame = $('.vframe', v), img = $('.vimg', v);
  img.onload = () => frame.classList.remove('nofile');
  img.onerror = () => frame.classList.add('nofile');   // file missing -> show the gradient placeholder
  items.forEach(it => { const u = photoUrl(it.matches('.ph') ? it : it.querySelector('.ph')); if (u) { const im = new Image(); im.src = u; im.decode && im.decode().catch(() => {}); keepAlive.push(im); } });
  info[slides.indexOf(slide)] = { count: items.length, apply(st) {
    v.classList.toggle('on', st > 0);
    if (!st) return;
    const it = items[st - 1], ph = it.matches('.ph') ? it : it.querySelector('.ph');
    frame.style.setProperty('--g', getComputedStyle(ph).getPropertyValue('--g'));
    img.src = photoUrl(ph);
    const isPet = !it.matches('.ph');
    $('small', v).textContent = `${isPet ? 'MEET' : 'PHOTO'} ${st}/${items.length} · PRESS →`;
    $('h3', v).textContent = isPet ? (it.querySelector('h3') || {}).textContent || '' : ph.textContent;
    const em = isPet && it.querySelector('em'), pp = isPet && it.querySelector('p');
    $('p', v).textContent = isPet ? [pp && pp.textContent, em && em.textContent].filter(Boolean).join('  ·  ') : '';
    v.classList.remove('swap'); void v.offsetWidth; v.classList.add('swap');
  } };
});
document.querySelectorAll('.gallery').forEach(gal => {      // fade photos in as they scroll into view
  const io = new IntersectionObserver(es => es.forEach(en => en.isIntersecting && en.target.classList.add('in')), { root: gal, threshold: .3 });
  [...gal.querySelectorAll('.ph')].forEach((f, i) => { io.observe(f); f.style.transitionDelay = (i * 60) + 'ms'; });
});

/* ---- Navigation ---- */
const dots = $('#dots');
slides.forEach((_, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
  b.onclick = () => go(i); dots.append(b);
});
function updateHud() {
  slides[cur].classList.toggle('more', step < info[cur].count);   // shows the blinking ▼ while more is coming
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
  $('#count').textContent = `${pad(cur)} / ${pad(total - 1)}` + (info[cur].count && step ? `  ·  ${step}/${info[cur].count}` : '');
}
function go(n, atEnd) {
  if (locked || n < 0 || n >= total || n === cur) return;
  locked = true; const old = cur;
  cur = n; step = atEnd ? info[cur].count : 0;
  slides.forEach((s, i) => { s.classList.toggle('active', i === cur); s.classList.toggle('before', i < cur); if (i === cur) s.scrollTop = 0; });
  slides.forEach(s => s.classList.remove('settled'));               // let the entrance stagger play...
  const here = slides[cur]; setTimeout(() => { if (slides[cur] === here) here.classList.add('settled'); }, 2200); // ...then clear its delays
  info[cur].apply(step); updateHud(); moveMascot(n > old ? 1 : -1);
  const tg = slides[cur].querySelector('.qtag'); showBanner('STAGE ' + pad(cur) + (tg ? ' · ' + tg.textContent : ''));
  setTimeout(() => locked = false, 800);
}
function next() {
  if (locked) return;
  if (step < info[cur].count) { step++; info[cur].apply(step); updateHud(); locked = true; setTimeout(() => locked = false, 450); }
  else go(cur + 1);
}
function prev() {
  if (locked) return;
  if (step > 0) { step--; info[cur].apply(step); updateHud(); locked = true; setTimeout(() => locked = false, 450); }
  else go(cur - 1, true);
}
$('#next').onclick = next; $('#prev').onclick = prev;
document.querySelectorAll('[data-next]').forEach(b => b.onclick = next);
document.querySelectorAll('[data-prev]').forEach(b => b.onclick = prev);
document.querySelectorAll('[data-restart]').forEach(b => b.onclick = () => go(0));

addEventListener('keydown', e => {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  if (e.key === 'Home') go(0);
  if (e.key === 'End') go(total - 1);
});
addEventListener('wheel', e => { if (innerWidth > 700 && Math.abs(e.deltaY) > 25) e.deltaY > 0 ? next() : prev(); }, { passive: true });
let tx = 0, ty = 0;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prev();
  else if (innerWidth > 700 && Math.abs(dy) > 60) dy < 0 ? next() : prev();
}, { passive: true });
updateHud();

/* ---- Mouse clicker: LEFT-click = Next, RIGHT-click = Previous (mouse only; buttons keep their own job).
   To swap them, exchange next() and prev() below. ---- */
addEventListener('contextmenu', e => { e.preventDefault(); prev(); });
addEventListener('click', e => {
  if (e.pointerType && e.pointerType !== 'mouse') return;   // ignore taps on touch screens
  if (e.target.closest('button, a')) return;                // START, ← →, dots, Restart work normally
  next();
});

/* ---- Opener: types out the questions from the next slides ---- */
const typeEl = $('#typing');
const questions = [...document.querySelectorAll('.question')].map(q => q.textContent.trim());
if (typeEl) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) typeEl.textContent = questions[0];
  else {
    let qi = 0, ci = 0, del = false;
    (function tick() {
      let wait = del ? 25 : 55;
      if (cur === 0) {
        const t = questions[qi];
        ci += del ? -1 : 1; typeEl.textContent = t.slice(0, ci);
        if (!del && ci === t.length) { del = true; wait = 1700; }
        else if (del && ci === 0) { del = false; qi = (qi + 1) % questions.length; wait = 350; }
      }
      setTimeout(tick, cur === 0 ? wait : 400);
    })();
  }
}

/* ---- Background particles + gentle mouse parallax ---- */
const pc = $('#particles');
for (let i = 0; i < 18; i++) {
  const p = document.createElement('i');
  p.style.cssText = `left:${Math.random() * 100}%;animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s`;
  pc.append(p);
}


/* ===================== PIXEL ART =====================
   Every sprite is drawn from a small text map: each letter is a color (see PAL), "." is empty.
   Edit a map or a color to redesign a sprite. */
const PAL = { K: '#1b1b2f', O: '#ffb86b', W: '#ffffff', E: '#1b1b2f', P: '#ff8fb1', Y: '#ffd84a', L: '#fff2a8', R: '#ff5d7a', B: '#cfe6ff' };
const ART = {
  cat:   ['..K......K..', '.KOK....KOK.', '.KOOKKKKOOK.', 'KOOOOOOOOOOK', 'KOEWOOOOEWOK', 'KOEEOOOOEEOK', 'KPOOOPPOOOPK', 'KOOOOOOOOOOK', '.KOOOOOOOOK.', '..KKKKKKKK..'],
  heart: ['.KK.KK.', 'KRRKRRK', 'KRRRRRK', '.KRRRK.', '..KRK..', '...K...'],
  coin:  ['.KKKK.', 'KYLYYK', 'KYLYYK', 'KYYYYK', '.KKKK.'],
  spark: ['..W..', '..W..', 'WWWWW', '..W..', '..W..'],
  cloud: ['....KKKK....', '..KKBBBBKK..', '.KBBBBBBBBK.', 'KBBBBBBBBBBK', '.KKKKKKKKKK.']
};
function sprite(name, px, cls) {
  const rows = ART[name], c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  c.style.width = c.width * px + 'px'; c.style.height = c.height * px + 'px';
  if (cls) c.className = cls;
  return c;
}

/* Game HUD: hearts, stage number, coin counter */
for (let i = 0; i < 3; i++) $('#hearts').append(sprite('heart', 3));
$('#coinic').append(sprite('coin', 3));

/* Level track: a pixel cat walks along the bottom as you move through the slides, collecting coins */
const track = $('#track');
const mascot = sprite('cat', 4, 'mascot');
const coinEls = [];
for (let i = 0; i < total - 1; i++) {
  const c = sprite('coin', 3, 'tcoin');
  c.style.left = `calc(1.5rem + ${(i + .5) / (total - 1)} * (100% - 3rem))`;
  track.append(c); coinEls.push(c);
}
const mw = document.createElement('div'); mw.className = 'mw'; mw.append(mascot); track.append(mw);
const placeMascot = () => mw.style.transform = `translateX(${24 + cur / (total - 1) * (track.clientWidth - 48)}px)`;
addEventListener('resize', placeMascot);
function moveMascot(dir) {
  placeMascot();
  mascot.style.setProperty('--f', dir);
  coinEls.forEach((c, i) => c.classList.toggle('got', i < cur));
  $('#stage').textContent = 'STAGE ' + pad(cur);
  const b = $('#coins'); b.textContent = cur; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  mascot.classList.remove('hop'); void mascot.offsetWidth; mascot.classList.add('hop');
}
moveMascot(1);

/* Decorations: cat + sparkles around the profile photo, big cat on the last slide */
document.querySelectorAll('.pwrap').forEach(w =>
  w.append(sprite('cat', 6, 'deco d-cat'), sprite('spark', 5, 'deco d-sp1'), sprite('spark', 3, 'deco d-sp2'), sprite('heart', 5, 'deco d-heart')));
const m = document.createElement('div');
m.className = 's9mascot'; m.innerHTML = '<div class="say">ANY QUESTIONS?</div>'; m.append(sprite('cat', 10));
$('#s9').append(m);

/* Background: twinkling sparkles + slow pixel clouds */
const bgEl = $('.bg');
for (let i = 0; i < 9; i++) {
  const sp = sprite('spark', 2 + (i % 2), 'spk');
  sp.style.left = Math.random() * 96 + '%'; sp.style.top = Math.random() * 88 + '%'; sp.style.animationDelay = -Math.random() * 4 + 's';
  bgEl.append(sp);
}
[['10%', 120, 0], ['58%', 170, -80]].forEach(([top, dur, delay]) => {
  const cl = sprite('cloud', 9, 'cloud');
  cl.style.top = top; cl.style.animationDuration = dur + 's'; cl.style.animationDelay = delay + 's';
  bgEl.append(cl);
});


/* Preload + decode every project screenshot up front so switching projects is instant (no lag) */
document.querySelectorAll('.cards [style*="--img"]').forEach(el => {
  const m = /url\(["']?([^"')]+)["']?\)/.exec(el.getAttribute('style'));
  if (m) { const im = new Image(); im.src = m[1]; if (im.decode) im.decode().catch(() => {}); keepAlive.push(im); }
});
setTimeout(() => slides[0].classList.add('settled'), 2200);

/* "STAGE 03 · Q2" banner that pops in for a moment on every new slide */
const banner = document.createElement('div'); banner.id = 'banner'; document.body.append(banner);
function showBanner(t) { banner.textContent = t; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); }