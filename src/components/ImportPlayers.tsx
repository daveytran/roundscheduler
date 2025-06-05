import React, { useState } from 'react';
import { Importer, ImporterField } from 'react-csv-importer';
import 'react-csv-importer/dist/index.css';
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
  
  const handleDataImport = (rows: ImportedRow[]) => {
    try {
      setError(null);
      
      if (rows.length === 0) {
        setError('No valid player data found');
        return;
      }
      
      // Convert imported rows to Player objects
      const importedPlayers = rows.map(row => new Player(
        row.name || row.playerName || '',
        row.mixedTeam || row.mixedDivisionTeam || null,
        row.genderedTeam || row.genderedDivisionTeam || null,
        row.clothTeam || row.clothDivisionTeam || null
      )).filter(player => player.name.trim() !== ''); // Filter out empty names
      
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

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <Importer
              dataHandler={handleDataImport}
              defaultNoHeader={false}
              restartable={false}
              onStart={({ file, fields }) => {
                setError(null);
                console.log('Import started:', { file: file.name, fields });
              }}
              onComplete={({ file, rows }) => {
                console.log('Import completed:', { file: file.name, rowCount: rows.length });
              }}
              onError={(error) => {
                setError(`Import error: ${error.message}`);
              }}
            >
              <ImporterField name="name" label="Player Name" />
              <ImporterField name="playerName" label="Player Name (Alt)" optional />
              <ImporterField name="mixedTeam" label="Mixed Division Team" optional />
              <ImporterField name="mixedDivisionTeam" label="Mixed Division Team (Alt)" optional />
              <ImporterField name="genderedTeam" label="Gendered Team" optional />
              <ImporterField name="genderedDivisionTeam" label="Gendered Team (Alt)" optional />
              <ImporterField name="clothTeam" label="Cloth Team" optional />
              <ImporterField name="clothDivisionTeam" label="Cloth Team (Alt)" optional />
            </Importer>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="font-bold">Import Successful!</h3>
            <button
              onClick={resetImport}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Import New File
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}
      
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