import React from 'react';
import ReactDOM from 'react-dom/client'
import {
  QueryClient,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'


import RankingTable from './components/RankingTable';


export default function App() {
  const [lastUpdated, setLastUpdated] = React.useState("");


  const handleDataLoaded = (timestamp) => {
    if (timestamp) {
      // Format the date for display
      const formattedDate = new Date(timestamp).toLocaleString();
      setLastUpdated(formattedDate);
    }
  };

  const [tables, setTables] = React.useState([{ id: crypto.randomUUID() }]);

  // tables.push(tableMaking('weekly_rankings', 900, 900));
  // tables.push(tableMaking('big_board_rankings', 900, 900));

  // const [tableArr, setTableArr] = React.useState(tables)

  const addTable = () => setTables((prev) => [...prev, { id: crypto.randomUUID() }]);
  const removeTable = (id) => setTables((prev) => prev.filter((t) => t.id !== id));

  // const handleAddClick = () => {
  //   setTableArr([...tableArr, tableMaking('big_board_rankings', 900, 900)])
  // }
  const queryClient = new QueryClient();
  const persister = createAsyncStoragePersister({
    storage: window.localStorage,
  })
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="mx-5">
          <div>
            <h2 className="text-2xl font-bold text-blue-400 mb-2"> Draft Big Board Rankings</h2>
            {lastUpdated && <p>Last Updated: {lastUpdated}</p>}
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={addTable}>Add another Big Board Table</button>

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
                  <RankingTable type="big_board_rankings" onDataLoaded={handleDataLoaded} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PersistQueryClientProvider>
  );
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)
