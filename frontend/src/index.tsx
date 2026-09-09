import React from 'react';
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

import RankingTable from './components/RankingTable';
import TeamManager from './components/TeamManager';

// Create these once, not on every render, or every state change spins up a new client
const queryClient = new QueryClient();
const persister = createAsyncStoragePersister({
  storage: window.localStorage,
});

type TableFilters = { week?: number; format?: string; position?: string; team?: string };
type Table = TableFilters & { id: string };

const STORAGE_KEY = 'fftiers:tables';
const URL_PARAM = 't';

// URL / storage format: week_format_position_team per table, tables joined by "-"
// e.g. ?t=3_PPR_RB_k3x9ab-2_PPR_RB_k3x9ab   (empty segment = use the default)
const encodeTables = (tables: Table[]) =>
  tables.map((t) => [t.week ?? '', t.format ?? '', t.position ?? '', t.team ?? ''].join('_')).join('-');

const decodeTables = (str: string | null): Table[] =>
  (str ?? '')
    .split('-')
    .filter(Boolean)
    .map((seg) => {
      const [w, f, p, tm] = seg.split('_');
      return {
        id: crypto.randomUUID(),
        week: w ? Number(w) : undefined,
        format: f || undefined,
        position: p || undefined,
        team: tm || undefined,
      };
    });

function loadInitialTables(): Table[] {
  const fromUrl = decodeTables(new URLSearchParams(window.location.search).get(URL_PARAM));
  if (fromUrl.length) return fromUrl;
  try {
    const fromStorage = decodeTables(localStorage.getItem(STORAGE_KEY));
    if (fromStorage.length) return fromStorage;
  } catch { /* ignore */ }
  return [{ id: crypto.randomUUID() }];
}

export default function App() {
  const [lastUpdated, setLastUpdated] = React.useState("");
  const [tables, setTables] = React.useState<Table[]>(loadInitialTables);

  // Keep URL + localStorage in sync with the current tables
  React.useEffect(() => {
    const encoded = encodeTables(tables);
    try { localStorage.setItem(STORAGE_KEY, encoded); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, encoded);
    window.history.replaceState(null, '', url);
  }, [tables]);

  const handleDataLoaded = (timestamp: string) => {
    if (timestamp) setLastUpdated(new Date(timestamp).toLocaleString());
  };

  const addTable = () => setTables((prev) => [...prev, { id: crypto.randomUUID() }]);
  const removeTable = (id: string) => setTables((prev) => prev.filter((t) => t.id !== id));
  const updateFilters = (id: string, patch: TableFilters) =>
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  // Insert the comparison table right after the one that asked for it
  const compareTable = (id: string, filters: TableFilters) =>
    setTables((prev) => {
      const i = prev.findIndex((t) => t.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, { id: crypto.randomUUID(), ...filters });
      return next;
    });

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="mx-5">
          <h2 className="text-2xl font-bold text-blue-400 mb-2">Weekly Tier Rankings</h2>
          {lastUpdated && <p>Last Updated: {lastUpdated}</p>}
          <TeamManager />
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={addTable}
          >
            Add another table
          </button>

          <div
            className="w-full mx-auto grid gap-4"
            style={{
              maxWidth: tables.length === 1 ? '900px' : '100%',
              gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 560px), 1fr))`,
              gridAutoRows: 'minmax(0, calc(100vh - 220px))',
            }}
          >
            {tables.map((t) => (
              <div key={t.id} className="relative min-w-0 min-h-0 h-full">
                {tables.length > 1 && (
                  <button
                    onClick={() => removeTable(t.id)}
                    className="absolute -top-2 -right-2 z-10 rounded-full bg-red-600 hover:bg-red-500 text-white w-6 h-6 text-sm leading-none"
                    title="Remove this table"
                  >
                    ✕
                  </button>
                )}
                <RankingTable
                  filters={t}
                  onFiltersChange={(patch: TableFilters) => updateFilters(t.id, patch)}
                  onCompare={(filters: TableFilters) => compareTable(t.id, filters)}
                  onDataLoaded={handleDataLoaded}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PersistQueryClientProvider>
  );
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)