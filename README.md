# ♔ ICC Strategy Hub

> **Team IvoireChess War Room** — Centre de préparation stratégique pour le Team Championship 2025-2026.

Une web-app statique (HTML / CSS / JS, zéro dépendance) qui permet à Team IvoireChess de scouter ses adversaires, analyser leurs répertoires, croiser avec son propre jeu, et générer un plan de bataille pour chaque échiquier de chaque rencontre.

---

## 🎯 Fonctionnalités V1

### Dashboard
- Vue d'ensemble du tournoi (stats équipe, calendrier des matchs restants)
- Carte du **prochain match** avec accès direct au Match Center

### Match Center (le coeur)
- Affiche les **5 échiquiers** d'un week-end, dans l'ordre 1 → 5
- Chaque échiquier ouvre un **dossier de prépa complet** :
  - **Vue d'ensemble** : profil rapide, ELO, recommandation de couleur
  - **Répertoire adverse** : ouvertures jouées en blanc / noir, win rates, pièges
  - **🎯 Croisement des répertoires** : *comment ton joueur a performé contre les ouvertures que joue l'adversaire* (le vrai game-changer)
  - **Forme récente** : 20 dernières parties, série en cours, ELO momentum, performance par jour
  - **Head-to-head** : parties communes des 12 derniers mois entre les 2 joueurs
  - **Notes d'équipe** : annotations collaboratives (avec export/import JSON)
  - **Plan de bataille** : synthèse heuristique des recommandations

### Scout libre
- Entre n'importe quel pseudo Chess.com → analyse complète du répertoire et de la forme

### Roster
- Les 30 joueurs du tournoi, organisés par équipe
- Click sur un joueur = scout instantané

---

## 📂 Structure

```
icc-strategy-hub/
├── index.html           # Point d'entrée
├── css/
│   └── styles.css       # DA premium (noir/or/orange)
├── js/
│   ├── app.js           # Vues + routing
│   ├── api.js           # Client Chess.com (proxy CORS) + Lichess + cache LS
│   ├── analyzer.js      # Calcul ouvertures, win rates, croisements
│   ├── notes.js         # Annotations équipe
│   └── ui.js            # Helpers UI (avatars, drawer, toast, ...)
└── data/
    └── tournament.json  # Source de vérité : équipes, calendrier, affrontements
```

**Source unique** : pour modifier un match, un joueur ou un ELO, édite uniquement `data/tournament.json`.

---

## 🚀 Lancement

### Option 1 — Direct (file://)
Ouvre `index.html` dans le navigateur. ⚠️ Le `fetch('./data/tournament.json')` peut être bloqué par certains navigateurs en `file://`. Si problème, voir option 2.

### Option 2 — Serveur local
```bash
cd icc-strategy-hub
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

### Option 3 — GitHub Pages (production)
1. Crée un repo `icc-strategy-hub` sur GitHub
2. Pousse tous les fichiers
3. Settings → Pages → Source : `main` / `/ (root)`
4. Le site est dispo sur `https://<user>.github.io/icc-strategy-hub/`

---

## 🌐 APIs utilisées

| Service | Usage | CORS |
|---|---|---|
| **Chess.com Public API** | Parties, profils, stats | ❌ bloqué → proxy `allorigins.win` |
| **Lichess API** | Profils, archives | ✅ direct |

> Les analyses sont mises en cache localStorage 24h pour économiser les appels API.

---

## 🛣 Roadmap

- [x] V1 — Match Center, Croisement, Notes, Forme, Heatmaps, H2H, Roster
- [ ] **Plan IA** : intégration Claude pour générer un plan de bataille narratif et lignes PGN à étudier
- [ ] **Stockfish.js** : analyse engine côté client (détection blunders récurrents)
- [ ] **Mode Live** : retransmission des 5 parties en cours pendant les matchs
- [ ] **Export PGN** : pack ouvertures à étudier, prêt pour Lichess Studies
- [ ] **PWA** : installable sur téléphone, fonctionne offline

---

## 🔐 Données

Toutes les données sensibles (notes, cache, préférences) sont stockées **uniquement dans le localStorage du navigateur**. Aucun backend, aucun serveur tiers ne reçoit tes infos. Pour partager les notes avec ton équipe : utilise les boutons **Exporter / Importer** dans l'onglet Notes.

---

## ⚖️ Licence

Usage interne Team IvoireChess. Code base sous MIT pour la partie technique.

---

*"La victoire appartient à celui qui est le mieux préparé."* — Sun Tzu
