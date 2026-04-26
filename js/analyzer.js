/* ============================================================
   ICC Strategy Hub — Analyse des parties chess.com
   ============================================================
   Entrée : tableau de parties chess.com format API
   Sorties : répertoires d'ouvertures, win rates, forme récente,
   patterns de tilt, head-to-head, etc.
   ============================================================ */

export const Analyzer = (() => {

  /* ---------- Helpers ---------- */
  function isWin(result) { return result === 'win'; }
  function isDraw(result) {
    return ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(result);
  }
  function getMyResult(g, handle) {
    const lh = handle.toLowerCase();
    const isWhite = (g.white?.username || '').toLowerCase() === lh;
    return isWhite ? g.white?.result : g.black?.result;
  }
  function getColor(g, handle) {
    const lh = handle.toLowerCase();
    return (g.white?.username || '').toLowerCase() === lh ? 'white' : 'black';
  }
  function getOpponent(g, handle) {
    const lh = handle.toLowerCase();
    return (g.white?.username || '').toLowerCase() === lh ? g.black : g.white;
  }

  /* ---------- Extraction d'ouverture depuis PGN ---------- */
  function extractOpeningFromPGN(pgn) {
    if (!pgn) return null;
    // Chess.com inclut souvent [ECO "..."] et [ECOUrl "..."] dans le PGN
    const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/);
    const ecoUrlMatch = pgn.match(/\[ECOUrl\s+"([^"]+)"\]/);
    const opening = ecoUrlMatch
      ? decodeURIComponent(ecoUrlMatch[1].split('/').pop().replace(/-/g, ' '))
      : null;
    return {
      eco: ecoMatch?.[1] || null,
      name: opening || null
    };
  }

  /* ---------- Extraction des coups (notation longue) ---------- */
  function extractMovesFromPGN(pgn, maxPly = 12) {
    if (!pgn) return [];
    // Retire les en-têtes
    const body = pgn.replace(/\[.*?\]\s*\n?/g, '').trim();
    // Capture les coups SAN
    const tokens = body.split(/\s+/);
    const moves = [];
    for (const t of tokens) {
      if (!t) continue;
      if (/^\d+\./.test(t)) continue; // numéros
      if (['1-0','0-1','1/2-1/2','*'].includes(t)) break;
      if (/[a-h]/.test(t) || /^[KQRBN]/.test(t) || /^O-O/.test(t)) {
        moves.push(t);
        if (moves.length >= maxPly) break;
      }
    }
    return moves;
  }

  /* ---------- Bilan global ---------- */
  function globalSummary(games, handle) {
    let w=0, l=0, d=0;
    let wW=0, wL=0, wD=0, bW=0, bL=0, bD=0;
    games.forEach(g => {
      const r = getMyResult(g, handle);
      const c = getColor(g, handle);
      if (isWin(r)) { w++; c === 'white' ? wW++ : bW++; }
      else if (isDraw(r)) { d++; c === 'white' ? wD++ : bD++; }
      else { l++; c === 'white' ? wL++ : bL++; }
    });
    const total = w + l + d;
    return {
      total, wins: w, losses: l, draws: d,
      winRate: total ? Math.round((w / total) * 1000) / 10 : 0,
      drawRate: total ? Math.round((d / total) * 1000) / 10 : 0,
      lossRate: total ? Math.round((l / total) * 1000) / 10 : 0,
      asWhite: { games: wW+wL+wD, wins: wW, losses: wL, draws: wD,
                 winRate: (wW+wL+wD) ? Math.round((wW/(wW+wL+wD))*1000)/10 : 0 },
      asBlack: { games: bW+bL+bD, wins: bW, losses: bL, draws: bD,
                 winRate: (bW+bL+bD) ? Math.round((bW/(bW+bL+bD))*1000)/10 : 0 }
    };
  }

  /* ---------- Répertoire d'ouvertures par couleur ---------- */
  function openingsByColor(games, handle) {
    const result = { white: {}, black: {} };
    games.forEach(g => {
      const op = extractOpeningFromPGN(g.pgn);
      if (!op || !op.name) return;
      const c = getColor(g, handle);
      const r = getMyResult(g, handle);
      const bucket = result[c];
      const key = op.name;
      if (!bucket[key]) bucket[key] = { name: key, eco: op.eco, count: 0, w: 0, l: 0, d: 0 };
      bucket[key].count++;
      if (isWin(r)) bucket[key].w++;
      else if (isDraw(r)) bucket[key].d++;
      else bucket[key].l++;
    });
    // Calcul win-rate et tri par fréquence
    for (const c of ['white', 'black']) {
      result[c] = Object.values(result[c]).map(o => ({
        ...o,
        winRate: o.count ? Math.round((o.w / o.count) * 1000) / 10 : 0,
        drawRate: o.count ? Math.round((o.d / o.count) * 1000) / 10 : 0
      })).sort((a, b) => b.count - a.count);
    }
    return result;
  }

  /* ---------- Ouvertures pièges (mauvais résultats) ---------- */
  function trapOpenings(games, handle, minGames = 3) {
    const ops = openingsByColor(games, handle);
    const all = [...ops.white.map(o => ({...o, color: 'white'})),
                 ...ops.black.map(o => ({...o, color: 'black'}))];
    return all
      .filter(o => o.count >= minGames && o.winRate < 40)
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 10);
  }

  /* ---------- Forme récente (rolling 20) ---------- */
  function recentForm(games, handle, windowSize = 20) {
    const sorted = [...games].sort((a, b) => (b.end_time||0) - (a.end_time||0));
    const recent = sorted.slice(0, windowSize);
    const summary = globalSummary(recent, handle);
    // Détection de séries
    let currentStreak = 0, streakType = null;
    for (const g of recent) {
      const r = getMyResult(g, handle);
      const t = isWin(r) ? 'W' : isDraw(r) ? 'D' : 'L';
      if (streakType === null) { streakType = t; currentStreak = 1; }
      else if (t === streakType) currentStreak++;
      else break;
    }
    // ELO momentum (chess.com inclut white.rating / black.rating)
    const eloPoints = recent.slice().reverse().map(g => {
      const c = getColor(g, handle);
      return c === 'white' ? g.white?.rating : g.black?.rating;
    }).filter(x => x);
    const eloDelta = eloPoints.length >= 2 ? eloPoints[eloPoints.length-1] - eloPoints[0] : 0;

    return {
      windowSize: recent.length,
      ...summary,
      streak: { type: streakType, length: currentStreak },
      eloDelta,
      eloSeries: eloPoints,
      lastGames: recent.slice(0, 10).map(g => ({
        date: g.end_time ? new Date(g.end_time * 1000).toISOString().slice(0, 10) : null,
        color: getColor(g, handle),
        opponent: getOpponent(g, handle)?.username,
        opponentElo: getOpponent(g, handle)?.rating,
        result: isWin(getMyResult(g, handle)) ? 'W' :
                isDraw(getMyResult(g, handle)) ? 'D' : 'L',
        opening: extractOpeningFromPGN(g.pgn)?.name,
        url: g.url,
        timeClass: g.time_class
      }))
    };
  }

  /* ---------- Heatmap : performance par jour de la semaine et heure ---------- */
  function timePerformance(games, handle) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const byDay = {};
    const byHour = {};
    games.forEach(g => {
      if (!g.end_time) return;
      const d = new Date(g.end_time * 1000);
      const day = days[d.getDay()];
      const hour = d.getHours();
      const r = getMyResult(g, handle);
      const w = isWin(r) ? 1 : 0;
      const total = 1;
      byDay[day] = byDay[day] || { day, w: 0, total: 0 };
      byDay[day].w += w; byDay[day].total += total;
      byHour[hour] = byHour[hour] || { hour, w: 0, total: 0 };
      byHour[hour].w += w; byHour[hour].total += total;
    });
    return {
      byDay: days.map(d => byDay[d] || { day: d, w: 0, total: 0 })
        .map(o => ({ ...o, winRate: o.total ? Math.round((o.w/o.total)*1000)/10 : null })),
      byHour: Array.from({length: 24}, (_, h) => byHour[h] || { hour: h, w: 0, total: 0 })
        .map(o => ({ ...o, winRate: o.total ? Math.round((o.w/o.total)*1000)/10 : null }))
    };
  }

  /* ---------- Cadence moyenne / blitz vs rapid ---------- */
  function timeClassDistribution(games) {
    const dist = {};
    games.forEach(g => {
      const tc = g.time_class || 'unknown';
      dist[tc] = (dist[tc] || 0) + 1;
    });
    return dist;
  }

  /* ---------- Croisement des répertoires (game-changer) ---------- */
  /**
   * Renvoie ce que TON joueur a comme expérience contre les ouvertures
   * que l'ADVERSAIRE joue souvent.
   * - opponentOpenings : les top ouvertures de l'adversaire (résultat de openingsByColor)
   * - myGames : tes propres parties
   * - myHandle : ton pseudo
   * - opponentColor : couleur dans laquelle l'adversaire joue ces ouvertures
   *   (s'il joue souvent Caro-Kann en NOIR, tu joueras BLANC contre)
   */
  function crossRepertoire(myGames, myHandle, opponentOpeningsByColor) {
    const cross = { white: [], black: [] };

    // Si l'adversaire joue X en NOIR, tu joueras BLANC contre X
    // Donc on cherche tes parties EN BLANC contre cette ouverture
    const myAsWhite = myGames.filter(g => getColor(g, myHandle) === 'white');
    const myAsBlack = myGames.filter(g => getColor(g, myHandle) === 'black');

    function lookupMyExperience(opening, myGamesPool) {
      const matching = myGamesPool.filter(g => {
        const op = extractOpeningFromPGN(g.pgn);
        return op?.name === opening.name;
      });
      const sub = globalSummary(matching, myHandle);
      return { opening: opening.name, eco: opening.eco,
               opponentFreq: opening.count, opponentWR: opening.winRate,
               myGames: sub.total, myWinRate: sub.winRate, myWins: sub.wins,
               myLosses: sub.losses, myDraws: sub.draws };
    }

    // Adversaire en BLANC = tu joues NOIR contre
    opponentOpeningsByColor.white.slice(0, 8).forEach(op => {
      cross.black.push(lookupMyExperience(op, myAsBlack));
    });
    // Adversaire en NOIR = tu joues BLANC contre
    opponentOpeningsByColor.black.slice(0, 8).forEach(op => {
      cross.white.push(lookupMyExperience(op, myAsWhite));
    });
    return cross;
  }

  /* ---------- Score de "danger" d'une ouverture pour toi ---------- */
  function dangerScore(crossEntry) {
    if (crossEntry.myGames === 0) return 'unknown';
    if (crossEntry.myWinRate < 35) return 'critical';
    if (crossEntry.myWinRate < 50) return 'risky';
    if (crossEntry.myWinRate >= 60) return 'favorable';
    return 'neutral';
  }

  /* ---------- Recommandation basique : couleur préférée ---------- */
  function colorRecommendation(myGames, opponentGames, myHandle, oppHandle) {
    const myStats = globalSummary(myGames, myHandle);
    const oppStats = globalSummary(opponentGames, oppHandle);
    const myWhiteAdvantage = myStats.asWhite.winRate - myStats.asBlack.winRate;
    const oppBlackWeakness = oppStats.asBlack.winRate < oppStats.asWhite.winRate;
    let suggestColor, reason;
    if (myWhiteAdvantage > 5 && oppBlackWeakness) {
      suggestColor = 'white';
      reason = `Tu performes ${myWhiteAdvantage.toFixed(1)}% mieux en blanc, et il est plus faible en noir.`;
    } else if (myWhiteAdvantage < -5) {
      suggestColor = 'black';
      reason = `Tu performes mieux en noir (${(-myWhiteAdvantage).toFixed(1)}% d'écart).`;
    } else {
      suggestColor = 'either';
      reason = 'Pas de couleur préférée nette.';
    }
    return { suggestColor, reason, myWhiteAdvantage };
  }

  return {
    extractOpeningFromPGN, extractMovesFromPGN,
    globalSummary, openingsByColor, trapOpenings,
    recentForm, timePerformance, timeClassDistribution,
    crossRepertoire, dangerScore, colorRecommendation,
    getMyResult, getColor, getOpponent
  };
})();
