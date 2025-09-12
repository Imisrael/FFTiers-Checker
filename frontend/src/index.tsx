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


const tableMaking = (type: string, height: number, width: number) => (

  <div className='my-4 mx-2' style={{ height, width }}>
    <RankingTable type={type} height={height} width={width} onDataLoaded={handleDataLoaded}/>
  </div>
)

  const tables = [];
  tables.push(tableMaking('weekly_rankings', 900, 900));

  const [tableArr, setTableArr] = React.useState(tables)

  const handleAddClick = () => {
    setTableArr([...tableArr, tableMaking('weekly_rankings', 900, 900)])
  }
  const queryClient = new QueryClient();
  const persister = createAsyncStoragePersister({
    storage: window.localStorage,
  })
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="mx-5">
          <div>
            <h2 className="text-2xl font-bold text-blue-400 mb-2"> Weekly Rankings</h2>
{lastUpdated && <p>Last Updated: {lastUpdated}</p>}
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleAddClick}>Add A table!</button>
            <div className='flex flex-row flex-wrap'>

              {tableArr.map((tab) => tab)}
            </div>
          </div>
        </div>
      </div>
    </PersistQueryClientProvider>
  );
}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)
