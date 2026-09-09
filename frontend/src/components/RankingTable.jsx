/* eslint-disable react/react-in-jsx-scope */
import { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "../styles/app.css"
import { TIER_COLORS } from "../utils/constants.js"
import { useTeams, togglePlayer, addTeam } from "../utils/teams.js"
import { useQuery } from '@tanstack/react-query';
import PocketBase from 'pocketbase';

import {
  ModuleRegistry,
  ValidationModule,
  ColumnAutoSizeModule,
  TextFilterModule,
  NumberFilterModule,
  QuickFilterModule,
  ClientSideRowModelModule,
  RowStyleModule
} from 'ag-grid-community';

ModuleRegistry.registerModules([
  ValidationModule,
  ColumnAutoSizeModule,
  TextFilterModule,
  NumberFilterModule,
  QuickFilterModule,
  ClientSideRowModelModule,
  RowStyleModule
]);

const pb = new PocketBase('https://fftiers.israelimru.com');
const COLLECTION = 'weekly_rankings';
const CURRENT_YEAR = new Date().getFullYear();
// Order positions appear in the dropdown. Anything not listed goes at the end.
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'Flex', 'K', 'DST'];
const FLEX = 'Flex';
const ALL = 'All'; // team view: every position except Flex, roster only

// Row backgrounds in team view (soft, one per position). Tweak to taste.
const POSITION_COLORS = {
  QB: '#fde68a',
  RB: '#bfdbfe',
  WR: '#bbf7d0',
  TE: '#fecaca',
  K: '#e9d5ff',
  DST: '#e2e8f0',
};
const positionColor = (name) => POSITION_COLORS[name] ?? '#f1f5f9';

// Tier as a small chip, used in team view where rows are colored by position
function TierChip({ value }) {
  if (!value) return null;
  return (
    <span
      style={{
        display: 'inline-block', minWidth: 22, textAlign: 'center',
        fontSize: '0.75rem', fontWeight: 700, lineHeight: 1,
        padding: '4px 6px', borderRadius: 6,
        background: TIER_COLORS[(value - 1) % TIER_COLORS.length],
        border: '1px solid rgba(15, 23, 42, 0.15)',
      }}
    >
      {value}
    </span>
  );
}
const DEFAULT_POSITION = 'RB';
const DEFAULT_FORMAT = 'Standard';

const selectClass = "w-full rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 pr-8 text-sm font-medium text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto appearance-none bg-no-repeat bg-right-1.5 bg-[length:1.2em_1.2em] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24%24%22 fill=%22%239ca3af%22><path d=%22M11.9997 13.1714L16.9495 8.22168L18.3637 9.63589L11.9997 15.9999L5.63574 9.63589L7.04996 8.22168L11.9997 13.1714Z%22></path></svg>')]";

const posOrder = (name) => {
  const i = POSITION_ORDER.indexOf(name);
  return i === -1 ? POSITION_ORDER.length : i;
};

// Tier movement badge. Bigger move = bigger, bolder chip.
function DeltaCell({ value, data }) {
  if (data?.isNew) {
    return (
      <span
        title="Not tiered last week"
        style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
          padding: '2px 7px', borderRadius: 999,
          background: '#dbeafe', color: '#1d4ed8',
        }}
      >
        NEW
      </span>
    );
  }
  if (!value) {
    return <span style={{ color: '#94a3b8', fontSize: '0.9rem', opacity: 0.6 }}>·</span>;
  }

  const up = value > 0;
  const mag = Math.min(Math.abs(value), 3);          // 1, 2, 3+
  const size = ['0.78rem', '0.9rem', '1.05rem'][mag - 1];
  const weight = [600, 700, 800][mag - 1];
  const bg = up
    ? ['#dcfce7', '#bbf7d0', '#86efac'][mag - 1]
    : ['#fee2e2', '#fecaca', '#fca5a5'][mag - 1];
  const fg = up ? '#15803d' : '#b91c1c';

  return (
    <span
      title={`${up ? 'Up' : 'Down'} ${Math.abs(value)} tier${Math.abs(value) === 1 ? '' : 's'}`}
      style={{
        fontSize: size, fontWeight: weight, lineHeight: 1,
        padding: '3px 8px', borderRadius: 999,
        background: bg, color: fg,
        display: 'inline-flex', alignItems: 'center', gap: 2,
      }}
    >
      {up ? '▲' : '▼'}{Math.abs(value)}
    </span>
  );
}

