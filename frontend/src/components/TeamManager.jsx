/* eslint-disable react/react-in-jsx-scope */
import { useTeams, addTeam, renameTeam, deleteTeam } from '../utils/teams.js';

// Small header strip for creating / renaming / deleting teams.
export default function TeamManager() {
    const teams = useTeams();

    const onAdd = () => {
        const name = prompt('Team name?');
        if (name !== null) addTeam(name);
    };

    return (
        <div className="flex flex-wrap items-center gap-2 my-3">
            <span className="text-sm font-medium text-gray-300">Teams</span>
            {teams.map((t) => (
                <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-700 pl-3 pr-1 py-1 text-sm text-white"
                >
                    <span>{t.name}</span>
                    <span className="text-gray-400 text-xs">({t.players.length})</span>
                    <button
                        onClick={() => {
                            const name = prompt('Rename team', t.name);
                            if (name !== null) renameTeam(t.id, name);
                        }}
                        title="Rename"
                        className="ml-1 px-1 text-gray-400 hover:text-white"
                    >
                        ✎
                    </button>
                    <button
                        onClick={() => confirm(`Delete "${t.name}"?`) && deleteTeam(t.id)}
                        title="Delete"
                        className="px-1 text-gray-400 hover:text-red-400"
                    >
                        ✕
                    </button>
                </span>
            ))}
            <button
                onClick={onAdd}
                className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm font-medium text-white"
            >
                + Add team
            </button>
        </div>
    );
}