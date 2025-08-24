import { useMemo, useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "../styles/app.css"
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
	RowStyleModule
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
	RowStyleModule
]);

const pb = new PocketBase('http://127.0.0.1:8090');

export default function RankingTable({ type }) {

	const defaultColDef = useMemo(() => ({
		filter: true // Enable filtering on all columns
	}))


	const colDefs = useMemo(() => {
		const rankingHeader = type === "weekly_rankings" ? 'positionRank' : 'overallRanking';


		return [
			{ field: 'tier', maxWidth: 100 },
			{ field: 'expand.player.name', headerName: 'Name', },
			{ field: 'expand.position.name', headerName: 'Position', maxWidth: 150, minWidth: 60 },
			{ field: 'expand.format.name', headerName: 'Format', },

			{ field: rankingHeader, headerName: 'Ranking', maxWidth: 200, minWidth: 60  },
		];
	}, [type]); // Dependency array ensures this runs when 'type' changes.

	const rowClassRules = useMemo(() => {
		return {
			'tier-1': (params) => params.data.tier === 1,
			'tier-2': (params) => params.data.tier === 2,
			'tier-3': (params) => params.data.tier === 3,
			'tier-4': (params) => params.data.tier === 4,
			'tier-5': (params) => params.data.tier === 5,
			'tier-6': (params) => params.data.tier === 6,
			'tier-7': (params) => params.data.tier === 7,
			'tier-8': (params) => params.data.tier === 8,
			'tier-9': (params) => params.data.tier === 9,
		};
	}, []);

	  const autoSizeStrategy = useMemo(() => {
    return {
      type: "fitGridWidth",
      defaultMinWidth: 100,
    };
  }, []);



	const { data = [], isLoading, isError, error } = useQuery({
		queryKey: [type],
		queryFn: async () => {
			//	const filter = `format.name = '${format}' `;
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
				<p className="text-lg text-gray-300">No Data Found.</p>
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
				rowClassRules={rowClassRules}
				autoSizeStrategy={autoSizeStrategy}
			/>
		</>
	);
}