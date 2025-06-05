import { useState } from 'react';
import { parseCSV, importSchedule } from '../lib/importUtils';
import { Team } from '../models/Team';

export default function ImportSchedule({ teams, onImportComplete }) {
  const [inputData, setInputData] = useState('');
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  
  const handleInputChange = (e) => {
    setInputData(e.target.value);
  };
  
  const handlePaste = (e) => {
    const pasteData = e.clipboardData.getData('text');
    setInputData(pasteData);
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputData(event.target.result);
    };
    reader.readAsText(file);
  };
  
  const handleImport = () => {
    try {
      setError(null);
      
      if (!inputData.trim()) {
        setError('Please paste or upload schedule data');
        return;
      }
      
      // Initialize teams object if not provided
      const workingTeams = teams || {
        mixed: {},
        gendered: {},
        cloth: {}
      };
      
      // Import the schedule using the updated utility function
      const importedMatches = importSchedule(inputData, workingTeams);
      
      if (importedMatches.length === 0) {
        setError('No valid matches could be extracted from the data');
        return;
      }
      
      setMatches(importedMatches);
      
      // Notify parent component
      if (onImportComplete) {
        onImportComplete(importedMatches);
      }
    } catch (err) {
      setError(`Import error: ${err.message}`);
    }
  };
  
  // Format time for display
  const formatTimeSlot = (timeSlot) => {
    // Check if timeSlot is a time value (e.g. 930 for 9:30)
    if (timeSlot >= 100) {
      const hours = Math.floor(timeSlot / 100);
      const minutes = timeSlot % 100;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return timeSlot;
  };
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Import Match Schedule</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Paste match schedule data or upload a CSV file. Supports various formats including:
          <br />
          • Round, Division, Time, Home Team, Away Team, Court, Team Referee
          <br />
          • Supports division blocks and mixed formats
        </p>
        
        <textarea
          className="w-full h-48 p-2 border border-gray-300 rounded"
          value={inputData}
          onChange={handleInputChange}
          onPaste={handlePaste}
          placeholder="Paste schedule data from spreadsheet here..."
        ></textarea>
      </div>
      
      <div className="mb-4 flex items-center gap-4">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="text-sm"
        />
        
        <button
          onClick={handleImport}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Import Schedule
        </button>
      </div>
      
      {error && (
        <div className="p-2 mb-4 bg-red-100 border border-red-300 text-red-500 rounded">
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