/* ============================================================
   ICC Strategy Hub — API client (chess.com & lichess) + cache
   ============================================================
   - Chess.com : tentative directe puis fallback via plusieurs proxys CORS
   - Cache localStorage avec TTL configurable
   - Toutes les fonctions retournent une Promise
   ============================================================ */

export const API = (() => {
  const TTL_24H = 24 * 60 * 60 * 1000;
  const TTL_1H  = 60 * 60 * 1000;
  const CHESSCOM_PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  /* ---------- Cache LS avec TTL ---------- */
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { value, expiresAt } = JSON.parse(raw);
      if (Date.now() > expiresAt) { localStorage.removeItem(key); return null; }
      return value;
    } catch { return null; }
  }
  function cacheSet(key, value, ttl = TTL_24H) {
    try {
      localStorage.setItem(key, JSON.stringify({
        value, expiresAt: Date.now() + ttl
      }));
    } catch (e) { /* quota plein, on ignore */ }
  }
  function cacheDel(key) { localStorage.removeItem(key); }
  function cacheClear(prefix = '') {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!prefix || k.startsWith(prefix)) localStorage.removeItem(k);
    }
  }

  /* ---------- Fetch robuste chess.com (direct + proxys) ---------- */
  async function fetchChessCom(path) {
    const url = `https://api.chess.com/pub/${path}`;
    const cacheKey = `cc:${path}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const attempts = [url, ...CHESSCOM_PROXIES.map(makeProxyUrl => makeProxyUrl(url))];
    let lastError = null;

    for (const endpoint of attempts) {
      try {
        const r = await fetch(endpoint, {
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        cacheSet(cacheKey, j, TTL_24H);
        return j;
      } catch (e) {
        lastError = e;
      }
    }

    throw new Error(`chess.com fetch failed on ${path}: ${lastError?.message || 'unknown error'}`);
  }

  /* ---------- Lichess (CORS-friendly) ---------- */
  async function fetchLichess(path) {
    const url = `https://lichess.org/api/${path}`;
    const cacheKey = `li:${path}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`lichess ${r.status} on ${path}`);
    const j = await r.json();
    cacheSet(cacheKey, j, TTL_24H);
    return j;
  }

  /* ---------- Profil joueur ---------- */
  async function getProfile(handle, platform = 'chess.com') {
    if (platform === 'lichess') {
      return await fetchLichess(`user/${encodeURIComponent(handle)}`);
    }
    return await fetchChessCom(`player/${encodeURIComponent(handle)}`);
  }

  async function getStats(handle, platform = 'chess.com') {
    if (platform === 'lichess') {
      const u = await fetchLichess(`user/${encodeURIComponent(handle)}`);
      return u.perfs || {};
    }
    return await fetchChessCom(`player/${encodeURIComponent(handle)}/stats`);
  }

  /* ---------- Liste des archives mensuelles (chess.com) ---------- */
  async function getArchives(handle) {
    const j = await fetchChessCom(`player/${encodeURIComponent(handle)}/games/archives`);
    return j.archives || [];
  }

  /* ---------- Parties d'un mois (chess.com) ---------- */
  async function getMonthlyGames(handle, year, month) {
    const m = String(month).padStart(2, '0');
    const j = await fetchChessCom(`player/${encodeURIComponent(handle)}/games/${year}/${m}`);
    return j.games || [];
  }

  /* ---------- Récupère les N derniers mois de parties ---------- */
  async function getRecentGames(handle, monthsBack = 3, opts = {}) {
    const archives = await getArchives(handle);
    const lastN = archives.slice(-monthsBack);
    const all = [];
    for (const url of lastN) {
      // url = "https://api.chess.com/pub/player/X/games/2025/10"
      const m = url.match(/games\/(\d{4})\/(\d{2})$/);
      if (!m) continue;
      try {
        const games = await getMonthlyGames(handle, m[1], parseInt(m[2], 10));
        all.push(...games);
      } catch (e) { console.warn('skip', url, e); }
    }
    // Tri chronologique
    all.sort((a, b) => (a.end_time || 0) - (b.end_time || 0));
    if (opts.timeClass) return all.filter(g => g.time_class === opts.timeClass);
    return all;
  }

  /* ---------- Head-to-head : parties communes A vs B ---------- */
  async function getHeadToHead(handleA, handleB, opts = {}) {
    const monthsBack = opts.monthsBack || 12;
    const games = await getRecentGames(handleA, monthsBack, { timeClass: opts.timeClass });
    const lh = handleB.toLowerCase();
    const filtered = games.filter(g => {
      const wu = (g.white?.username || '').toLowerCase();
      const bu = (g.black?.username || '').toLowerCase();
      return wu === lh || bu === lh;
    });
    return filtered;
  }

  /* ---------- API explorer : ouverture la plus jouée par un joueur ---------- */
  /**
   * Lichess Explorer API (utilise Lichess pour exploration de parties — fonctionne pour pseudos Lichess uniquement)
   * Pour chess.com on calcule nous-même depuis getRecentGames.
   */
  async function lichessExplorerByPlayer(handle, opts = {}) {
    const params = new URLSearchParams({
      player: handle,
      color: opts.color || 'white',
      modes: 'rated',
      speeds: opts.speeds || 'rapid,blitz',
      moves: '8'
    });
    const url = `player?${params}`;
    return await fetchLichess(url);
  }

  return {
    getProfile, getStats, getArchives, getMonthlyGames,
    getRecentGames, getHeadToHead, lichessExplorerByPlayer,
    cacheGet, cacheSet, cacheDel, cacheClear,
    TTL_24H, TTL_1H
  };
})();
