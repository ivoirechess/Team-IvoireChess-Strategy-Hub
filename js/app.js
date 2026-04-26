/* ============================================================
   ICC Strategy Hub — App principale
   ============================================================ */

import { API }      from './api.js';
import { Analyzer } from './analyzer.js';
import { Notes }    from './notes.js';
import { UI }       from './ui.js';

const { $, $$, el, clear, loadAvatar, fmtDate, fmtNum, toast,
        openDrawer, closeDrawer, skeleton, sparkline, dangerBadge, initials } = UI;

let TOURNAMENT = null; // chargé au boot

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  try {
    const r = await fetch('./data/tournament.json');
    TOURNAMENT = await r.json();
  } catch (e) {
    toast('Impossible de charger tournament.json', 'error');
    return;
  }

  // Routing
  window.addEventListener('hashchange', route);
  route();

  // Tabs
  $$('.tab').forEach(t => {
    t.addEventListener('click', () => {
      window.location.hash = '#' + t.dataset.view;
    });
  });
}

function route() {
  const view = (window.location.hash.slice(1) || 'dashboard').split('?')[0];
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));

  if (view === 'dashboard')   renderDashboard();
  else if (view === 'match')  renderMatchCenter();
  else if (view === 'scout')  renderScout();
  else if (view === 'roster') renderRoster();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const root = $('#view-dashboard');
  clear(root);

  const myTeam = TOURNAMENT.teams[TOURNAMENT.myTeamId];
  const upcoming = findUpcomingMatches();

  // Hero
  const hero = el('div', { class: 'hero' });
  hero.innerHTML = `
    <div class="hero-king">♔</div>
    <div class="hero-content">
      <span class="hero-tag">${myTeam.name.toUpperCase()} · WAR ROOM</span>
      <h1 class="hero-title">PRÉPARE-TOI<br>À ÉCRASER</h1>
      <p class="hero-sub">
        Centre de préparation stratégique de ${myTeam.name}.
        Scoute, analyse et prépare un plan de bataille pour chaque match du Team Championship.
      </p>
    </div>
  `;
  root.appendChild(hero);

  // Stats
  const myMatches = TOURNAMENT.schedule.filter(s =>
    s.teamA === TOURNAMENT.myTeamId || s.teamB === TOURNAMENT.myTeamId);
  const today = new Date().toISOString().slice(0, 10);
  const remaining = myMatches.filter(m => m.dateSat >= today);
  const next = remaining[0];

  const statsGrid = el('div', { class: 'stats-grid' });
  [
    { label: 'Mes Matchs', value: myMatches.length, foot: 'AU TOTAL' },
    { label: 'Restants', value: remaining.length, foot: 'À VENIR' },
    { label: 'Total ELO', value: fmtNum(myTeam.totalElo), foot: 'PUISSANCE ÉQUIPE' },
    { label: 'Poule', value: myTeam.group, foot: 'GROUPE' }
  ].forEach(s => {
    statsGrid.appendChild(el('div', { class: 'stat-card' },
      el('div', { class: 'stat-label' }, s.label),
      el('div', { class: 'stat-value' }, String(s.value)),
      el('div', { class: 'stat-foot' }, s.foot)
    ));
  });
  root.appendChild(statsGrid);

  // Prochain match
  if (next) {
    const teamA = TOURNAMENT.teams[next.teamA];
    const teamB = TOURNAMENT.teams[next.teamB];
    const isHome = next.teamA === TOURNAMENT.myTeamId;
    const myT = isHome ? teamA : teamB;
    const oppT = isHome ? teamB : teamA;
    const capMy = myT.players.find(p => p.name.toLowerCase() === myT.captain.toLowerCase());
    const capOpp = oppT.players.find(p => p.name.toLowerCase() === oppT.captain.toLowerCase());

    const sec = el('section', { class: 'section' });
    sec.innerHTML = `
      <div class="section-head">
        <div class="section-title">
          <div class="section-num">01</div>
          <div class="section-name">PROCHAIN MATCH</div>
        </div>
        <div class="section-meta">Week-end ${next.week} · ${next.dates}</div>
      </div>
    `;
    const card = el('div', { class: 'next-match' });
    card.innerHTML = `
      <div class="nm-team">
        <div class="nm-avatar"><div class="nm-avatar-inner" data-handle="${capMy.handle}" data-name="${capMy.name}"></div></div>
        <div class="nm-info">
          <div class="nm-team-name">${myT.name}</div>
          <div class="nm-team-elo">${fmtNum(myT.totalElo)} ELO · POULE ${myT.group}</div>
        </div>
      </div>
      <div>
        <div class="nm-vs">VS</div>
        <div class="nm-meta">SAM ${formatFR(next.dateSat)} · DIM ${formatFR(next.dateSun)}</div>
      </div>
      <div class="nm-team right">
        <div class="nm-avatar"><div class="nm-avatar-inner" data-handle="${capOpp.handle}" data-name="${capOpp.name}"></div></div>
        <div class="nm-info">
          <div class="nm-team-name">${oppT.name}</div>
          <div class="nm-team-elo">${fmtNum(oppT.totalElo)} ELO · POULE ${oppT.group}</div>
        </div>
      </div>
      <div class="nm-cta">
        <button class="btn primary" onclick="window.location.hash='#match?w=${next.week}'">⚔️ OUVRIR LE MATCH CENTER</button>
        <button class="btn" onclick="window.location.hash='#scout'">🔍 SCOUT LIBRE</button>
      </div>
    `;
    sec.appendChild(card);
    root.appendChild(sec);

    // Charger les avatars
    setTimeout(() => {
      $$('.nm-avatar-inner', card).forEach(a => loadAvatar(a, a.dataset.handle, a.dataset.name));
    }, 50);
  }

  // Liste de tous mes matchs à venir
  if (upcoming.length > 0) {
    const sec = el('section', { class: 'section' });
    sec.innerHTML = `
      <div class="section-head">
        <div class="section-title">
          <div class="section-num">02</div>
          <div class="section-name">CALENDRIER</div>
        </div>
        <div class="section-meta">${upcoming.length} match(s) à préparer</div>
      </div>
    `;
    const grid = el('div', { class: 'boards-grid' });
    upcoming.forEach(m => {
      const isHome = m.teamA === TOURNAMENT.myTeamId;
      const myT = isHome ? TOURNAMENT.teams[m.teamA] : TOURNAMENT.teams[m.teamB];
      const oppT = isHome ? TOURNAMENT.teams[m.teamB] : TOURNAMENT.teams[m.teamA];
      const c = el('div', { class: 'roster-card', onclick: () => window.location.hash='#match?w='+m.week });
      c.innerHTML = `
        <div class="roster-avatar"><div class="roster-avatar-inner" data-handle="${oppT.players.find(p=>p.name.toLowerCase()===oppT.captain.toLowerCase())?.handle}"><span class="av-initials">${initials(oppT.captain)}</span></div></div>
        <div class="roster-info">
          <div class="roster-name">vs ${oppT.name}</div>
          <div class="roster-meta">W${m.week} · ${m.dates}</div>
        </div>
        <div class="roster-elo">${fmtNum(oppT.totalElo)}</div>
      `;
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    root.appendChild(sec);
    setTimeout(() => {
      $$('.roster-avatar-inner', grid).forEach(a => loadAvatar(a, a.dataset.handle));
    }, 50);
  }
}

function findUpcomingMatches() {
  const today = new Date().toISOString().slice(0, 10);
  return TOURNAMENT.schedule.filter(s =>
    (s.teamA === TOURNAMENT.myTeamId || s.teamB === TOURNAMENT.myTeamId) &&
    s.dateSat >= today
  );
}

function formatFR(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).toUpperCase();
}

