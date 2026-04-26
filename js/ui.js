/* ============================================================
   ICC Strategy Hub — UI helpers
   ============================================================ */

export const UI = (() => {

  /* ---------- Helpers DOM ---------- */
  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v !== null && v !== undefined && v !== false) {
        e.setAttribute(k, v);
      }
    }
    children.flat().forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }
  function clear(node) { while (node?.firstChild) node.removeChild(node.firstChild); }

  /* ---------- Initiales pour fallback avatar ---------- */
  function initials(name) {
    const s = (name || '').replace(/[^a-zA-Z0-9]/g, '');
    return s.slice(0, 2).toUpperCase() || '?';
  }

  /* ---------- Avatar chess.com avec cache ---------- */
  const avatarCache = new Map();
  async function loadAvatar(elTarget, handle, displayName) {
    if (!elTarget) return;
    // Initiales par défaut
    const initSpan = elTarget.querySelector('.av-initials') ||
      Object.assign(document.createElement('span'), { className: 'av-initials' });
    if (!initSpan.parentNode) elTarget.appendChild(initSpan);
    initSpan.textContent = initials(displayName || handle);

    if (!handle) return;
    if (avatarCache.has(handle)) {
      const url = avatarCache.get(handle);
      if (url) {
        elTarget.style.backgroundImage = `url("${url}")`;
        elTarget.classList.add('loaded');
      }
      return;
    }
    try {
      const r = await fetch(
        'https://api.allorigins.win/raw?url=' +
        encodeURIComponent(`https://api.chess.com/pub/player/${encodeURIComponent(handle)}`)
      );
      const j = await r.json();
      const url = j.avatar || '';
      avatarCache.set(handle, url);
      if (url) {
        const img = new Image();
        img.onload = () => {
          elTarget.style.backgroundImage = `url("${url}")`;
          elTarget.classList.add('loaded');
        };
        img.src = url;
      }
    } catch (_) {
      avatarCache.set(handle, '');
    }
  }

  /* ---------- Format dates / ELO ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
  function fmtNum(n) { return Number(n).toLocaleString('fr-FR').replace(/\u202f/g, ' '); }

  /* ---------- Toast ---------- */
  function toast(msg, kind = 'info') {
    const t = el('div', { class: `toast toast-${kind}` }, msg);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  /* ---------- Modal / Drawer ---------- */
  function openDrawer(content) {
    const overlay = el('div', { class: 'drawer-overlay', onclick: closeDrawer });
    const drawer = el('div', { class: 'drawer', onclick: e => e.stopPropagation() });
    drawer.appendChild(content);
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    document.addEventListener('keydown', escListener);
  }
  function closeDrawer() {
    const o = $('.drawer-overlay');
    if (!o) return;
    o.classList.remove('show');
    setTimeout(() => o.remove(), 250);
    document.removeEventListener('keydown', escListener);
  }
  function escListener(e) { if (e.key === 'Escape') closeDrawer(); }

  /* ---------- Skeleton loader ---------- */
  function skeleton(lines = 3) {
    const wrap = el('div', { class: 'skel' });
    for (let i = 0; i < lines; i++) wrap.appendChild(el('div', { class: 'skel-line' }));
    return wrap;
  }

  /* ---------- Sparkline SVG ---------- */
  function sparkline(values, opts = {}) {
    if (!values?.length) return el('span');
    const w = opts.width || 140, h = opts.height || 32, pad = 2;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const step = (w - 2*pad) / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / range) * (h - 2*pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="spark">
      <polyline fill="none" stroke="url(#sparkG)" stroke-width="2" points="${pts}"/>
      <defs><linearGradient id="sparkG" x1="0" x2="1">
        <stop offset="0" stop-color="#f5c542"/><stop offset="1" stop-color="#ff7a1a"/>
      </linearGradient></defs></svg>`;
    return el('span', { html: svg, class: 'spark-wrap' });
  }

  /* ---------- Badge couleur danger ---------- */
  function dangerBadge(level) {
    const labels = {
      critical: { txt: 'CRITIQUE', cls: 'b-crit' },
      risky:    { txt: 'RISQUÉ',   cls: 'b-risk' },
      neutral:  { txt: 'NEUTRE',   cls: 'b-neut' },
      favorable:{ txt: 'FAVORABLE',cls: 'b-fav'  },
      unknown:  { txt: 'INCONNU',  cls: 'b-unk'  }
    };
    const m = labels[level] || labels.unknown;
    return el('span', { class: `badge ${m.cls}` }, m.txt);
  }

  return {
    $, $$, el, clear, initials, loadAvatar, fmtDate, fmtNum,
    toast, openDrawer, closeDrawer, skeleton, sparkline, dangerBadge
  };
})();
