import React, { useState } from 'react';
import { ReactSpreadsheetImport } from 'react-spreadsheet-import';
import { parseCSV, importSchedule } from '../lib/importUtils';
import { Team, TeamsMap } from '../models/Team';
import { Match } from '../models/Match';
import { Schedule } from '../models/Schedule';
import ScheduleVisualization from './ScheduleVisualization';
import { ScheduleRule } from '../models/ScheduleRule';

interface ImportScheduleProps {
  teams?: TeamsMap | null;
  rules?: ScheduleRule[]; // Scheduling rules for violation detection
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

export default function ImportSchedule({ teams, rules = [], onImportComplete }: ImportScheduleProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [pastedData, setPastedData] = useState<string>('');

  const fields = [
    { label: 'Round', key: 'round', fieldType: { type: 'input' }, optional: true },
    { label: 'Division', key: 'division', fieldType: { type: 'input' } },
    { label: 'Time', key: 'time', fieldType: { type: 'input' }, optional: true },
    { label: 'Home Team', key: 'homeTeam', fieldType: { type: 'input' } },
    { label: 'Away Team', key: 'awayTeam', fieldType: { type: 'input' } },
    { label: 'Court', key: 'court', fieldType: { type: 'input' }, optional: true },
    { label: 'Team Referee', key: 'teamReferee', fieldType: { type: 'input' }, optional: true },
  ] as const;

  const parsePastedScheduleData = (text: string): ImportedScheduleRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 data row

    const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    const parsedRows = dataRows
      .map(line => {
        const values = line.split(/[,\t]/).map(v => v.trim());
        const row: ImportedScheduleRow = {};

        headers.forEach((header, index) => {
          const value = values[index] || '';
          if (value) {
            // Map common header variations to our expected fields
            if (header.includes('time') || header.includes('slot')) {
              row.timeSlot = value;
            } else if (header.includes('round')) {
              row.round = value;
            } else if (header.includes('division')) {
              row.division = value;
            } else if (header.includes('field') || header.includes('court') || header.includes('pitch')) {
              row.field = value;
            } else if (header.includes('home') && header.includes('team')) {
              row.homeTeam = value;
            } else if (header.includes('away') && header.includes('team')) {
              row.awayTeam = value;
            } else if (
              header.includes('team1') ||
              (header.includes('team') &&
                !header.includes('referee') &&
                !header.includes('home') &&
                !header.includes('away'))
            ) {
              row.team1 = value;
            } else if (header.includes('team2')) {
              row.team2 = value;
            } else if (header.includes('referee') || header.includes('ref')) {
              if (header.includes('team')) {
                row.teamReferee = value;
              } else {
                row.referee = value;
              }
            }
          }
        });

        // Set team1/team2 from homeTeam/awayTeam if not already set
        if (!row.team1 && row.homeTeam) row.team1 = row.homeTeam;
        if (!row.team2 && row.awayTeam) row.team2 = row.awayTeam;
        if (!row.referee && row.teamReferee) row.referee = row.teamReferee;

        return row;
      });

    // Process rows to mark all rows after packdown as packdown activities
    let packdownStarted = false;
    const processedRows = parsedRows.map(row => {
      // Check if this row is a packdown activity
      const isPackdownRow =
        row.round?.toLowerCase().includes('packing') ||
        row.team1?.toLowerCase().includes('packing');
      
      if (isPackdownRow) {
        packdownStarted = true;
      }

      // If packdown has started, treat all subsequent rows as packdown
      if (packdownStarted && !isPackdownRow) {
        // Convert this row to a packdown activity
        if (!row.round?.toLowerCase().includes('packing')) {
          row.round = row.round ? `${row.round} - PACKING DOWN` : 'PACKING DOWN';
        }
        if (!row.team1?.toLowerCase().includes('packing')) {
          row.team1 = row.team1 ? `${row.team1} - PACKING DOWN` : 'PACKING DOWN';
        }
      }

      return row;
    });

    return processedRows.filter(row => {
      // Keep setup/packing rows and regular matches with both teams
      const isSpecialRow =
        row.round?.toLowerCase().includes('setup') ||
        row.round?.toLowerCase().includes('packing') ||
        row.team1?.toLowerCase().includes('setup') ||
        row.team1?.toLowerCase().includes('packing');
      
      // For special activities, we only need one team identifier
      // For regular matches, we need both teams
      return isSpecialRow || (row.team1 && row.team2);
    });
  };

  const handlePastedScheduleImport = () => {
    if (!pastedData.trim()) {
      setError('Please paste some data first');
      return;
    }

    try {
      const rows = parsePastedScheduleData(pastedData);
      if (rows.length === 0) {
        setError('No valid schedule data found in pasted content. Make sure you include headers and both team names.');
        return;
      }

      handleDataImport({ validData: rows });
      setPastedData('');
    } catch (err) {
      setError(`Paste import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDataImport = (data: any) => {
    try {
      setError(null);
      const rows = data.validData as ImportedScheduleRow[];

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

      setMatches(importedMatches);
      
      // Create Schedule object for visualization with rules
      const newSchedule = new Schedule(importedMatches, rules);
      newSchedule.evaluate(); // Calculate violations using the provided rules
      setSchedule(newSchedule);
      
      setShowResults(true);
      setIsImportOpen(false);

      // Notify parent component
      if (onImportComplete) {
        onImportComplete(importedMatches);
      }
    } catch (err) {
      setError(`Import error: ${err instanceof Error ? err.message : String(err)}`);
      setIsImportOpen(false);
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
                📋 Paste Schedule from Excel/Google Sheets
              </label>
              <textarea
                value={pastedData}
                onChange={e => setPastedData(e.target.value)}
                placeholder="Paste your schedule data here (with headers)... 
Example CSV:
Time,Division,Field,Team1,Team2,Referee
9:00,Mixed,Field 1,Team A,Team B,Team C
10:00,Mixed,Field 2,Team D,Team E,Team F

Or tab-separated format:
Round	Division	Time	Home Team	Away Team	Court	Team Referee
Mixed Foam	MX2	9:30	Fairfield Falcons	UTS Lizards	1	Fairlight Ascendents
	MX2	10:20	Canterbury Nines	Chatswood Chibis	2	Villawood Hydra"
                className="w-full h-32 p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="mt-3 space-y-2">
                <button
                  onClick={handlePastedScheduleImport}
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
                title: 'Upload Schedule File',
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
