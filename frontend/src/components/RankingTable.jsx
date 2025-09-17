/* eslint-disable react/react-in-jsx-scope */
import { useMemo, useState, useEffect } from 'react';
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

const pb = new PocketBase('https://fftiers.israelimru.com');


export default function RankingTable({ type, onDataLoaded }) {

  const [allRankings, setAllRankings] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState("Standard");
  const [selectedPosition, setSelectedPositon] = useState("all");

  const defaultColDef = useMemo(() => ({
    filter: true // Enable filtering on all columns
  }))


  const colDefs = useMemo(() => {
    const rankingHeader = 'positionRank';

    const columns = [
      { field: 'tier', maxWidth: 100 },
      {
        field: 'expand.player.name',
        headerName: 'Name',
        flex: 1,
        minWidth: 150 
      },
      
      { field: rankingHeader, headerName: 'Ranking', maxWidth: 200, minWidth: 60 },
    ];

    if (selectedPosition === 'all') {
      columns.splice(2, 0, {
        field: 'expand.position.name',
        headerName: 'Position',
        maxWidth: 150,
        minWidth: 60,
      });
    }
    return columns;
  }, [type, selectedPosition]);

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

  useEffect(() => {
    setSelectedWeek(currentWeek)
  }, [currentWeek])


  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: [type],
    queryFn: async () => {
      //	const filter = `format.name = '${format}' `;
      //const filter = `(week = '2' && year = '2025')`;
      const records = await pb.collection(type).getFullList({
        //	filter: filter,
        expand: 'player,position,format',
      });
      setAllRankings(records);
      const numOfRecords = records.length;
      const currentWeek = records[numOfRecords - 1].week;
      setCurrentWeek(currentWeek);
      onDataLoaded(records[numOfRecords - 1].updated)
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

  const formatAgnosticPositions = ['QB', 'K', 'DST'];

  const filteredRankings = allRankings.filter((ranking) => {
    const isMatchingWeek = ranking.week === selectedWeek;
    const isMatchingFormat = ranking.expand.format.name === selectedFormat;
    const isAgnosticPosition = formatAgnosticPositions.includes(ranking.expand.position.name);
    const matchesFormatLogic = isMatchingFormat || isAgnosticPosition;

    const matchesPositionLogic =
      selectedPosition === 'all' ||
      ranking.expand.position.name === selectedPosition;

    return isMatchingWeek && matchesFormatLogic && matchesPositionLogic;
  });


  const availableWeeks = [...new Set(allRankings.map((r) => r.week))].sort(
    (a, b) => a - b
  );

  const availableFormats = [...new Set(allRankings.map((r) => r.expand.format.name))];
  const availablePositions = [...new Set(allRankings.map((r) => r.expand.position.name))];


  return (
    <>
      <div className="flex flex-col items-stretch space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-6 mb-4">
        {/* Filter Group 1: Week */}
        <div className="flex items-center space-x-2">
          <label htmlFor="week-select" className="text-sm font-medium text-gray-300">
            Filter by Week:
          </label>
          <select
            id="week-select"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="w-full rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 pr-8 text-sm font-medium text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto appearance-none bg-no-repeat bg-right-1.5 bg-[length:1.2em_1.2em] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24%22 fill=%22%239ca3af%22><path d=%22M11.9997 13.1714L16.9495 8.22168L18.3637 9.63589L11.9997 15.9999L5.63574 9.63589L7.04996 8.22168L11.9997 13.1714Z%22></path></svg>')]"
          >
            {availableWeeks.map((week) => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Group 2: Scoring Format */}
        <div className="flex items-center space-x-2">
          <label htmlFor="format-select" className="text-sm font-medium text-gray-300">
            Scoring Format
          </label>
          <select
            id="format-select"
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="w-full rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 pr-8 text-sm font-medium text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto appearance-none bg-no-repeat bg-right-1.5 bg-[length:1.2em_1.2em] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24%24%22 fill=%22%239ca3af%22><path d=%22M11.9997 13.1714L16.9495 8.22168L18.3637 9.63589L11.9997 15.9999L5.63574 9.63589L7.04996 8.22168L11.9997 13.1714Z%22></path></svg>')]"
          >
            {availableFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Group 3: Position */}
        <div className="flex items-center space-x-2">
          <label htmlFor="position-select" className="text-sm font-medium text-gray-300">
            Position
          </label>
          <select
            id="position-select"
            value={selectedPosition}
            onChange={(e) => setSelectedPositon(e.target.value)}
            className="w-full rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 pr-8 text-sm font-medium text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto appearance-none bg-no-repeat bg-right-1.5 bg-[length:1.2em_1.2em] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24%24%22 fill=%22%239ca3af%22><path d=%22M11.9997 13.1714L16.9495 8.22168L18.3637 9.63589L11.9997 15.9999L5.63574 9.63589L7.04996 8.22168L11.9997 13.1714Z%22></path></svg>')]"
          >
            <option key="all" value="all">
              All
            </option>
            {availablePositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>
      </div>
      <AgGridReact
        rowData={filteredRankings}
        columnDefs={colDefs}
        defaultColDef={defaultColDef}
        rowClassRules={rowClassRules}
        autoSizeStrategy={autoSizeStrategy}
      />
    </>
  );
}
