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


const tableMaking = (type: string) => (
  <div className='h-3/4 w-64 my-8' style={{ height: 700, width: 1000 }}>
    <RankingTable type={type} />
  </div>
)

const addButton = () => {

}


export default function App() {
  const tableArr = [];
  tableArr.push(tableMaking('big_board_rankings'));
  tableArr.push(tableMaking('weekly_rankings'));
  const queryClient = new QueryClient();
  const persister = createAsyncStoragePersister({
    storage: window.localStorage,
  })
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-green-400 mb-2"></h1>
          </header>
          {tableArr.map((tab) => tab)}

        </div>
      </div>
    </PersistQueryClientProvider>
  );
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)