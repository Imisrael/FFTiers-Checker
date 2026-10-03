/* eslint-disable react/react-in-jsx-scope */
import { useState } from 'react';
import {
  useTeams, addTeam, renameTeam, deleteTeam,
  shareUrl, encodeTeamsPayload, importTeamsPayload,
} from '../utils/teams.js';

// Small header strip for creating / renaming / deleting teams.
export default function TeamManager() {
  const teams = useTeams();
  const [notice, setNotice] = useState('');

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const onShare = async () => {
    if (!teams.length) return;
    const url = shareUrl();
    try {
      // navigator.share gives the phone the native sheet (AirDrop, messages, etc)
      if (navigator.share) {
        await navigator.share({ title: 'My fantasy teams', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('Link copied. Open it in the other browser.');
    } catch {
      // Clipboard blocked (or share cancelled): fall back to the raw code
      prompt('Copy this link:', url);
    }
  };

  const onImport = () => {
    const input = prompt('Paste a share link or code:');
    if (!input) return;
    const match = input.match(/import=([A-Za-z0-9\-_]+)/);
    const merged = importTeamsPayload(match ? match[1] : input.trim());
    flash(merged ? `Imported ${merged} team${merged === 1 ? '' : 's'}.` : "Couldn't read that link.");
  };

  const onAdd = () => {
    const name = prompt('Team name?');
    if (name !== null) addTeam(name);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 my-3">
      <span className="text-sm font-medium text-gray-300">Teams</span>
      {teams.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-md bg-slate-700 pl-3 pr-1 py-1 text-sm text-white"
        >
          <span>{t.name}</span>
          <span className="text-gray-400 text-xs">({t.players.length})</span>
          <button
            onClick={() => {
              const name = prompt('Rename team', t.name);
              if (name !== null) renameTeam(t.id, name);
            }}
            title="Rename"
            className="ml-1 px-1 text-gray-400 hover:text-white"
          >
            ✎
          </button>
          <button
            onClick={() => confirm(`Delete "${t.name}"?`) && deleteTeam(t.id)}
            title="Delete"
            className="px-1 text-gray-400 hover:text-red-400"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        onClick={onAdd}
        className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm font-medium text-white"
      >
        + Add team
      </button>

      <span className="mx-1 h-4 w-px bg-slate-600" />

      <button
        onClick={onShare}
        disabled={!teams.length}
        title="Copy a link that carries your teams to another browser"
        className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-1 text-sm font-medium text-white"
      >
        Share teams
      </button>
      <button
        onClick={onImport}
        title="Paste a share link from another device"
        className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm font-medium text-white"
      >
        Import
      </button>

      {notice && <span className="text-sm text-amber-400">{notice}</span>}
    </div>
  );
}