import React from 'react';
import ReactDOM from 'react-dom/client'
import {
  QueryClient,
  useQuery,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import PocketBase from 'pocketbase';

import RankingTable from './components/RankingTable';



export default function App() {
  const queryClient = new QueryClient();
  const persister = createAsyncStoragePersister({
    storage: window.localStorage,
  })
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-green-400 mb-2">Generic Title</h1>
          </header>
          <div style={{ height: 500 }}>
            <RankingTable playerName={'Derrick Henry'} />
          </div>

        </div>
      </div>
    </PersistQueryClientProvider>
  );
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)