import React, { useState } from 'react';
import { Importer, ImporterField } from 'react-csv-importer';
import 'react-csv-importer/dist/index.css';
import { parseCSV, importSchedule } from '../lib/importUtils';
import { Team, TeamsMap } from '../models/Team';
import { Match } from '../models/Match';

interface ImportScheduleProps {
  teams?: TeamsMap | null;
  onImportComplete?: (matches: Match[]) => void;
}

interface ImportedScheduleRow {
  timeSlot?: string;
  time?: string;
  round?: string;
  division?: string;
  field?: string;
  court?: string;
  pitch?: string;
  team1?: string;
  homeTeam?: string;
  home?: string;
  team2?: string;
  awayTeam?: string;
  away?: string;
  referee?: string;
  refereeTeam?: string;
  teamReferee?: string;
}

export default function ImportSchedule({ teams, onImportComplete }: ImportScheduleProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  const handleDataImport = (rows: ImportedScheduleRow[]) => {
    try {
      setError(null);

      if (rows.length === 0) {
        setError('No valid schedule data found');
        return;
      }

      // Initialize teams object if not provided
      const workingTeams = teams || {
        mixed: {},
        gendered: {},
        cloth: {},
      };

      // Convert rows to the format expected by importSchedule utility
      // Create a CSV-like string from the imported data for compatibility with existing logic
      const csvData = rows
        .map(row => {
          const timeSlot = row.timeSlot || row.time || row.round || '';
          const division = row.division || '';
          const field = row.field || row.court || row.pitch || '';
          const team1 = row.team1 || row.homeTeam || row.home || '';
          const team2 = row.team2 || row.awayTeam || row.away || '';
          const referee = row.referee || row.refereeTeam || row.teamReferee || '';

          return [timeSlot, division, field, team1, team2, referee].join(',');
        })
        .join('\n');

      // Use existing import logic
      const importedMatches = importSchedule(csvData, workingTeams);

      if (importedMatches.length === 0) {
        setError(
          'No valid matches could be extracted from the data. Please check that team names match your imported players.'
        );
        return;
      }

      setMatches(importedMatches);
      setShowResults(true);

      // Notify parent component
      if (onImportComplete) {
        onImportComplete(importedMatches);
      }
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const resetImport = () => {
    setMatches([]);
    setError(null);
    setShowResults(false);
  };

  // Format time for display
  const formatTimeSlot = (timeSlot: number): string => {
    // Check if timeSlot is a time value (e.g. 930 for 9:30)
    if (timeSlot >= 100) {
      const hours = Math.floor(timeSlot / 100);
      const minutes = timeSlot % 100;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return timeSlot.toString();
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Import Match Schedule</h2>

      {!showResults ? (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file with match schedule data. The importer will help you map columns to the correct fields:
              <br />
              <strong>Required:</strong> Division, Team 1, Team 2
              <br />
              <strong>Optional:</strong> Time/Round, Field/Court, Referee Team
            </p>

            {!teams && (
              <div className="p-3 mb-4 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded">
                <strong>Note:</strong> Import players first to ensure team names can be matched correctly.
              </div>
            )}
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <Importer
              dataHandler={handleDataImport}
              defaultNoHeader={false}
              restartable={false}
              onStart={({ file, fields }) => {
                setError(null);
                console.log('Schedule import started:', { file: file.name, fields });
              }}
              onComplete={({ file, rows }) => {
                console.log('Schedule import completed:', { file: file.name, rowCount: rows.length });
              }}
              onError={error => {
                setError(`Import error: ${error.message}`);
              }}
            >
              <ImporterField name="timeSlot" label="Time Slot" optional />
              <ImporterField name="time" label="Time (Alt)" optional />
              <ImporterField name="round" label="Round" optional />
              <ImporterField name="division" label="Division" />
              <ImporterField name="field" label="Field" optional />
              <ImporterField name="court" label="Court" optional />
              <ImporterField name="pitch" label="Pitch" optional />
              <ImporterField name="team1" label="Team 1" />
              <ImporterField name="homeTeam" label="Home Team" optional />
              <ImporterField name="home" label="Home" optional />
              <ImporterField name="team2" label="Team 2" />
              <ImporterField name="awayTeam" label="Away Team" optional />
              <ImporterField name="away" label="Away" optional />
              <ImporterField name="referee" label="Referee Team" optional />
              <ImporterField name="refereeTeam" label="Referee Team (Alt)" optional />
              <ImporterField name="teamReferee" label="Team Referee" optional />
            </Importer>
          </div>
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

      {matches.length > 0 && (
        <div>
          <h3 className="font-bold mb-2">Imported {matches.length} Matches</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left border">Time Slot</th>
                  <th className="p-2 text-left border">Division</th>
                  <th className="p-2 text-left border">Field/Court</th>
                  <th className="p-2 text-left border">Team 1</th>
                  <th className="p-2 text-left border">Team 2</th>
                  <th className="p-2 text-left border">Referee</th>
                </tr>
              </thead>
              <tbody>
                {matches
                  .sort((a, b) => a.timeSlot - b.timeSlot)
                  .map((match, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 border">{formatTimeSlot(match.timeSlot)}</td>
                      <td className="p-2 border">{match.division}</td>
                      <td className="p-2 border">{match.field}</td>
                      <td className="p-2 border">{match.team1.name}</td>
                      <td className="p-2 border">{match.team2.name}</td>
                      <td className="p-2 border">{match.refereeTeam?.name || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
