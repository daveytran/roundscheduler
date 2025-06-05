import { useState } from 'react';
import { importPlayers } from '../lib/importUtils';
import { Team } from '../models/Team';

export default function ImportPlayers({ onImportComplete }) {
  const [inputData, setInputData] = useState('');
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(null);
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
        setError('Please paste or upload player data');
        return;
      }
      
      const importedPlayers = importPlayers(inputData);
      
      if (importedPlayers.length === 0) {
        setError('No valid player data found');
        return;
      }
      
      setPlayers(importedPlayers);
      
      // Create teams from players
      const importedTeams = Team.createTeamsFromPlayers(importedPlayers);
      setTeams(importedTeams);
      
      // Notify parent component of successful import
      if (onImportComplete) {
        onImportComplete(importedPlayers, importedTeams);
      }
    } catch (err) {
      setError(`Import error: ${err.message}`);
    }
  };
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Import Players</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Paste player data or upload a CSV file with columns:
          <br />
          Player Name, Mixed Division Team, Gendered Team, Cloth Team
        </p>
        
        <textarea
          className="w-full h-48 p-2 border border-gray-300 rounded"
          value={inputData}
          onChange={handleInputChange}
          onPaste={handlePaste}
          placeholder="Paste player data from spreadsheet here..."
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
          Import Players
        </button>
      </div>
      
      {error && (
        <div className="p-2 mb-4 bg-red-100 border border-red-300 text-red-500 rounded">
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