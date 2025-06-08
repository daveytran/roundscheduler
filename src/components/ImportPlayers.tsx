import React, { useState } from 'react';
import { Player } from '../models/Player';
import { Team, TeamsMap } from '../models/Team';
import SimpleFileImport from './SimpleFileImport';

interface ImportPlayersProps {
  onImportComplete?: (players: Player[], teams: TeamsMap) => void;
}

interface ImportedRow {
  name?: string;
  gender?: string;
  mixedClub?: string;
  genderedClub?: string;
  clothClub?: string;
}

export default function ImportPlayers({ onImportComplete }: ImportPlayersProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamsMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Helper function to format team names with division type
  const formatTeamName = (clubName: string, division: string, gender?: string): string => {
    if (division === 'mixed') {
      return `${clubName} (Mixed)`;
    } else if (division === 'gendered') {
      if (gender?.toLowerCase().startsWith('f') || gender?.toLowerCase() === 'female') {
        return `${clubName} (Womens)`;
      } else if (gender?.toLowerCase().startsWith('m') || gender?.toLowerCase() === 'male') {
        return `${clubName} (Mens)`;
      } else {
        return `${clubName} (Gendered)`;
      }
    } else if (division === 'cloth') {
      return `${clubName} (Cloth)`;
    }
    return clubName;
  };

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
            } else if (
              header.includes('mixed') &&
              (header.includes('team') || header.includes('club') || header.includes('division'))
            ) {
              row.mixedClub = value;
            } else if (header.includes('cloth') || header.includes('open')) {
              row.clothClub = value;
            } else if (
              header.includes('gendered') ||
              header.includes('foam') ||
              header.includes('women') ||
              header.includes('men')
            ) {
              row.genderedClub = value;
            } else if (header.includes('gender') || header.includes('sex')) {
              row.gender = value;
            }
          }
        });

        // Handle gender in last column if header is empty/unrecognized and value looks like gender
        if (!row.gender && values.length > 0) {
          const lastValue = values[values.length - 1]?.trim();
          if (
            lastValue &&
            (lastValue.toLowerCase() === 'm' ||
              lastValue.toLowerCase() === 'f' ||
              lastValue.toLowerCase() === 'male' ||
              lastValue.toLowerCase() === 'female')
          ) {
            row.gender = lastValue;
          }
        }

        // If no name was found but we have values, try to find player name in likely positions
        if (!row.name && values.length > 0) {
          // Look for a column that contains a proper name (has spaces and capital letters)
          for (let i = 0; i < values.length; i++) {
            const value = values[i]?.trim();
            if (
              value &&
              value.includes(' ') &&
              /[A-Z]/.test(value) &&
              !headers[i]?.includes('team') &&
              !headers[i]?.includes('club') &&
              !headers[i]?.includes('division') &&
              value !== row.gender
            ) {
              row.name = value;
              break;
            }
          }
        }

        return row;
      })
      .filter(row => row.name); // Only include rows with names
  };

  const handleFileImport = (data: string) => {
    if (!data.trim()) {
      setError('No data provided');
      return;
    }

    try {
      const rows = parsePastedData(data);
      if (rows.length === 0) {
        setError('No valid player data found in the content. Make sure you include headers and player names.');
        return;
      }

      processImportedData(rows);
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const processImportedData = (rows: ImportedRow[]) => {
    try {
      setError(null);

      if (rows.length === 0) {
        setError('No valid player data found');
        return;
      }

      // Convert imported rows to Player objects with formatted team names
      const importedPlayers = rows
        .map(row => {
          const playerName = row.name || '';
          const gender = row.gender || '';

          // Format team names with division types
          const mixedTeam = row.mixedClub ? formatTeamName(row.mixedClub || '', 'mixed') : null;

          const genderedTeam = row.genderedClub ? formatTeamName(row.genderedClub || '', 'gendered', gender) : null;

          const clothTeam = row.clothClub ? formatTeamName(row.clothClub || '', 'cloth') : null;

          return new Player(playerName, mixedTeam, genderedTeam, clothTeam);
        })
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

      // Notify parent component of successful import
      if (onImportComplete) {
        onImportComplete(importedPlayers, importedTeams);
      }
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
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
      <h2 className="text-xl font-bold mb-4">Import Players & Clubs</h2>

      {!showResults ? (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file or paste tab-separated data with player information. The importer supports various
              column formats:
              <br />
              <strong>Required:</strong> Player Name
              <br />
              <strong>Optional:</strong> Gender, Mixed Division Club, Gendered Division Club, Cloth Division Club
              <br />
              <strong>Supported formats:</strong> CSV, TSV, or data copied from Excel/Google Sheets
              <br />
              <em>
                Note: Teams will be named &quot;{'{'}Club Name{'}'} ({'{'}Division Type{'}'}){'&quot;'}. For gendered
                divisions, &apos;F&apos;/&apos;Female&apos; creates womens teams, &apos;M&apos;/&apos;Male&apos; creates
                mens teams.
              </em>
            </p>
          </div>

          <SimpleFileImport
            onImport={handleFileImport}
            acceptedFileTypes=".csv,.tsv,.txt,text/plain,text/csv,text/tab-separated-values"
            placeholder="Paste your player data here (with headers)... 
Example CSV:
Name,Gender,Mixed Club,Gendered Club,Cloth Club
John Doe,M,Phoenix,Phoenix,Phoenix
Jane Smith,F,Lightning,Lightning,Lightning

Or tab-separated format:
Mixed Team	Gendered Foam	Open Cloth	Player	
North Star Storm	North Star Storm	North Star Storm	Adrian Bird	M
Sun Valley Storm		Hoxton Park Hedgehogs	Ahmed Chatila	M"
            buttonText="Import Players"
            fileDescription="CSV or tab-separated player file"
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

          {/* Players Table in scrollable container */}
          <div className="overflow-x-auto border border-gray-200 rounded">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
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
          </div>

          {teams && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Teams Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto border border-gray-200 rounded p-4">
                <div>
                  <h4 className="font-semibold sticky top-0 bg-white py-1">Mixed Division</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {Object.keys(teams.mixed).map(teamName => (
                      <li key={teamName} className="mb-1">
                        {teamName} ({teams.mixed[teamName].players.length} players)
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold sticky top-0 bg-white py-1">Gendered Division</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {Object.keys(teams.gendered).map(teamName => (
                      <li key={teamName} className="mb-1">
                        {teamName} ({teams.gendered[teamName].players.length} players)
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold sticky top-0 bg-white py-1">Cloth Division</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {Object.keys(teams.cloth).map(teamName => (
                      <li key={teamName} className="mb-1">
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