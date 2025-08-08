import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';

import { useQuery } from '@tanstack/react-query';
import PocketBase from 'pocketbase';

import {
	ModuleRegistry,
	ValidationModule,
	ColumnAutoSizeModule,
	PinnedRowModule,
	PaginationModule,
	RowDragModule,
	TextFilterModule,
	NumberFilterModule,
	ClientSideRowModelModule,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
	ValidationModule,
	ColumnAutoSizeModule,
	PinnedRowModule,
	PaginationModule,
	RowDragModule,
	TextFilterModule,
	NumberFilterModule,
	ClientSideRowModelModule,
]);

export default function RankingTable({ playerName }) {

	const pb = new PocketBase('http://127.0.0.1:8090');

	const defaultColDef = useMemo(() => ({
		filter: true // Enable filtering on all columns
	}))

	const [colDefs, setColDefs] = useState([
		{ field: 'tier' },
		{ field: 'expand.format.name', headerName: 'Format' },
		{ field: 'expand.player.name', headerName: 'Name' },
		{ field: 'expand.ranking_category.name', headerName: 'Position' },
	]);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['playerRankings', playerName],
		queryFn: async () => {
			//const filter = `(player.name = '${playerName}' && (week = '0') && (ranking_category.name = 'RB' || ranking_category.name = 'Flex'))`;
			const filter = `(week = '0' && year = '2025')`;
			const records = await pb.collection('weekly_rankings').getFullList({
				filter: filter,
				// Don't forget to expand the relations to get the readable names!
				expand: 'player,ranking_category,format',
			});
			return records;
		},
	});

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

	if (!data || data.length === 0) {
		return (
			<div className="text-center p-8 bg-gray-800 rounded-lg">
				<p className="text-lg text-gray-300">No TE or Flex rankings found for "{playerName}".</p>
			</div>
		);
	}



	console.log(data)





	return (
		// <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
		//   <ul className="space-y-4">
		//     {data.map((ranking) => (
		//       <li key={ranking.id} className="bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
		//         <div>
		//           <span className="font-bold text-lg text-white">
		//             {ranking.expand.ranking_category.name}
		//           </span>
		//           <span className="text-sm text-gray-400 ml-2">
		//             ({ranking.expand.format.name} Format)
		//           </span>
		//           <p className="text-xs text-gray-500">
		//             Year: {ranking.year}, Week: {ranking.week}
		//           </p>
		//         </div>
		//         <div className="bg-green-500 text-green-900 font-bold py-1 px-3 rounded-full text-center">
		//           Tier {ranking.tier}
		//         </div>
		//       </li>
		//     ))}
		//   </ul>
		// </div>

		<>
			<AgGridReact
				rowData={data}
				columnDefs={colDefs}
				defaultColDef={defaultColDef}
			/>
		</>
	);
}