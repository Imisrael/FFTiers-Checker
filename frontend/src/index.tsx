import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import PocketBase from 'pocketbase';


const pb = new PocketBase('http://127.0.0.1:8090');
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8 font-sans">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-green-400 mb-2">Fantasy Football Player Rankings</h1>
            <p className="text-gray-400">
              This component uses TanStack Query to fetch and display player data from a PocketBase backend.
            </p>
          </header>
          <PlayerRankings playerName="Travis Kelce" />
        </div>
      </div>
    </QueryClientProvider>
  );
}

// 3. The component that fetches and displays the data
function PlayerRankings({ playerName }) {
  // `useQuery` is the core hook from TanStack Query.
  // It manages fetching, caching, and state management.
  const { data, isLoading, isError, error } = useQuery({
    // `queryKey` is a unique identifier for this query.
    // TanStack Query uses it for caching.
    // It's an array, typically [queryName, dependency1, dependency2, ...]
    queryKey: ['playerRankings', playerName],

    // `queryFn` is the asynchronous function that fetches the data.
    // It MUST return a promise.
    queryFn: async () => {
      console.log(`Fetching rankings for ${playerName}...`);

      // Construct the filter using the dot-notation we figured out.
      // This finds rankings where the player's name matches AND the category is TE or Flex.
      //  const filter = `(player.name = '${playerName}' && (ranking_category.name = 'TE' || ranking_category.name = 'Flex'))`;

      // Fetch the data from the 'weekly_rankings' collection.
      const records = await pb.collection('weekly_rankings').getFullList({
        // filter: filter,
        // Don't forget to expand the relations to get the readable names!
        expand: 'player,ranking_category,format',
      });
      return records;
    },
    // Optional: staleTime sets how long data is considered "fresh" before refetching in the background.
    // staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <p className="text-lg text-gray-300 animate-pulse">Loading player data...</p>
      </div>
    );
  }

  // Render an error state
  if (isError) {
    return (
      <div className="p-8 bg-red-900/20 border border-red-500 text-red-300 rounded-lg">
        <h3 className="font-bold text-lg mb-2">Error Fetching Data</h3>
        <p className="font-mono bg-red-900/30 p-2 rounded">{error.message}</p>
      </div>
    );
  }

  // Render a "not found" state
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg">
        <p className="text-lg text-gray-300">No TE or Flex rankings found for "{playerName}".</p>
      </div>
    );
  }


  // Render the success state with the fetched data
  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-white">
        Rankings for <span className="text-green-400">{playerName}</span>
      </h2>
      <ul className="space-y-4">
        {data.map((ranking) => (
          <li key={ranking.id} className="bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="font-bold text-lg text-white">
                {ranking.expand.ranking_category.name}
              </span>
              <span className="text-sm text-gray-400 ml-2">
                ({ranking.expand.format.name} Format)
              </span>
              <p className="text-xs text-gray-500">
                Year: {ranking.year}, Week: {ranking.week}
              </p>
            </div>
            <div className="bg-green-500 text-green-900 font-bold py-1 px-3 rounded-full text-center">
              Tier {ranking.tier}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}