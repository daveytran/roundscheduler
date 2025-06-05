import { useState, useEffect } from 'react';

export default function ScheduleVisualization({ schedule }) {
  const [violations, setViolations] = useState([]);
  const [viewMode, setViewMode] = useState('by_time');
  const [selectedDivision, setSelectedDivision] = useState('all');
  
  useEffect(() => {
    if (schedule) {
      setViolations(schedule.violations || []);
    }
  }, [schedule]);
  
  if (!schedule || !schedule.matches || schedule.matches.length === 0) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-4">Schedule Visualization</h2>
        <p className="text-gray-500">No schedule data to display</p>
      </div>
    );
  }
  
  // Get unique divisions
  const divisions = ['all', ...new Set(schedule.matches.map(match => match.division))];
  
  // Get unique fields
  const fields = [...new Set(schedule.matches.map(match => match.field))];
  
  // Get all time slots
  const timeSlots = [...new Set(schedule.matches.map(match => match.timeSlot))].sort((a, b) => a - b);
  
  // Filter matches by division if needed
  const filteredMatches = selectedDivision === 'all' 
    ? schedule.matches 
    : schedule.matches.filter(match => match.division === selectedDivision);
  
  // Group matches by time or field based on view mode
  const groupedMatches = {};
  
  if (viewMode === 'by_time') {
    filteredMatches.forEach(match => {
      if (!groupedMatches[match.timeSlot]) {
        groupedMatches[match.timeSlot] = [];
      }
      groupedMatches[match.timeSlot].push(match);
    });
  } else {
    filteredMatches.forEach(match => {
      if (!groupedMatches[match.field]) {
        groupedMatches[match.field] = [];
      }
      groupedMatches[match.field].push(match);
    });
  }
  
  // Helper to check if a match has violations
  const matchHasViolations = (match) => {
    return violations.some(v => 
      v.matches && v.matches.some(m => 
        (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
        (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
      )
    );
  };
  
  // Helper to get violation descriptions for a match
  const getViolationDescriptions = (match) => {
    return violations
      .filter(v => 
        v.matches && v.matches.some(m => 
          (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
          (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
        )
      )
      .map(v => v.description);
  };
  
  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Time Slot', 'Division', 'Field', 'Team 1', 'Team 2', 'Referee'];
    const rows = schedule.matches.map(match => [
      match.timeSlot,
      match.division,
      match.field,
      match.team1.name,
      match.team2.name,
      match.refereeTeam?.name || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'optimized_schedule.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Schedule Visualization</h2>
        
        <div className="flex items-center gap-4">
          <select 
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="p-2 border rounded"
          >
            {divisions.map(div => (
              <option key={div} value={div}>
                {div === 'all' ? 'All Divisions' : div.charAt(0).toUpperCase() + div.slice(1)}
              </option>
            ))}
          </select>
          
          <div className="flex border rounded overflow-hidden">
            <button
              onClick={() => setViewMode('by_time')}
              className={`px-3 py-1 ${viewMode === 'by_time' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              By Time
            </button>
            <button
              onClick={() => setViewMode('by_field')}
              className={`px-3 py-1 ${viewMode === 'by_field' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              By Field
            </button>
          </div>
          
          <button
            onClick={handleExportCSV}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export CSV
          </button>
        </div>
      </div>
      
      {schedule.score > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <h3 className="font-bold text-amber-800 mb-2">
            Schedule Violations (Score: {schedule.score})
          </h3>
          <ul className="list-disc pl-5 text-sm">
            {violations.map((v, i) => (
              <li key={i} className="text-amber-700">
                {v.rule}: {v.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {viewMode === 'by_time' ? (
        <div className="space-y-6">
          {timeSlots.map(slot => (
            <div key={slot} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">
                Time Slot {slot}
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(groupedMatches[slot] || []).map((match, idx) => {
                  const hasViolation = matchHasViolations(match);
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 border rounded ${hasViolation ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    >
                      <div className="font-bold mb-1">{match.field}</div>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`${hasViolation ? 'text-red-600 font-semibold' : ''}`}>
                          {match.team1.name}
                        </span>
                        <span>vs</span>
                        <span className={`${hasViolation ? 'text-red-600 font-semibold' : ''}`}>
                          {match.team2.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {match.division}, {match.refereeTeam ? `Ref: ${match.refereeTeam.name}` : 'No referee'}
                      </div>
                      {hasViolation && (
                        <div className="mt-2 text-xs text-red-500">
                          {getViolationDescriptions(match).map((desc, i) => (
                            <div key={i}>⚠️ {desc}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {fields.map(field => (
            <div key={field} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">
                {field}
              </div>
              <div className="p-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left border">Time Slot</th>
                      <th className="p-2 text-left border">Division</th>
                      <th className="p-2 text-left border">Team 1</th>
                      <th className="p-2 text-left border">Team 2</th>
                      <th className="p-2 text-left border">Referee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupedMatches[field] || [])
                      .sort((a, b) => a.timeSlot - b.timeSlot)
                      .map((match, idx) => {
                        const hasViolation = matchHasViolations(match);
                        return (
                          <tr 
                            key={idx} 
                            className={`border-b ${hasViolation ? 'bg-red-50' : ''}`}
                          >
                            <td className="p-2 border">{match.timeSlot}</td>
                            <td className="p-2 border">{match.division}</td>
                            <td className={`p-2 border ${hasViolation ? 'text-red-600 font-semibold' : ''}`}>
                              {match.team1.name}
                            </td>
                            <td className={`p-2 border ${hasViolation ? 'text-red-600 font-semibold' : ''}`}>
                              {match.team2.name}
                            </td>
                            <td className="p-2 border">{match.refereeTeam?.name || '-'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}