/* eslint-disable react/react-in-jsx-scope */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "../styles/app.css"
import { TIER_COLORS } from "../utils/constants.js"
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

  const [removedIds, setRemovedIds] = useState(() => {
    const saved = localStorage.getItem('removedIds');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  const [removedView, setRemovedView] = useState('hide'); // 'hide' | 'strike' | 'table'

  const defaultColDef = useMemo(() => ({
    filter: true // Enable filtering on all columns
  }))

  useEffect(() => {
    localStorage.setItem('removedIds', JSON.stringify([...removedIds]));
  }, [removedIds]);



  const colDefs = useMemo(() => {
    // const rankingHeader = 'positionRank';
    const rankingHeader = 'overallRanking';
    const columns = [
      { field: 'tier', maxWidth: 100 },
      {
        field: 'expand.player.name',
        headerName: 'Name',
        flex: 1,
        minWidth: 150
      },

      { field: rankingHeader, headerName: 'Overall Ranking', maxWidth: 200, minWidth: 60 },
    ];

    if (selectedPosition === 'all') {
      columns.splice(2, 0, {
        field: 'expand.position.name',
        headerName: 'Position',
        valueFormatter: p => p.data.positionRanking
          ? `${p.value}${p.data.positionRanking}`
          : p.value,
        maxWidth: 150,
        minWidth: 60,
      });
    } else {
      columns.splice(2, 0, {
        field: 'positionRanking',
        headerName: 'Pos Rank',
        maxWidth: 110,
        minWidth: 70,
      });
    }
    return columns;
  }, [type, selectedPosition]);

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: [type],
    queryFn: async () => {
      //	const filter = `format.name = '${format}' `;
      // const filter = `(week = '1' && year = '2026')`;
      const records = await pb.collection(type).getFullList({
        //  filter: filter,
        expand: 'player,position,format, overallRanking, positionRanking',
      });
      setAllRankings(records);
      const numOfRecords = records.length;
      const currentWeek = records[numOfRecords - 1].week;
      setCurrentWeek(currentWeek);
      onDataLoaded(records[numOfRecords - 1].updated)
      return records;
    },
  });
  const getRowId = useCallback((params) => params.data.id, []);

  const { filteredRankings, removedRankings, tierStarts } = useMemo(() => {
    const base = allRankings.filter((ranking) => {
      if (!ranking.expand) return false;
      if (removedView === 'hide' && removedIds.has(ranking.id)) return false;

      const isMatchingWeek = ranking.week === selectedWeek;
      const matchesFormatLogic = ranking.expand.format.name === selectedFormat;
      const matchesPositionLogic =
        selectedPosition === 'all' ||
        ranking.expand.position.name === selectedPosition;

      return isMatchingWeek && matchesFormatLogic && matchesPositionLogic && ranking.overallRanking;
    });

    const starts = new Set();
    let lastTier = null;
    for (const r of [...base].sort((a, b) => a.overallRanking - b.overallRanking)) {
      if (r.tier !== lastTier) {
        starts.add(r.id);
        lastTier = r.tier;
      }
    }

    const removed = base.filter((r) => removedIds.has(r.id));
    const main = removedView === 'table' ? base.filter((r) => !removedIds.has(r.id)) : base;

    return { filteredRankings: main, removedRankings: removed, tierStarts: starts };
  }, [allRankings, removedIds, removedView, selectedWeek, selectedFormat, selectedPosition]);

  const rowClassRules = useMemo(() => ({
    'row-removed': (p) => removedIds.has(p.data.id) && removedView === 'strike',
  }), [removedIds, removedView]);

  const getRowStyle = useCallback((params) => {
    const tier = params.data?.tier;
    if (!tier) return undefined;
    return {
      backgroundColor: TIER_COLORS[(tier - 1) % TIER_COLORS.length],
      borderTop: tierStarts.has(params.data.id) ? '2px solid #1e293b' : undefined,
    };
  }, [tierStarts]);



  const autoSizeStrategy = useMemo(() => {
    return {
      type: "fitGridWidth",
      defaultMinWidth: 100,
    };
  }, []);

  useEffect(() => {
    setSelectedWeek(currentWeek)
  }, [currentWeek])






  //console.log(data)


  const availableWeeks = [...new Set(allRankings.map((r) => r.week))].sort(
    (a, b) => a - b
  );

  const availableFormats = [...new Set(allRankings.map((r) => r.expand.format.name))];
  const availablePositions = [...new Set(allRankings.map((r) => r.expand.position.name))];
  console.log(filteredRankings.map(r => ({ id: r.id, name: r.expand.player.name, format: r.expand.format.name, created: r.created })));




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

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex flex-col items-stretch space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-6 mb-4 mt-4 flex-wrap shrink-0">
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

        {/* Filter Group 4: Removed */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-300">Removed</label>
          <select
            value={removedView}
            onChange={(e) => setRemovedView(e.target.value)}
            className="rounded-md border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white"
          >
            <option value="hide">Hidden</option>
            <option value="strike">Struck out</option>
            <option value="table">Separate table</option>
          </select>
        </div>

        {removedIds.size > 0 && (
          <button
            onClick={() => confirm('Restore all removed players?') && setRemovedIds(new Set())}
            className="rounded-md bg-slate-700 hover:bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            Restore all ({removedIds.size})
          </button>
        )}
      </div>

      {/* Grids */}
      <div className={`flex-1 min-h-0 ${removedView === 'table' ? 'flex gap-4' : ''}`}>
        <div className="flex-1 min-w-0 h-full">
          <AgGridReact
            rowData={filteredRankings}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            getRowStyle={getRowStyle}
            rowClassRules={rowClassRules}
            autoSizeStrategy={autoSizeStrategy}
            onRowDoubleClicked={(event) => {
              setRemovedIds((prev) => {
                const next = new Set(prev);
                // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                next.has(event.data.id) ? next.delete(event.data.id) : next.add(event.data.id);
                return next;
              });
            }}
          />
        </div>

        {removedView === 'table' && removedRankings.length > 0 && (
          <div className="w-72 shrink-0 h-full flex flex-col">
            <h3 className="text-sm font-medium text-gray-400 mb-2 shrink-0">
              ☠️ Removed ({removedRankings.length}) — double click to restore
            </h3>
            <div className="dead-grid flex-1 min-h-0">
              <AgGridReact
                rowData={removedRankings}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                getRowId={getRowId}
                getRowStyle={getRowStyle}
                rowClassRules={rowClassRules}
                onRowDoubleClicked={(event) => {
                  setRemovedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(event.data.id);
                    return next;
                  });
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