// Star toggle for the team this table has selected
function TeamCell({ data, context }) {
  const { teamId, onNeedTeam } = context;
  const onTeam = data?.onTeam;
  const others = data?.otherTeams ?? [];
  const title = onTeam
    ? 'Remove from this team'
    : others.length
      ? `Add to this team (also on: ${others.join(', ')})`
      : 'Add to this team';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!teamId) { onNeedTeam(data.player); return; }
        togglePlayer(teamId, data.player);
      }}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1,
        fontSize: '1rem', padding: 0,
        color: onTeam ? '#f59e0b' : others.length ? '#a16207' : '#cbd5e1',
        opacity: onTeam || !others.length ? 1 : 0.6,
      }}
    >
      {onTeam ? '★' : '☆'}
    </button>
  );
}

const pickValid = (wanted, list, fallback) => {
  if (list.includes(wanted)) return wanted;
  if (list.includes(fallback)) return fallback;
  return list[0];
};

/**
 * filters: { week?, format?, position? }  (undefined = use default)
 * onFiltersChange(patch): called when the user changes a dropdown
 * onCompare({ week, format, position }): asks the parent to open another table with these filters
 */
export default function RankingTable({ filters = {}, onFiltersChange, onDataLoaded, onCompare }) {

  const [search, setSearch] = useState('');
  const [mineOnlyState, setMineOnly] = useState(false);
  const teams = useTeams();
  const team = teams.find((t) => t.id === filters.team) ?? teams[0] ?? null;
  const teamId = team?.id ?? null;
  const rosterSet = useMemo(() => new Set(team?.players ?? []), [team]);

  // Clicking a star with no team yet: create one and add the player
  const onNeedTeam = useCallback((playerId) => {
    const name = prompt('No team yet. Name your team:');
    if (name === null) return;
    const id = addTeam(name);
    togglePlayer(id, playerId);
    onFiltersChange?.({ team: id });
  }, [onFiltersChange]);

  const defaultColDef = useMemo(() => ({ filter: true }), []);

  const { data: allRankings = [], isLoading, isError, error } = useQuery({
    queryKey: [COLLECTION, CURRENT_YEAR],
    queryFn: async () => {
      const records = await pb.collection(COLLECTION).getFullList({
        filter: `year = ${CURRENT_YEAR}`,
        expand: 'player,position,format',
      });
      const latestUpdated = records.reduce(
        (max, r) => (r.updated > max ? r.updated : max),
        ''
      );
      onDataLoaded?.(latestUpdated);
      return records;
    },
  });

  const availableFormats = useMemo(
    () => [...new Set(allRankings.map((r) => r.expand?.format?.name).filter(Boolean))],
    [allRankings]
  );
  const availablePositions = useMemo(
    () => [ALL, ...[...new Set(allRankings.map((r) => r.expand?.position?.name).filter(Boolean))]
      .sort((a, b) => posOrder(a) - posOrder(b))],
    [allRankings]
  );

  const format = pickValid(filters.format, availableFormats, DEFAULT_FORMAT);
  const position = pickValid(filters.position, availablePositions, DEFAULT_POSITION);
  const isFlex = position === FLEX;
  const isAll = position === ALL;

  // Which formats each position actually has data for
  const formatsByPosition = useMemo(() => {
    const m = new Map();
    for (const r of allRankings) {
      const p = r.expand?.position?.name, f = r.expand?.format?.name;
      if (!p || !f) continue;
      if (!m.has(p)) m.set(p, new Set());
      m.get(p).add(f);
    }
    return m;
  }, [allRankings]);

  // QB / K / DST only exist under Standard. If the chosen format has nothing for a
  // position, fall back to whatever format it does have instead of showing an empty grid.
  const effectiveFormatFor = useCallback(
    (pos) => pickValid(format, [...(formatsByPosition.get(pos) ?? [])], DEFAULT_FORMAT),
    [format, formatsByPosition]
  );
  const formatMatters = isAll || (formatsByPosition.get(position)?.size ?? 0) > 1;
  const mineOnly = isAll || mineOnlyState;

  // Rows for this view (any week): one position, or every non-Flex position in team view
  const comboRecords = useMemo(
    () => allRankings.filter((r) => {
      const p = r.expand?.position?.name;
      if (!p) return false;
      if (isAll ? p === FLEX : p !== position) return false;
      return r.expand?.format?.name === effectiveFormatFor(p);
    }),
    [allRankings, position, isAll, effectiveFormatFor]
  );

  // Weeks that actually have data for this combo (so a broken position shows what it really has)
  const availableWeeks = useMemo(
    () => [...new Set(comboRecords.map((r) => r.week))].sort((a, b) => a - b),
    [comboRecords]
  );
  const week = availableWeeks.includes(filters.week)
    ? filters.week
    : availableWeeks[availableWeeks.length - 1];
  const hasPrevWeek = availableWeeks.includes(week - 1);

  const { rows, tierStarts } = useMemo(() => {
    // Previous week's tier per player, for the movement column
    const prevTier = new Map();
    if (hasPrevWeek) {
      for (const r of comboRecords) {
        if (r.week === week - 1) prevTier.set(r.player, r.tier);
      }
    }

    const filtered = comboRecords
      .filter((r) => r.week === week)
      .sort((a, b) =>
        (posOrder(a.expand.position.name) - posOrder(b.expand.position.name)) ||
        (a.tier - b.tier) ||
        (a.positionRank - b.positionRank)
      )
      .map((r) => ({
        ...r,
        tierDelta: prevTier.has(r.player) ? prevTier.get(r.player) - r.tier : null,
        isNew: hasPrevWeek && !prevTier.has(r.player),
        onTeam: rosterSet.has(r.player),
        otherTeams: teams.filter((t) => t.id !== teamId && t.players.includes(r.player)).map((t) => t.name),
      }))
      .filter((r) => !mineOnly || r.onTeam);

    const starts = new Set();
    let lastKey = null;
    for (const r of filtered) {
      const key = isAll ? r.expand.position.name : `${r.expand.position.name}:${r.tier}`;
      if (key !== lastKey) {
        starts.add(r.id);
        lastKey = key;
      }
    }
    return { rows: filtered, tierStarts: starts };
  }, [comboRecords, week, hasPrevWeek, rosterSet, teams, teamId, mineOnly, isAll]);

  const colDefs = useMemo(() => {
    const cols = [
      {
        field: 'onTeam',
        headerName: '',
        maxWidth: 44,
        minWidth: 44,
        filter: false,
        sortable: false,
        resizable: false,
        cellRenderer: TeamCell,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
      },
      isAll
        ? {
          field: 'tier', maxWidth: 90,
          cellRenderer: TierChip,
          cellStyle: { display: 'flex', alignItems: 'center', padding: '0 8px' },
        }
        : { field: 'tier', maxWidth: 90 },
    ];
    if (hasPrevWeek) {
      cols.push({
        field: 'tierDelta',
        headerName: 'Δ',
        headerTooltip: `Tier movement vs week ${week - 1}`,
        maxWidth: 84,
        minWidth: 64,
        filter: false,
        cellRenderer: DeltaCell,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
      });
    }
    cols.push({ field: 'expand.player.name', headerName: 'Name', flex: 1, minWidth: 150 });
    if (isFlex || isAll) {
      cols.push({ field: 'expand.position.name', headerName: 'Pos', maxWidth: 100, minWidth: 70 });
    }
    cols.push({ field: 'positionRank', headerName: 'Pos Rank', maxWidth: 120, minWidth: 90 });
    return cols;
  }, [isFlex, isAll, hasPrevWeek, week]);

  const getRowId = useCallback((params) => params.data.id, []);

  const getRowStyle = useCallback((params) => {
    const tier = params.data?.tier;
    if (!tier) return undefined;
    const bg = isAll
      ? positionColor(params.data.expand?.position?.name)
      : TIER_COLORS[(tier - 1) % TIER_COLORS.length];
    return {
      backgroundColor: bg,
      borderTop: tierStarts.has(params.data.id) ? '2px solid #1e293b' : undefined,
      // roster bar is redundant in team view, everything shown is on the team
      boxShadow: !isAll && params.data.onTeam ? 'inset 4px 0 0 #f59e0b' : undefined,
      fontWeight: params.data.onTeam ? 600 : undefined,
    };
  }, [tierStarts, isAll]);

  const autoSizeStrategy = useMemo(() => ({
    type: "fitGridWidth",
    defaultMinWidth: 100,
  }), []);

  if (isLoading) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <p className="text-lg text-gray-300 animate-pulse">Loading player data...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 bg-red-900/20 border border-red-500 text-red-300 rounded-lg">
        <h3 className="font-bold text-lg mb-2">Error Fetching Data</h3>
        <p className="font-mono bg-red-900/30 p-2 rounded">{error.message}</p>
      </div>
    );
  }

  if (allRankings.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <p className="text-lg text-gray-300">No Data Found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex flex-col items-stretch space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4 mb-4 mt-4 flex-wrap shrink-0">
        <div className="flex items-center space-x-2">
          <label htmlFor="week-select" className="text-sm font-medium text-gray-300">Week</label>
          <select
            id="week-select"
            value={week ?? ''}
            onChange={(e) => onFiltersChange?.({ week: Number(e.target.value) })}
            className={selectClass}
          >
            {availableWeeks.map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label htmlFor="format-select" className="text-sm font-medium text-gray-300">Format</label>
          <select
            id="format-select"
            value={format ?? ''}
            onChange={(e) => onFiltersChange?.({ format: e.target.value })}
            disabled={!formatMatters}
            title={formatMatters ? undefined : `${position} tiers are the same for every format`}
            className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {availableFormats.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label htmlFor="position-select" className="text-sm font-medium text-gray-300">Position</label>
          <select
            id="position-select"
            value={position ?? ''}
            onChange={(e) => onFiltersChange?.({ position: e.target.value })}
            className={selectClass}
          >
            {availablePositions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <input
          type="search"
          placeholder="Search player"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-44"
        />

        <div className="flex items-center space-x-2">
          <label htmlFor="team-select" className="text-sm font-medium text-gray-300">Team</label>
          <select
            id="team-select"
            value={teamId ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new') {
                const name = prompt('Team name?');
                if (name !== null) onFiltersChange?.({ team: addTeam(name) });
                return;
              }
              onFiltersChange?.({ team: e.target.value });
            }}
            className={selectClass}
          >
            {teams.length === 0 && <option value="">No teams</option>}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__new">+ New team</option>
          </select>
        </div>

        <button
          onClick={() => setMineOnly((v) => !v)}
          disabled={!team || isAll}
          title={isAll ? 'Team view always shows only your roster' : mineOnly ? 'Show everyone' : team ? `Show only ${team.name}` : 'Pick a team first'}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${mineOnly ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
        >
          ★ {team ? team.name : 'Mine'}{rosterSet.size ? ` (${rosterSet.size})` : ''}
        </button>

        {onCompare && (
          <button
            onClick={() => onCompare({ week: week - 1, format, position, team: teamId ?? undefined })}
            disabled={!hasPrevWeek}
            title={hasPrevWeek ? `Open week ${week - 1} next to this one` : 'No previous week for this position'}
            className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            Compare wk {week - 1}
          </button>
        )}
      </div>

      {isAll && !team && (
        <p className="text-sm text-amber-400 mb-2">Pick or create a team to see it here.</p>
      )}
      <div className="flex-1 min-h-0">
        <AgGridReact
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          getRowStyle={getRowStyle}
          autoSizeStrategy={autoSizeStrategy}
          quickFilterText={search}
          context={{ teamId, onNeedTeam }}
        />
      </div>
    </div>
  );
}