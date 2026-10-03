// Named fantasy teams, each a list of PocketBase player ids. Persisted to localStorage.
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

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useTeams() {
    return useSyncExternalStore(subscribe, () => teams);
}