/* ============================================================
   MATCH CENTER — vue par échiquier
   ============================================================ */
function renderMatchCenter() {
  const root = $('#view-match');
  clear(root);

  // Quel week-end ?
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const weekParam = parseInt(params.get('w'), 10);
  const myMatches = TOURNAMENT.schedule.filter(s =>
    s.teamA === TOURNAMENT.myTeamId || s.teamB === TOURNAMENT.myTeamId);
  const match = myMatches.find(m => m.week === weekParam) || myMatches[0];

  if (!match) {
    root.appendChild(el('div', { class: 'hero' },
      el('h1', { class: 'hero-title' }, 'Aucun match'),
      el('p', { class: 'hero-sub' }, 'Pas de match programmé pour ton équipe.')));
    return;
  }

  const isHome = match.teamA === TOURNAMENT.myTeamId;
  const myT = TOURNAMENT.teams[isHome ? match.teamA : match.teamB];
  const oppT = TOURNAMENT.teams[isHome ? match.teamB : match.teamA];

  // Header
  const hero = el('div', { class: 'hero' });
  hero.innerHTML = `
    <div class="hero-king">♔</div>
    <div class="hero-content">
      <span class="hero-tag">WEEK-END ${String(match.week).padStart(2,'0')} · ${match.dates.toUpperCase()}</span>
      <h1 class="hero-title">${myT.name}<br>VS ${oppT.name}</h1>
      <p class="hero-sub">
        5 affrontements à préparer. Clique sur un échiquier pour ouvrir le dossier de prépa complet.
      </p>
    </div>
  `;
  root.appendChild(hero);

  // Sélecteur de week-end
  const selector = el('div', { class: 'controls-row mt-16', style: 'margin-bottom:24px;flex-wrap:wrap' });
  myMatches.forEach(m => {
    const oppId = m.teamA === TOURNAMENT.myTeamId ? m.teamB : m.teamA;
    const opp = TOURNAMENT.teams[oppId];
    const btn = el('button', {
      class: 'btn' + (m.week === match.week ? ' primary' : ''),
      onclick: () => { window.location.hash = '#match?w=' + m.week; }
    }, `W${m.week} · vs ${opp.name.replace(/^Team\s+/, '')}`);
    selector.appendChild(btn);
  });
  root.appendChild(selector);

  // Section échiquiers
  const sec = el('section', { class: 'section' });
  sec.innerHTML = `
    <div class="section-head">
      <div class="section-title">
        <div class="section-num">★</div>
        <div class="section-name">LES 5 ÉCHIQUIERS</div>
      </div>
      <div class="section-meta">Clique pour ouvrir un dossier de prépa</div>
    </div>
  `;
  const grid = el('div', { class: 'boards-grid' });

  // Trier par numéro d'échiquier (1 → 5)
  const sortedBoards = [...match.boards].sort((a, b) => a.board - b.board);
  sortedBoards.forEach(b => {
    const myName = isHome ? b.a : b.b;
    const oppName = isHome ? b.b : b.a;
    const myP = myT.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
    const oppP = oppT.players.find(p => p.name.toLowerCase() === oppName.toLowerCase());

    const card = el('div', {
      class: 'board-card' + (b.board === 1 ? ' captain' : ''),
      onclick: () => openDossier(myP, oppP, b, match)
    });
    card.innerHTML = `
      <div class="board-card-head">
        <div class="board-num-wrap">
          <div class="board-num">${b.board}</div>
          <div class="board-meta">
            ${b.day === 'sat' ? 'SAMEDI' : 'DIMANCHE'}<br>
            <strong>19h00</strong>
          </div>
        </div>
        <div class="board-points">${b.board === 1 ? '2 PTS' : '1 PT'}</div>
      </div>
      <div class="board-vs-row">
        <div class="bvs-player">
          <div class="bvs-avatar"><div class="bvs-avatar-inner" data-handle="${myP?.handle}" data-name="${myName}"></div></div>
          <div>
            <div class="bvs-name">${myName}</div>
            <div class="bvs-elo">${myP?.elo || '?'} ELO</div>
          </div>
        </div>
        <div class="bvs-vs">VS</div>
        <div class="bvs-player right">
          <div class="bvs-avatar"><div class="bvs-avatar-inner" data-handle="${oppP?.handle}" data-name="${oppName}"></div></div>
          <div>
            <div class="bvs-name">${oppName}</div>
            <div class="bvs-elo">${oppP?.elo || '?'} ELO</div>
          </div>
        </div>
      </div>
      <div class="board-tags">
        ${b.board === 1 ? '<span class="tag gold">★ DUEL CAPITAINES</span>' : ''}
        <span class="tag">DIFF ${(myP?.elo || 0) - (oppP?.elo || 0) >= 0 ? '+' : ''}${(myP?.elo || 0) - (oppP?.elo || 0)}</span>
        <span class="tag">CLIQUE POUR OUVRIR →</span>
      </div>
    `;
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  root.appendChild(sec);

  setTimeout(() => {
    $$('.bvs-avatar-inner', grid).forEach(a => loadAvatar(a, a.dataset.handle, a.dataset.name));
  }, 50);
}

/* ============================================================
   DOSSIER DE PRÉPA (drawer)
   ============================================================ */
async function openDossier(myP, oppP, board, match) {
  const root = el('div');
  // Header
  const head = el('div', { class: 'dossier-head' });
  head.innerHTML = `
    <div>
      <div style="font-family:var(--font-head);font-size:11px;letter-spacing:.3em;color:var(--dim);">
        ÉCHIQUIER ${board.board} · ${board.board === 1 ? '★ CAPITAINES · 2 PTS' : '1 PT'} · W${match.week}
      </div>
      <div class="dossier-title">${myP.name} <span class="dim">vs</span> ${oppP.name}</div>
    </div>
    <button class="icon-btn" onclick="(${closeDrawer.toString()})()">✕</button>
  `;
  root.appendChild(head);

  // Tabs
  const body = el('div', { class: 'dossier-body' });
  const tabs = el('div', { class: 'dossier-tabs' });
  ['Vue d\'ensemble', 'Répertoire adverse', 'Croisement', 'Forme', 'Head-to-head', 'Notes', 'Plan'].forEach((label, i) => {
    const t = el('button', {
      class: 'dossier-tab' + (i === 0 ? ' active' : ''),
      'data-pane': 'pane-' + i,
      onclick: e => {
        $$('.dossier-tab', body).forEach(x => x.classList.remove('active'));
        $$('.dossier-pane', body).forEach(x => x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        $('#' + e.currentTarget.dataset.pane, body).classList.add('active');
      }
    }, label);
    tabs.appendChild(t);
  });
  body.appendChild(tabs);

  // Panes
  const panes = ['pane-0','pane-1','pane-2','pane-3','pane-4','pane-5','pane-6'].map((id, i) =>
    el('div', { id, class: 'dossier-pane' + (i === 0 ? ' active' : '') })
  );
  panes.forEach(p => body.appendChild(p));

  // Loading initial
  panes[0].appendChild(skeleton(4));
  root.appendChild(body);
  openDrawer(root);

  // Lancer l'analyse
  try {
    await runDossierAnalysis(panes, myP, oppP, board, match);
  } catch (e) {
    console.error(e);
    panes[0].innerHTML = `<p class="dim">Erreur d'analyse : ${e.message}</p>`;
    toast('Erreur lors de la récupération des parties', 'error');
  }
}

/* ============================================================
   Analyse complète d'un duel
   ============================================================ */
async function runDossierAnalysis(panes, myP, oppP, board, match) {
  // Fetch en parallèle
  const [oppGames, myGames, oppProfile, myProfile, oppStats, h2h] = await Promise.all([
    API.getRecentGames(oppP.handle, 3, { timeClass: 'rapid' }).catch(() => []),
    API.getRecentGames(myP.handle, 3, { timeClass: 'rapid' }).catch(() => []),
    API.getProfile(oppP.handle).catch(() => null),
    API.getProfile(myP.handle).catch(() => null),
    API.getStats(oppP.handle).catch(() => null),
    API.getHeadToHead(myP.handle, oppP.handle, { monthsBack: 12, timeClass: 'rapid' }).catch(() => [])
  ]);

  // === Pane 0 : Vue d'ensemble
  const overall = Analyzer.globalSummary(oppGames, oppP.handle);
  const recentOpp = Analyzer.recentForm(oppGames, oppP.handle, 20);
  const colorReco = Analyzer.colorRecommendation(myGames, oppGames, myP.handle, oppP.handle);

  panes[0].innerHTML = '';
  panes[0].appendChild(buildOverviewPane(myP, oppP, overall, recentOpp, colorReco, oppProfile, oppStats, oppGames.length, myGames.length));

  // === Pane 1 : Répertoire adverse
  const oppOpenings = Analyzer.openingsByColor(oppGames, oppP.handle);
  const traps = Analyzer.trapOpenings(oppGames, oppP.handle, 3);
  panes[1].appendChild(buildOpeningsPane(oppOpenings, traps, oppP.name));

  // === Pane 2 : Croisement
  const cross = Analyzer.crossRepertoire(myGames, myP.handle, oppOpenings);
  panes[2].appendChild(buildCrossPane(cross, myP, oppP));

  // === Pane 3 : Forme
  const heat = Analyzer.timePerformance(oppGames, oppP.handle);
  panes[3].appendChild(buildFormPane(recentOpp, heat, oppP));

  // === Pane 4 : Head-to-head
  panes[4].appendChild(buildH2HPane(h2h, myP, oppP));

  // === Pane 5 : Notes
  panes[5].appendChild(buildNotesPane(oppP));

  // === Pane 6 : Plan
  panes[6].appendChild(buildPlanPane(myP, oppP, board, oppOpenings, cross, colorReco, traps));
}

/* ============================================================
   PANES
   ============================================================ */
function buildOverviewPane(myP, oppP, overall, recent, colorReco, profile, stats, oppGameCount, myGameCount) {
  const wrap = el('div');

  // Profil rapide adverse
  const profSec = el('div', { class: 'form-card' });
  const country = profile?.country?.split('/')?.pop() || '';
  const ratingRapid = stats?.chess_rapid?.last?.rating || oppP.elo;
  const peakRapid = stats?.chess_rapid?.best?.rating || ratingRapid;
  profSec.innerHTML = `
    <div class="cross-block-head">PROFIL ${oppP.name.toUpperCase()}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
      <div><div class="stat-label">RAPID</div><div class="stat-value">${ratingRapid}</div></div>
      <div><div class="stat-label">PEAK</div><div class="stat-value">${peakRapid}</div></div>
      <div><div class="stat-label">PARTIES</div><div class="stat-value">${oppGameCount}</div></div>
      <div><div class="stat-label">WIN RATE</div><div class="stat-value">${overall.winRate}%</div></div>
    </div>
    <div class="mt-16 dim" style="font-size:13px;">
      ${overall.wins}V · ${overall.draws}N · ${overall.losses}D
      · BLANC ${overall.asWhite.winRate}% (${overall.asWhite.games} parties)
      · NOIR ${overall.asBlack.winRate}% (${overall.asBlack.games} parties)
    </div>
  `;
  wrap.appendChild(profSec);

  // Reco couleur
  const reco = el('div', { class: 'form-card mt-16' });
  reco.innerHTML = `
    <div class="cross-block-head">RECOMMANDATION COULEUR</div>
    <div style="display:flex;align-items:center;gap:14px;">
      <span class="pill" style="font-size:14px;padding:8px 18px;">${
        colorReco.suggestColor === 'white' ? '⬜ JOUE BLANC' :
        colorReco.suggestColor === 'black' ? '⬛ JOUE NOIR' :
        '⚖ COULEUR INDIFFÉRENTE'
      }</span>
      <div class="dim" style="font-size:13px;">${colorReco.reason}</div>
    </div>
  `;
  wrap.appendChild(reco);

  // Forme
  if (recent.windowSize > 0) {
    const f = el('div', { class: 'form-card mt-16' });
    f.innerHTML = `
      <div class="cross-block-head">FORME RÉCENTE (${recent.windowSize} dernières)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center;">
        <div>
          <div class="form-streak ${recent.streak.type}">${recent.streak.length}${recent.streak.type}</div>
          <div class="dim" style="font-size:12px;">SÉRIE EN COURS</div>
        </div>
        <div>
          <div class="stat-value">${recent.winRate}%</div>
          <div class="stat-foot">WIN RATE 20 DERNIÈRES</div>
        </div>
      </div>
      <div style="margin-top:14px;font-size:12px;color:var(--dim);">
        ELO Δ : <strong style="color:${recent.eloDelta >= 0 ? 'var(--fav)' : 'var(--crit)'};">${recent.eloDelta >= 0 ? '+' : ''}${recent.eloDelta}</strong>
      </div>
    `;
    if (recent.eloSeries.length > 1) {
      const sp = sparkline(recent.eloSeries);
      sp.style.display = 'block';
      sp.style.marginTop = '12px';
      f.appendChild(sp);
    }
    wrap.appendChild(f);
  }

  return wrap;
}

function buildOpeningsPane(opByColor, traps, oppName) {
  const wrap = el('div', { class: 'cross-section' });

  ['white', 'black'].forEach(color => {
    const block = el('div', { class: 'cross-block' });
    block.innerHTML = `<div class="cross-block-head">${color === 'white' ? '⬜ EN BLANC' : '⬛ EN NOIR'}</div>`;
    const list = opByColor[color].slice(0, 8);
    if (!list.length) {
      block.appendChild(el('div', { class: 'dim' }, 'Pas de données.'));
    } else {
      const tbl = el('table', { class: 'op-table' });
      tbl.innerHTML = `<thead><tr><th>OUVERTURE</th><th>FRÉQ</th><th>WIN%</th></tr></thead>`;
      const tbody = el('tbody');
      list.forEach(o => {
        const tr = el('tr');
        const wrCls = o.winRate < 40 ? 'bar-l' : o.winRate >= 60 ? 'bar-w' : '';
        tr.innerHTML = `
          <td>
            <div class="op-name">${escapeHtml(o.name)}</div>
            <div class="op-eco">${o.eco || ''}</div>
          </td>
          <td>${o.count}</td>
          <td class="bar-cell">
            <div style="font-size:13px;font-weight:600;">${o.winRate}%</div>
            <div class="bar-bg"><div class="bar-fill ${wrCls}" style="width:${Math.min(100,o.winRate)}%"></div></div>
          </td>
        `;
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      block.appendChild(tbl);
    }
    wrap.appendChild(block);
  });

  // Pièges
  if (traps.length) {
    const trapBlock = el('div', { class: 'cross-block', style: 'grid-column:1/-1;margin-top:8px;' });
    trapBlock.innerHTML = `<div class="cross-block-head">🪤 OUVERTURES OÙ ${oppName.toUpperCase()} STRUGGLE</div>`;
    const tbl = el('table', { class: 'op-table' });
    tbl.innerHTML = `<thead><tr><th>OUVERTURE</th><th>COULEUR</th><th>FRÉQ</th><th>WIN%</th></tr></thead>`;
    const tbody = el('tbody');
    traps.forEach(t => {
      tbody.innerHTML += `
        <tr>
          <td><div class="op-name">${escapeHtml(t.name)}</div><div class="op-eco">${t.eco || ''}</div></td>
          <td>${t.color === 'white' ? '⬜' : '⬛'}</td>
          <td>${t.count}</td>
          <td><span class="badge b-crit">${t.winRate}%</span></td>
        </tr>
      `;
    });
    tbl.appendChild(tbody);
    trapBlock.appendChild(tbl);
    wrap.appendChild(trapBlock);
  }

  return wrap;
}

function buildCrossPane(cross, myP, oppP) {
  const wrap = el('div');
  const intro = el('div', { class: 'form-card' });
  intro.innerHTML = `
    <div class="cross-block-head">🎯 CROISEMENT DES RÉPERTOIRES</div>
    <p style="font-size:13px;color:var(--dim);">
      Comment <strong>${myP.name}</strong> a performé contre les ouvertures que joue souvent <strong>${oppP.name}</strong>.
      <span class="gold">Critique</span> = à éviter ou bien préparer.
    </p>
  `;
  wrap.appendChild(intro);

  const grid = el('div', { class: 'cross-section mt-16' });
  ['white', 'black'].forEach(c => {
    const block = el('div', { class: 'cross-block' });
    block.innerHTML = `<div class="cross-block-head">
      TU JOUERAS ${c === 'white' ? '⬜ BLANC' : '⬛ NOIR'} CONTRE
      <span class="dim" style="font-size:11px;">(SES OUVERTURES EN ${c === 'white' ? 'NOIR' : 'BLANC'})</span>
    </div>`;
    const list = cross[c];
    if (!list.length) {
      block.appendChild(el('div', { class: 'dim' }, 'Pas assez de données.'));
    } else {
      const tbl = el('table', { class: 'op-table' });
      tbl.innerHTML = `<thead><tr><th>OUVERTURE</th><th>SA FRÉQ</th><th>TON BILAN</th><th>VERDICT</th></tr></thead>`;
      const tbody = el('tbody');
      list.forEach(c => {
        const danger = Analyzer.dangerScore(c);
        tbody.innerHTML += `
          <tr>
            <td><div class="op-name">${escapeHtml(c.opening)}</div><div class="op-eco">${c.eco || ''}</div></td>
            <td>${c.opponentFreq} parties (${c.opponentWR}%)</td>
            <td>
              <div style="font-weight:600;font-size:13px;">${c.myGames > 0 ? c.myWinRate + '%' : '—'}</div>
              <div class="dim" style="font-size:11px;">${c.myGames} parties</div>
            </td>
            <td>${dangerBadge(danger).outerHTML}</td>
          </tr>
        `;
      });
      tbl.appendChild(tbody);
      block.appendChild(tbl);
    }
    grid.appendChild(block);
  });
  wrap.appendChild(grid);
  return wrap;
}

function buildFormPane(recent, heat, oppP) {
  const wrap = el('div');

  // Last games
  const lg = el('div', { class: 'form-card' });
  lg.innerHTML = `<div class="cross-block-head">10 DERNIÈRES PARTIES</div>`;
  const list = el('div', { class: 'last-games' });
  if (!recent.lastGames.length) {
    list.appendChild(el('div', { class: 'dim' }, 'Pas de parties.'));
  } else {
    recent.lastGames.forEach(g => {
      const row = el('div', { class: 'lg-row ' + g.result });
      row.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--dim);">${g.date || ''}</div>
        <div class="lg-color ${g.color}"></div>
        <div>
          <div class="lg-opp">${g.opponent || ''} <span class="dim">${g.opponentElo || ''}</span></div>
          <div class="lg-opening">${escapeHtml(g.opening || '')}</div>
        </div>
        <div class="lg-result ${g.result}">${g.result}</div>
        <div><a class="dim" href="${g.url}" target="_blank" rel="noopener" style="font-size:11px;">↗</a></div>
      `;
      list.appendChild(row);
    });
  }
  lg.appendChild(list);
  wrap.appendChild(lg);

  // Heatmap par jour
  const days = el('div', { class: 'form-card mt-16' });
  days.innerHTML = `<div class="cross-block-head">PERFORMANCE PAR JOUR</div>`;
  const heatRow = el('div', { class: 'heat-row' });
  heat.byDay.forEach(d => {
    const cell = el('div', { class: 'heat-cell' });
    cell.innerHTML = `
      <div style="font-size:9px;letter-spacing:.2em;">${d.day.toUpperCase()}</div>
      <div class="heat-val">${d.winRate !== null ? d.winRate + '%' : '—'}</div>
      <div style="font-size:9px;color:var(--dim-2);">${d.total} parties</div>
    `;
    heatRow.appendChild(cell);
  });
  days.appendChild(heatRow);
  wrap.appendChild(days);

  return wrap;
}

function buildH2HPane(h2h, myP, oppP) {
  const wrap = el('div');
  const block = el('div', { class: 'form-card' });
  block.innerHTML = `
    <div class="cross-block-head">FACE À FACE — ${myP.name} vs ${oppP.name}</div>
  `;
  if (!h2h.length) {
    block.appendChild(el('p', { class: 'dim', style: 'font-size:13px;margin-top:8px;' },
      'Aucune partie commune trouvée sur les 12 derniers mois (chess.com).'));
  } else {
    let w = 0, l = 0, d = 0;
    h2h.forEach(g => {
      const r = Analyzer.getMyResult(g, myP.handle);
      if (r === 'win') w++;
      else if (Analyzer.getColor(g, myP.handle) && ['agreed','repetition','stalemate','insufficient','50move'].includes(r)) d++;
      else l++;
    });
    const total = w + l + d;
    const stats = el('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:8px;' });
    stats.innerHTML = `
      <div><div class="stat-label">TOTAL</div><div class="stat-value">${total}</div></div>
      <div><div class="stat-label">VICTOIRES</div><div class="stat-value" style="color:var(--fav)">${w}</div></div>
      <div><div class="stat-label">NULS</div><div class="stat-value">${d}</div></div>
      <div><div class="stat-label">DÉFAITES</div><div class="stat-value" style="color:var(--crit)">${l}</div></div>
    `;
    block.appendChild(stats);

    const list = el('div', { class: 'last-games mt-16' });
    h2h.slice(-10).reverse().forEach(g => {
      const r = Analyzer.getMyResult(g, myP.handle);
      const c = Analyzer.getColor(g, myP.handle);
      const result = r === 'win' ? 'W' : ['agreed','repetition','stalemate','insufficient','50move'].includes(r) ? 'D' : 'L';
      const row = el('div', { class: 'lg-row ' + result });
      const date = g.end_time ? new Date(g.end_time*1000).toISOString().slice(0,10) : '';
      row.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--dim);">${date}</div>
        <div class="lg-color ${c}"></div>
        <div>
          <div class="lg-opp">${g.time_class}</div>
          <div class="lg-opening">${escapeHtml(Analyzer.extractOpeningFromPGN(g.pgn)?.name || '')}</div>
        </div>
        <div class="lg-result ${result}">${result}</div>
        <div><a class="dim" href="${g.url}" target="_blank" rel="noopener" style="font-size:11px;">↗</a></div>
      `;
      list.appendChild(row);
    });
    block.appendChild(list);
  }
  wrap.appendChild(block);
  return wrap;
}

function buildNotesPane(oppP) {
  const wrap = el('div');

  const block = el('div', { class: 'form-card' });
  block.innerHTML = `
    <div class="cross-block-head">📓 NOTES SUR ${oppP.name.toUpperCase()}</div>
    <p style="font-size:12px;color:var(--dim);">
      Notes partagées par l'équipe. Stockées localement (localStorage). Exporte régulièrement pour partage.
    </p>
  `;

  // Auteur
  const authorRow = el('div', { class: 'note-form mt-16' });
  authorRow.innerHTML = `
    <input type="text" class="input" placeholder="Ton pseudo (ex: IvoireChess)" id="noteAuthor" value="${Notes.getAuthor()}">
    <textarea class="textarea" id="noteText" placeholder="Ex: Il flag dans les finales tour-pion. Joue Bird's à coup sûr en blitz contre les ELO 1800-..."></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn primary" id="addNoteBtn">+ AJOUTER LA NOTE</button>
      <button class="btn" id="exportNotesBtn">⬇ EXPORTER TOUTES LES NOTES</button>
      <label class="btn" style="cursor:pointer;">
        ⬆ IMPORTER
        <input type="file" id="importNotesFile" accept="application/json" hidden>
      </label>
    </div>
  `;
  block.appendChild(authorRow);

  const listEl = el('div', { class: 'notes-list' });
  block.appendChild(listEl);
  wrap.appendChild(block);

  function refreshNotes() {
    clear(listEl);
    const notes = Notes.list(oppP.handle);
    if (!notes.length) {
      listEl.appendChild(el('div', { class: 'dim', style: 'font-size:13px;' }, 'Aucune note pour le moment.'));
    } else {
      notes.forEach(n => {
        const noteEl = el('div', { class: 'note' });
        noteEl.innerHTML = `
          <div class="note-head">
            <div><span class="note-author">${escapeHtml(n.author)}</span></div>
            <div>${fmtDate(n.date)}</div>
          </div>
          <div class="note-text">${escapeHtml(n.text)}</div>
          <div class="note-actions">
            <button class="btn danger" data-id="${n.id}">SUPPRIMER</button>
          </div>
        `;
        noteEl.querySelector('.btn.danger').addEventListener('click', () => {
          if (confirm('Supprimer cette note ?')) {
            Notes.remove(oppP.handle, n.id);
            refreshNotes();
          }
        });
        listEl.appendChild(noteEl);
      });
    }
  }
  refreshNotes();

  setTimeout(() => {
    $('#addNoteBtn').addEventListener('click', () => {
      const author = $('#noteAuthor').value.trim();
      const text = $('#noteText').value.trim();
      if (!text) { toast('Tape une note avant d\'ajouter', 'error'); return; }
      Notes.setAuthor(author);
      Notes.add(oppP.handle, { text, author });
      $('#noteText').value = '';
      refreshNotes();
      toast('Note ajoutée', 'success');
    });
    $('#exportNotesBtn').addEventListener('click', () => {
      Notes.downloadExport();
      toast('Export téléchargé', 'success');
    });
    $('#importNotesFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const txt = await file.text();
        const data = JSON.parse(txt);
        const n = Notes.importAll(data);
        toast(`${n} notes importées`, 'success');
        refreshNotes();
      } catch (err) {
        toast('Fichier invalide', 'error');
      }
    });
  }, 50);

  return wrap;
}

function buildPlanPane(myP, oppP, board, oppOpenings, cross, colorReco, traps) {
  const wrap = el('div');

  const block = el('div', { class: 'form-card' });
  block.innerHTML = `
    <div class="cross-block-head">📋 PLAN DE BATAILLE</div>
    <p style="font-size:13px;color:var(--dim);">
      Synthèse heuristique basée sur les données collectées. Plan IA enrichi (Claude) à venir.
    </p>
  `;

  const recos = [];
  // 1. Couleur
  if (colorReco.suggestColor === 'white' || colorReco.suggestColor === 'black') {
    recos.push({
      title: '🎨 Joue ' + (colorReco.suggestColor === 'white' ? 'BLANC' : 'NOIR'),
      detail: colorReco.reason
    });
  }
  // 2. Ouvertures à favoriser (croisement favorable)
  const favWhite = cross.white.filter(c => c.myGames >= 3 && c.myWinRate >= 55);
  const favBlack = cross.black.filter(c => c.myGames >= 3 && c.myWinRate >= 55);
  if (favWhite.length) {
    recos.push({
      title: '✅ EN BLANC, vise vers',
      detail: favWhite.slice(0, 3).map(c => `${c.opening} (ton WR ${c.myWinRate}% sur ${c.myGames} parties)`).join(' · ')
    });
  }
  if (favBlack.length) {
    recos.push({
      title: '✅ EN NOIR, vise vers',
      detail: favBlack.slice(0, 3).map(c => `${c.opening} (ton WR ${c.myWinRate}% sur ${c.myGames} parties)`).join(' · ')
    });
  }
  // 3. Ouvertures à éviter (zones critiques)
  const dangerWhite = cross.white.filter(c => c.myGames >= 2 && c.myWinRate < 40);
  const dangerBlack = cross.black.filter(c => c.myGames >= 2 && c.myWinRate < 40);
  if (dangerWhite.length) {
    recos.push({
      title: '⚠️ EN BLANC, ÉVITE / RÉVISE',
      detail: dangerWhite.slice(0, 3).map(c => `${c.opening} (ton WR ${c.myWinRate}%)`).join(' · '),
      crit: true
    });
  }
  if (dangerBlack.length) {
    recos.push({
      title: '⚠️ EN NOIR, ÉVITE / RÉVISE',
      detail: dangerBlack.slice(0, 3).map(c => `${c.opening} (ton WR ${c.myWinRate}%)`).join(' · '),
      crit: true
    });
  }
  // 4. Pièges (ses faibles win rates)
  if (traps.length) {
    recos.push({
      title: '🎯 EXPLOITE SES FAIBLESSES',
      detail: traps.slice(0, 3).map(t => `${t.name} (${t.color === 'white' ? '⬜' : '⬛'}, son WR seulement ${t.winRate}% sur ${t.count})`).join(' · ')
    });
  }
  // 5. Capitaine ?
  if (board.board === 1) {
    recos.push({
      title: '★ ÉCHIQUIER 1 — DUEL DES CAPITAINES',
      detail: 'Ce duel rapporte 2 POINTS. À ne pas perdre. Prépare une ouverture solide en première intention.'
    });
  }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:14px;' });
  recos.forEach(r => {
    const item = el('div', {
      class: 'note',
      style: r.crit ? 'border-left-color:var(--crit)' : ''
    });
    item.innerHTML = `
      <div class="note-head">
        <div class="note-author">${r.title}</div>
      </div>
      <div class="note-text">${r.detail}</div>
    `;
    list.appendChild(item);
  });
  if (!recos.length) {
    list.appendChild(el('p', { class: 'dim' }, 'Pas assez de données pour générer un plan. Lance l\'analyse manuellement ou vérifie les pseudos.'));
  }
  block.appendChild(list);

  // Boutons d'action
  const actions = el('div', { class: 'controls-row mt-16' });
  actions.innerHTML = `
    <button class="btn" onclick="window.print()">🖨 IMPRIMER LE DOSSIER</button>
    <button class="btn" disabled style="opacity:.5">🤖 ANALYSE IA (Claude) — bientôt</button>
  `;
  block.appendChild(actions);

  wrap.appendChild(block);
  return wrap;
}

/* ============================================================
   SCOUT (vue analyse libre)
   ============================================================ */
function renderScout() {
  const root = $('#view-scout');
  clear(root);

  const hero = el('div', { class: 'hero' });
  hero.innerHTML = `
    <div class="hero-king">♔</div>
    <div class="hero-content">
      <span class="hero-tag">SCOUT LIBRE</span>
      <h1 class="hero-title">ANALYSE<br>UN JOUEUR</h1>
      <p class="hero-sub">
        Entre n'importe quel pseudo Chess.com pour récupérer son répertoire, sa forme et ses faiblesses en cadence rapide.
      </p>
    </div>
  `;
  root.appendChild(hero);

  // Form
  const form = el('div', { class: 'scout-form' });
  form.innerHTML = `
    <input type="text" class="input" id="scoutHandle" placeholder="Pseudo chess.com (ex: red_tetrix)">
    <select class="input" id="scoutMonths">
      <option value="3">3 derniers mois</option>
      <option value="6">6 derniers mois</option>
      <option value="12">12 derniers mois</option>
    </select>
    <button class="btn primary" id="scoutGo">ANALYSER →</button>
  `;
  root.appendChild(form);

  const out = el('div', { id: 'scoutOut' });
  root.appendChild(out);

  $('#scoutGo').addEventListener('click', async () => {
    const handle = $('#scoutHandle').value.trim();
    if (!handle) { toast('Entre un pseudo', 'error'); return; }
    const months = parseInt($('#scoutMonths').value, 10);
    clear(out);
    out.appendChild(skeleton(5));
    try {
      const [games, profile, stats] = await Promise.all([
        API.getRecentGames(handle, months, { timeClass: 'rapid' }).catch(() => []),
        API.getProfile(handle).catch(() => null),
        API.getStats(handle).catch(() => null)
      ]);
      clear(out);
      if (!games.length) {
        out.appendChild(el('p', { class: 'dim' }, 'Aucune partie trouvée. Vérifie le pseudo.'));
        return;
      }
      const overall = Analyzer.globalSummary(games, handle);
      const recent = Analyzer.recentForm(games, handle, 20);
      const ops = Analyzer.openingsByColor(games, handle);
      const traps = Analyzer.trapOpenings(games, handle, 3);

      const fakeP = { name: profile?.name || handle, handle };
      out.appendChild(buildOverviewPane(fakeP, fakeP, overall, recent, { suggestColor: 'either', reason: '' }, profile, stats, games.length, 0));

      const sec = el('div', { class: 'mt-24' });
      sec.appendChild(buildOpeningsPane(ops, traps, handle));
      out.appendChild(sec);
      toast(`${games.length} parties rapides analysées`, 'success');
    } catch (e) {
      clear(out);
      out.appendChild(el('p', { class: 'dim' }, 'Erreur : ' + e.message));
    }
  });
}

/* ============================================================
   ROSTER (vue mes joueurs et adversaires)
   ============================================================ */
function renderRoster() {
  const root = $('#view-roster');
  clear(root);

  const hero = el('div', { class: 'hero' });
  hero.innerHTML = `
    <div class="hero-king">♔</div>
    <div class="hero-content">
      <span class="hero-tag">ROSTER</span>
      <h1 class="hero-title">JOUEURS<br>DU CHAMPIONNAT</h1>
      <p class="hero-sub">
        Les 30 joueurs des 6 équipes. Clique sur un joueur pour ouvrir une fiche.
      </p>
    </div>
  `;
  root.appendChild(hero);

  // Mon équipe en premier
  const myT = TOURNAMENT.teams[TOURNAMENT.myTeamId];
  appendRosterSection(root, myT, '★ MON ÉQUIPE — ' + myT.name.toUpperCase(), true);

  // Autres équipes
  Object.values(TOURNAMENT.teams).forEach(t => {
    if (t.id === TOURNAMENT.myTeamId) return;
    appendRosterSection(root, t, t.name + ' · POULE ' + t.group);
  });
}

function appendRosterSection(root, team, label, isMine = false) {
  const sec = el('section', { class: 'section' });
  sec.innerHTML = `
    <div class="section-head">
      <div class="section-title">
        <div class="section-name" style="font-size:24px;">${label}</div>
      </div>
      <div class="section-meta">${fmtNum(team.totalElo)} ELO · ${team.players.length} joueurs</div>
    </div>
  `;
  const grid = el('div', { class: 'roster-grid' });
  team.players.forEach(p => {
    const isCap = p.name.toLowerCase() === team.captain.toLowerCase();
    const card = el('div', {
      class: 'roster-card',
      onclick: () => openPlayerScout(p)
    });
    card.innerHTML = `
      <div class="roster-avatar"><div class="roster-avatar-inner" data-handle="${p.handle}"><span class="av-initials">${initials(p.name)}</span></div></div>
      <div class="roster-info">
        <div class="roster-name">${p.name} ${isCap ? '<span class="gold" style="font-size:12px;">★</span>' : ''}</div>
        <div class="roster-meta">${isCap ? 'CAPITAINE' : 'JOUEUR'} · ${p.platform}</div>
      </div>
      <div class="roster-elo">${p.elo}</div>
    `;
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  root.appendChild(sec);

  setTimeout(() => {
    $$('.roster-avatar-inner', sec).forEach(a => loadAvatar(a, a.dataset.handle));
  }, 50);
}

function openPlayerScout(player) {
  // Pré-remplit le scout avec ce joueur
  window.location.hash = '#scout';
  setTimeout(() => {
    const input = $('#scoutHandle');
    if (input) {
      input.value = player.handle;
      $('#scoutGo').click();
    }
  }, 200);
}

/* ============================================================
   UTILS
   ============================================================ */
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================================================
   BOOT
   ============================================================ */
boot();
