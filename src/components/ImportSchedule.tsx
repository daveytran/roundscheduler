import React, { useState } from 'react';
import { importSchedule, parsePastedScheduleData, ImportedScheduleRow } from '../lib/importUtils';
import { TeamsMap } from '../models/Team';
import { Match } from '../models/Match';
import { Schedule } from '../models/Schedule';
import ScheduleVisualization from './ScheduleVisualization';
import { ScheduleRule } from '../models/ScheduleRule';
import SimpleFileImport from './SimpleFileImport';

interface ImportScheduleProps {
  teams?: TeamsMap | null;
  rules?: ScheduleRule[]; // Scheduling rules for violation detection
  onImportComplete?: (matches: Match[]) => void;
}

export default function ImportSchedule({ teams, rules = [], onImportComplete }: ImportScheduleProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  const handleFileImport = (data: string) => {
    try {
      setError(null);
      
      // Parse the data using the existing utility
      const rows = parsePastedScheduleData(data);
      
      if (rows.length === 0) {
        setError('No valid schedule data found in the file. Make sure to include headers and both team names.');
        return;
      }

      processImportedData(rows);
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const processImportedData = (rows: ImportedScheduleRow[]) => {
    try {
      // Initialize teams object if not provided
      const workingTeams = teams || {
        mixed: {},
        gendered: {},
        cloth: {},
      };

      // Convert rows to the format expected by importSchedule utility
      // Create a CSV-like string from the imported data for compatibility with existing logic
      // Format: Round, Division, Time, Team1, Team2, Court, Referee (7 columns)
      const csvData = rows
        .map(row => {
          // Include round field for special activity detection
          const round = row.round || '';
          const division = row.division || '';

          // Convert time format if needed (e.g., "9:30" to time slot number)
          let time = row.timeSlot || row.time || '';
          if (time.includes(':')) {
            const [hours, minutes] = time.split(':');
            time = `${parseInt(hours)}${minutes.padStart(2, '0')}`;
          }

          const team1 = row.team1 || row.homeTeam || row.home || '';
          const team2 = row.team2 || row.awayTeam || row.away || '';
          const field = row.field || row.court || row.pitch || '';
          const referee = row.referee || row.refereeTeam || row.teamReferee || '';

          // Format: Round, Division, Time, Team1, Team2, Field, Referee
          return [round, division, time, team1, team2, field, referee].join(',');
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

      // Mark setup and packdown activities as locked to prevent them from being moved during optimization
      importedMatches.forEach(match => {
        if (match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN') {
          match.locked = true;
        }
      });

      setMatches(importedMatches);
      
      // Create Schedule object for visualization with rules
      const newSchedule = new Schedule(importedMatches);
      newSchedule.evaluate(rules); // Calculate violations using the provided rules
      setSchedule(newSchedule);
      
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
    setSchedule(null);
    setError(null);
    setShowResults(false);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Import Match Schedule</h2>

      {!showResults ? (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file or paste tab-separated data with match schedule information. The importer supports
              various column formats:
              <br />
              <strong>Required:</strong> Division, Home Team, Away Team
              <br />
              <strong>Optional:</strong> Round, Time, Field/Court, Team Referee
              <br />
              <strong>Supported formats:</strong> CSV, TSV, or data copied from Excel/Google Sheets
              <br />
              <em>Note: SETUP and PACKING DOWN activities will be preserved and protected from shuffling</em>
              {rules.length > 0 && (
                <>
                  <br />
                  <span className="text-blue-600">✓ {rules.length} scheduling rules active - violations will be automatically detected</span>
                </>
              )}
            </p>

            {!teams && (
              <div className="p-3 mb-4 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded">
                <strong>Note:</strong> Import players first to ensure team names can be matched correctly.
              </div>
            )}
          </div>

          <SimpleFileImport
            onImport={handleFileImport}
            acceptedFileTypes=".csv,.tsv,.txt,text/plain,text/csv,text/tab-separated-values"
            placeholder="Paste your schedule data here (with headers)... 
Example CSV:
Time,Division,Field,Team1,Team2,Referee
9:00,Mixed,Field 1,Team A,Team B,Team C
10:00,Mixed,Field 2,Team D,Team E,Team F

Or tab-separated format:
Round	Division	Time	Home Team	Away Team	Court	Team Referee
Mixed Foam	MX2	9:30	Fairfield Falcons	UTS Lizards	1	Fairlight Ascendents
	MX2	10:20	Canterbury Nines	Chatswood Chibis	2	Villawood Hydra"
            buttonText="Import Schedule"
            fileDescription="CSV or tab-separated schedule file"
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

      {schedule && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Imported {matches.length} Matches</h3>
            {schedule.violations && schedule.violations.length > 0 && (
              <div className="text-sm">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                  ⚠️ {schedule.violations.length} rule violation{schedule.violations.length !== 1 ? 's' : ''} detected (Score: {schedule.score})
                </span>
              </div>
            )}
            {schedule.violations && schedule.violations.length === 0 && (
              <div className="text-sm">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                  ✅ No rule violations detected
                </span>
              </div>
            )}
          </div>
          <ScheduleVisualization schedule={schedule} />
        </div>
      )}
    </div>
  );
}