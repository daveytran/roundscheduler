import React, { useState } from 'react';
import { ReactSpreadsheetImport } from 'react-spreadsheet-import';
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
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

  const fields = [
    { label: "Time Slot", key: "timeSlot", fieldType: { type: "input" }, optional: true },
    { label: "Time", key: "time", fieldType: { type: "input" }, optional: true },
    { label: "Round", key: "round", fieldType: { type: "input" }, optional: true },
    { label: "Division", key: "division", fieldType: { type: "input" } },
    { label: "Field", key: "field", fieldType: { type: "input" }, optional: true },
    { label: "Court", key: "court", fieldType: { type: "input" }, optional: true },
    { label: "Pitch", key: "pitch", fieldType: { type: "input" }, optional: true },
    { label: "Team 1", key: "team1", fieldType: { type: "input" } },
    { label: "Home Team", key: "homeTeam", fieldType: { type: "input" }, optional: true },
    { label: "Home", key: "home", fieldType: { type: "input" }, optional: true },
    { label: "Team 2", key: "team2", fieldType: { type: "input" } },
    { label: "Away Team", key: "awayTeam", fieldType: { type: "input" }, optional: true },
    { label: "Away", key: "away", fieldType: { type: "input" }, optional: true },
    { label: "Referee", key: "referee", fieldType: { type: "input" }, optional: true },
    { label: "Referee Team", key: "refereeTeam", fieldType: { type: "input" }, optional: true },
    { label: "Team Referee", key: "teamReferee", fieldType: { type: "input" }, optional: true },
  ] as const;
  
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
        cloth: {}
      };
      
      // Convert rows to the format expected by importSchedule utility
      // Create a CSV-like string from the imported data for compatibility with existing logic
      const csvData = rows.map(row => {
        const timeSlot = row.timeSlot || row.time || row.round || '';
        const division = row.division || '';
        const field = row.field || row.court || row.pitch || '';
        const team1 = row.team1 || row.homeTeam || row.home || '';
        const team2 = row.team2 || row.awayTeam || row.away || '';
        const referee = row.referee || row.refereeTeam || row.teamReferee || '';
        
        return [timeSlot, division, field, team1, team2, referee].join(',');
      }).join('\n');
      
      // Use existing import logic
      const importedMatches = importSchedule(csvData, workingTeams);
      
      if (importedMatches.length === 0) {
        setError('No valid matches could be extracted from the data. Please check that team names match your imported players.');
        return;
      }
      
      setMatches(importedMatches);
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
            <button
              onClick={() => setIsImportOpen(true)}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Click to Import CSV File
            </button>
          </div>

          <ReactSpreadsheetImport
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onSubmit={handleDataImport}
            fields={fields}
            allowInvalidSubmit={false}
            translations={{
              uploadStep: {
                title: "Upload Schedule File",
                manifestLoadButton: "Select File",
              },
              selectHeaderStep: {
                title: "Select Header Row",
              },
              matchColumnsStep: {
                title: "Match Columns",
                userTableTitle: "Your File",
                templateTitle: "Expected Format",
              },
              validationStep: {
                title: "Validate Data",
              },
            }}
          />
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