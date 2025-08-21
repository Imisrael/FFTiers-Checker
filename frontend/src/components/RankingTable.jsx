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

export default function RankingTable({ type }) {

	console.log("Type: ", type)

	const pb = new PocketBase('http://127.0.0.1:8090');

	const defaultColDef = useMemo(() => ({
		filter: true // Enable filtering on all columns
	}))

	const [colDefs, setColDefs] = useState([
		{ field: 'tier' },
		{ field: 'expand.format.name', headerName: 'Format' },
		{ field: 'expand.player.name', headerName: 'Name' },
		{ field: 'expand.position.name', headerName: 'Position' },
	]);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: [type],
		queryFn: async () => {
			//const filter = `(player.name = '${playerName}' && (week = '0') && (ranking_category.name = 'RB' || ranking_category.name = 'Flex'))`;
			//	const filter = `(week = '0' && year = '2025')`;
			const records = await pb.collection(type).getFullList({
				//		filter: filter,
				expand: 'player,position,format',
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
				<p className="text-lg text-gray-300">No TE or Flex rankings found .</p>
			</div>
		);
	}



	console.log(data)





	return (
		<>
			<AgGridReact
				rowData={data}
				columnDefs={colDefs}
				defaultColDef={defaultColDef}
			/>
		</>
	);
}