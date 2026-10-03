// Named fantasy teams, each a list of player names (the Convex rows have no
// stable player id; names are the key). Persisted to localStorage.
// Any component can subscribe via useTeams(); all open tables stay in sync.
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fftiers:teams';
const LEGACY_KEY = 'fftiers:myTeam';

const shortId = () => Math.random().toString(36).slice(2, 8);

let teams = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate the old single-roster format if it exists
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const players = JSON.parse(legacy);
      if (players.length) return [{ id: shortId(), name: 'My Team', players }];
    }
  } catch { /* ignore */ }
  return [];
}

function commit(next) {
  teams = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(teams)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function addTeam(name) {
  const team = { id: shortId(), name: name.trim() || `Team ${teams.length + 1}`, players: [] };
  commit([...teams, team]);
  return team.id;
}

export function renameTeam(id, name) {
  commit(teams.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)));
}

export function deleteTeam(id) {
  commit(teams.filter((t) => t.id !== id));
}

export function togglePlayer(teamId, playerId) {
  commit(teams.map((t) => {
    if (t.id !== teamId) return t;
    const has = t.players.includes(playerId);
    return { ...t, players: has ? t.players.filter((p) => p !== playerId) : [...t.players, playerId] };
  }));
}

// --- Sharing ------------------------------------------------------------
// Teams are packed into the URL hash as base64url(JSON). A couple of full
// rosters is under a kilobyte, well inside URL limits.

const b64urlEncode = (str) =>
  btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (str) =>
  decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));

// Compact shape: [[name, [playerIds]], ...]
export function encodeTeamsPayload(list = teams) {
  return b64urlEncode(JSON.stringify(list.map((t) => [t.name, t.players])));
}

export function shareUrl(list = teams) {
  const url = new URL(window.location.href);
  url.hash = `import=${encodeTeamsPayload(list)}`;
  return url.toString();
}

/**
 * Merge shared teams into local storage. A team with a matching name is updated
 * (union of players) rather than duplicated. Returns the number of teams merged.
 */
export function importTeamsPayload(payload) {
  let incoming;
  try {
    incoming = JSON.parse(b64urlDecode(payload));
  } catch {
    return 0;
  }
  if (!Array.isArray(incoming)) return 0;

  const next = [...teams];
  let merged = 0;
  for (const entry of incoming) {
    const [name, players] = Array.isArray(entry) ? entry : [];
    if (typeof name !== 'string' || !Array.isArray(players)) continue;
    const i = next.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
    if (i === -1) {
      next.push({ id: shortId(), name, players: [...new Set(players)] });
    } else {
      next[i] = { ...next[i], players: [...new Set([...next[i].players, ...players])] };
    }
    merged++;
  }
  if (merged) commit(next);
  return merged;
}

/** Reads ?/#import= from the current URL, merges it, and strips it from the address bar. */
export function consumeImportFromUrl() {
  const hash = window.location.hash.replace(/^#/, '');
  const fromHash = new URLSearchParams(hash).get('import');
  const fromQuery = new URLSearchParams(window.location.search).get('import');
  const payload = fromHash || fromQuery;
  if (!payload) return 0;

  const merged = importTeamsPayload(payload);

  const url = new URL(window.location.href);
  url.searchParams.delete('import');
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  params.delete('import');
  url.hash = params.toString();
  window.history.replaceState(null, '', url);

  return merged;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTeams() {
  return useSyncExternalStore(subscribe, () => teams);
}