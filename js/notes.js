/* ============================================================
   ICC Strategy Hub — Notes d'équipe (annotations sur adversaires)
   ============================================================
   Stockage localStorage clé "icc-notes:<handle>" → array de notes
   { id, author, text, date, tags }
   Export/import JSON pour partage WhatsApp ou backup.
   ============================================================ */

export const Notes = (() => {

  const PREFIX = 'icc-notes:';
  const AUTHOR_KEY = 'icc-author';

  function getAuthor() {
    return localStorage.getItem(AUTHOR_KEY) || '';
  }
  function setAuthor(name) {
    localStorage.setItem(AUTHOR_KEY, (name || '').trim());
  }

  function key(handle) {
    return PREFIX + (handle || '').toLowerCase();
  }

  function list(handle) {
    try { return JSON.parse(localStorage.getItem(key(handle)) || '[]'); }
    catch { return []; }
  }

  function add(handle, { text, tags = [], author }) {
    if (!text?.trim()) return null;
    const notes = list(handle);
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      author: author || getAuthor() || 'Anonyme',
      text: text.trim(),
      tags,
      date: new Date().toISOString()
    };
    notes.unshift(note);
    localStorage.setItem(key(handle), JSON.stringify(notes));
    return note;
  }

  function remove(handle, id) {
    const notes = list(handle).filter(n => n.id !== id);
    localStorage.setItem(key(handle), JSON.stringify(notes));
  }

  function update(handle, id, patch) {
    const notes = list(handle).map(n => n.id === id ? { ...n, ...patch } : n);
    localStorage.setItem(key(handle), JSON.stringify(notes));
  }

  /* ---------- Export / Import JSON ---------- */
  function exportAll() {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX)) {
        all[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
      }
    }
    return { exported: new Date().toISOString(), notes: all };
  }

  function importAll(payload) {
    if (!payload?.notes) return 0;
    let count = 0;
    for (const [handle, notes] of Object.entries(payload.notes)) {
      if (!Array.isArray(notes)) continue;
      const existing = list(handle);
      const existingIds = new Set(existing.map(n => n.id));
      const merged = [
        ...notes.filter(n => !existingIds.has(n.id)),
        ...existing
      ];
      localStorage.setItem(key(handle), JSON.stringify(merged));
      count += notes.length;
    }
    return count;
  }

  function downloadExport() {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icc-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { getAuthor, setAuthor, list, add, remove, update,
           exportAll, importAll, downloadExport };
})();
