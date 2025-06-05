import React, { useState } from 'react';
import { ReactSpreadsheetImport } from 'react-spreadsheet-import';
import { Player } from '../models/Player';
import { Team, TeamsMap } from '../models/Team';

interface ImportPlayersProps {
  onImportComplete?: (players: Player[], teams: TeamsMap) => void;
}

interface ImportedRow {
  name?: string;
  playerName?: string;
  mixedTeam?: string;
  mixedDivisionTeam?: string;
  genderedTeam?: string;
  genderedDivisionTeam?: string;
  clothTeam?: string;
  clothDivisionTeam?: string;
}

export default function ImportPlayers({ onImportComplete }: ImportPlayersProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [pastedData, setPastedData] = useState<string>('');

  const fields = [
    { label: 'Player Name', key: 'name', fieldType: { type: 'input' } },
    { label: 'Player Name (Alt)', key: 'playerName', fieldType: { type: 'input' }, optional: true },
    { label: 'Mixed Division Team', key: 'mixedTeam', fieldType: { type: 'input' }, optional: true },
    { label: 'Mixed Division Team (Alt)', key: 'mixedDivisionTeam', fieldType: { type: 'input' }, optional: true },
    { label: 'Gendered Team', key: 'genderedTeam', fieldType: { type: 'input' }, optional: true },
    { label: 'Gendered Team (Alt)', key: 'genderedDivisionTeam', fieldType: { type: 'input' }, optional: true },
    { label: 'Cloth Team', key: 'clothTeam', fieldType: { type: 'input' }, optional: true },
    { label: 'Cloth Team (Alt)', key: 'clothDivisionTeam', fieldType: { type: 'input' }, optional: true },
  ] as const;

  const parsePastedData = (text: string): ImportedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 data row

    const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    return dataRows
      .map(line => {
        const values = line.split(/[,\t]/).map(v => v.trim());
        const row: ImportedRow = {};

        headers.forEach((header, index) => {
          const value = values[index] || '';
          if (value) {
            // Map common header variations to our expected fields
            if (header.includes('name') || header.includes('player')) {
              row.name = value;
            } else if (header.includes('mixed')) {
              row.mixedTeam = value;
            } else if (header.includes('cloth') || header.includes('spirit')) {
              row.clothTeam = value;
            } else if (header.includes('gender') || header.includes('women') || header.includes('men')) {
              row.genderedTeam = value;
            }
          }
        });

        return row;
      })
      .filter(row => row.name); // Only include rows with names
  };

  const handlePastedDataImport = () => {
    if (!pastedData.trim()) {
      setError('Please paste some data first');
      return;
    }

    try {
      const rows = parsePastedData(pastedData);
      if (rows.length === 0) {
        setError('No valid player data found in pasted content. Make sure you include headers and player names.');
        return;
      }

      // Process through the same pipeline as file import
      handleDataImport({ validData: rows });
      setPastedData('');
    } catch (err) {
      setError(`Paste import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDataImport = (data: any) => {
    try {
      setError(null);
      const rows = data.validData as ImportedRow[];

      if (rows.length === 0) {
        setError('No valid player data found');
        return;
      }

      // Convert imported rows to Player objects
      const importedPlayers = rows
        .map(
          row =>
            new Player(
              row.name || row.playerName || '',
              row.mixedTeam || row.mixedDivisionTeam || null,
              row.genderedTeam || row.genderedDivisionTeam || null,
              row.clothTeam || row.clothDivisionTeam || null
            )
        )
        .filter(player => player.name.trim() !== ''); // Filter out empty names

      if (importedPlayers.length === 0) {
        setError('No valid player data found - please ensure you have player names');
        return;
      }

      setPlayers(importedPlayers);

      // Create teams from players
      const importedTeams = Team.createTeamsFromPlayers(importedPlayers);
      setTeams(importedTeams);
      setShowResults(true);
      setIsImportOpen(false);

      // Notify parent component of successful import
      if (onImportComplete) {
        onImportComplete(importedPlayers, importedTeams);
      }
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
      setIsImportOpen(false);
    }
  };

  const resetImport = () => {
    setPlayers([]);
    setTeams(null);
    setError(null);
    setShowResults(false);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Import Players</h2>

      {!showResults ? (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file with player data. The importer will help you map columns to the correct fields:
              <br />
              <strong>Required:</strong> Player Name
              <br />
              <strong>Optional:</strong> Mixed Division Team, Gendered Team, Cloth Team
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <button
                onClick={() => setIsImportOpen(true)}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                📁 Upload CSV File
              </button>
            </div>

            <div className="text-center text-gray-500 font-medium">OR</div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 Paste Data from Excel/Google Sheets
              </label>
              <textarea
                value={pastedData}
                onChange={e => setPastedData(e.target.value)}
                placeholder="Paste your player data here (with headers)... 
Example:
Name,Mixed Team,Gendered Team,Cloth Team
John Doe,Team A,Team B,Team C
Jane Smith,Team A,Team D,Team E"
                className="w-full h-32 p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="mt-3 space-y-2">
                <button
                  onClick={handlePastedDataImport}
                  disabled={!pastedData.trim()}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  🚀 Quick Import (Auto-detect columns)
                </button>
                <button
                  onClick={() => {
                    if (pastedData.trim()) {
                      setIsImportOpen(true);
                      setPastedData(''); // Clear the paste box since they'll paste in the dialog
                    } else {
                      setError('Please paste some data first');
                    }
                  }}
                  disabled={!pastedData.trim()}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  🎯 Use Column Mapper (Manual mapping)
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Quick Import:</strong> Auto-detects common column names
                  <br />
                  <strong>Column Mapper:</strong> Opens dialog where you can paste data and manually map columns
                </p>
              </div>
            </div>
          </div>

          <ReactSpreadsheetImport
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onSubmit={handleDataImport}
            fields={fields}
            allowInvalidSubmit={false}
            translations={{
              uploadStep: {
                title: 'Upload Players File',
                manifestLoadButton: 'Select File',
              },
              selectHeaderStep: {
                title: 'Select Header Row',
              },
              matchColumnsStep: {
                title: 'Match Columns',
                userTableTitle: 'Your File',
                templateTitle: 'Expected Format',
              },
              validationStep: {
                title: 'Validate Data',
              },
            }}
          />
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="font-bold">Import Successful!</h3>
            <button onClick={resetImport} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Import New File
            </button>
          </div>
        </div>
      )}

      {error && <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-700 rounded">{error}</div>}

      {players.length > 0 && (
        <div>
          <h3 className="font-bold mb-2">Imported {players.length} Players</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left border">Player Name</th>
                  <th className="p-2 text-left border">Mixed Team</th>
                  <th className="p-2 text-left border">Gendered Team</th>
                  <th className="p-2 text-left border">Cloth Team</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 border">{player.name}</td>
                    <td className="p-2 border">{player.mixedTeam || '-'}</td>
                    <td className="p-2 border">{player.genderedTeam || '-'}</td>
                    <td className="p-2 border">{player.clothTeam || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {teams && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Teams Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-semibold">Mixed Division</h4>
                  <ul className="list-disc pl-5">
                    {Object.keys(teams.mixed).map(teamName => (
                      <li key={teamName}>
                        {teamName} ({teams.mixed[teamName].players.length} players)
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Gendered Division</h4>
                  <ul className="list-disc pl-5">
                    {Object.keys(teams.gendered).map(teamName => (
                      <li key={teamName}>
                        {teamName} ({teams.gendered[teamName].players.length} players)
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Cloth Division</h4>
                  <ul className="list-disc pl-5">
                    {Object.keys(teams.cloth).map(teamName => (
                      <li key={teamName}>
                        {teamName} ({teams.cloth[teamName].players.length} players)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
