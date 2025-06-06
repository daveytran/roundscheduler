import React, { useState, useEffect } from 'react';
import { Schedule } from '../models/Schedule';
import { Match } from '../models/Match';
import { RuleViolation } from '../models/RuleViolation';

interface ScheduleVisualizationProps {
  schedule: Schedule;
}

interface GroupedMatches {
  [key: string]: Match[];
}

interface GroupedMatchesByTime {
  [timeSlot: number]: Match[];
}

interface ViolationInfo {
  type: 'critical' | 'warning';
  message: string;
}

export default function ScheduleVisualization({ schedule }: ScheduleVisualizationProps) {
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [viewMode, setViewMode] = useState<'by_time' | 'by_field'>('by_time');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [isViolationsExpanded, setIsViolationsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (schedule) {
      setViolations(schedule.violations || []);
    }
  }, [schedule]);

  // Get violations for a specific match using the rule system
  const getMatchViolations = (match: Match): ViolationInfo[] => {
    const matchViolations: ViolationInfo[] = [];

    // Check schedule violations that involve this match
    schedule.violations?.forEach(violation => {
      if (
        violation.matches &&
        violation.matches.some(
          m =>
            m.timeSlot === match.timeSlot &&
            m.field === match.field &&
            m.team1.name === match.team1.name &&
            m.team2.name === match.team2.name
        )
      ) {
        // Convert priority to severity type
        const type = (violation.priority || 1) >= 10 ? 'critical' : 'warning';
        matchViolations.push({
          type,
          message: violation.description,
        });
      }
    });

    return matchViolations;
  };

  // Get row color based on violations
  const getRowColor = (violations: ViolationInfo[]): string => {
    if (violations.some(v => v.type === 'critical')) {
      return 'bg-red-100 border-red-300';
    } else if (violations.some(v => v.type === 'warning')) {
      return 'bg-yellow-100 border-yellow-300';
    }
    return '';
  };

  // Get card color based on violations
  const getCardColor = (violations: ViolationInfo[]): string => {
    if (violations.some(v => v.type === 'critical')) {
      return 'border-red-300 bg-red-50';
    } else if (violations.some(v => v.type === 'warning')) {
      return 'border-yellow-300 bg-yellow-50';
    }
    return 'border-gray-200';
  };

  if (!schedule || !schedule.matches || schedule.matches.length === 0) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-4">Schedule Visualization</h2>
        <p className="text-gray-500">No schedule data to display</p>
      </div>
    );
  }

  // Get unique divisions
  const divisions: string[] = ['all', ...Array.from(new Set(schedule.matches.map((match: Match) => match.division)))];

  // Get unique fields
  const fields: string[] = Array.from(new Set(schedule.matches.map((match: Match) => match.field)));

  // Get all time slots
  const timeSlots: number[] = Array.from(new Set(schedule.matches.map((match: Match) => match.timeSlot))).sort(
    (a: number, b: number) => a - b
  );

  // Filter matches by division if needed
  const filteredMatches: Match[] =
    selectedDivision === 'all'
      ? schedule.matches
      : schedule.matches.filter((match: Match) => match.division === selectedDivision);

  // Group matches by time or field based on view mode
  const groupedMatches: GroupedMatches = {};

  if (viewMode === 'by_time') {
    filteredMatches.forEach((match: Match) => {
      if (!groupedMatches[match.timeSlot]) {
        groupedMatches[match.timeSlot] = [];
      }
      groupedMatches[match.timeSlot].push(match);
    });
  } else {
    filteredMatches.forEach((match: Match) => {
      if (!groupedMatches[match.field]) {
        groupedMatches[match.field] = [];
      }
      groupedMatches[match.field].push(match);
    });
  }

  // Helper to check if a match has violations (legacy system)
  const matchHasViolations = (match: Match): boolean => {
    return violations.some(
      (v: RuleViolation) =>
        v.matches &&
        v.matches.some(
          (m: Match) =>
            (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
            (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
        )
    );
  };

  // Helper to get violation descriptions for a match (legacy system)
  const getViolationDescriptions = (match: Match): string[] => {
    return violations
      .filter(
        (v: RuleViolation) =>
          v.matches &&
          v.matches.some(
            (m: Match) =>
              (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
              (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
          )
      )
      .map((v: RuleViolation) => v.description);
  };

  const handleExportCSV = (): void => {
    // Create CSV content
    const headers = ['Time Slot', 'Division', 'Field', 'Team 1', 'Team 2', 'Referee'];
    const rows = schedule.matches.map((match: Match) => [
      match.timeSlot,
      match.division,
      match.field,
      match.team1.name,
      match.team2.name,
      match.refereeTeam?.name || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row: (string | number)[]) => row.join(','))].join('\n');

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
            onChange={e => setSelectedDivision(e.target.value)}
            className="p-2 border rounded"
          >
            {divisions.map((div: string) => (
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

          <button onClick={handleExportCSV} className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            Export CSV
          </button>
        </div>
      </div>

      {/* Color Legend */}
      <div className="mb-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
          <span>Critical (3+ consecutive games for teams/players)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span>Warning (2 consecutive games for teams/players, venue limits)</span>
        </div>
      </div>

      {schedule.score > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <button
            onClick={() => setIsViolationsExpanded(!isViolationsExpanded)}
            className="flex items-center justify-between w-full text-left hover:bg-amber-100 rounded p-1 -m-1"
          >
            <h3 className="font-bold text-amber-800">
              Schedule Violations (Score: {schedule.score}) - {violations.length} violation
              {violations.length !== 1 ? 's' : ''}
            </h3>
            <svg
              className={`w-5 h-5 text-amber-800 transform transition-transform ${isViolationsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isViolationsExpanded && (
            <ul className="list-disc pl-5 text-sm mt-2">
              {violations.map((v: RuleViolation, i: number) => (
                <li key={i} className="text-amber-700">
                  {v.rule}: {v.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewMode === 'by_time' ? (
        <div className="space-y-6">
          {timeSlots.map((slot: number) => (
            <div key={slot} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">Time Slot {slot}</div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(groupedMatches[slot] || []).map((match: Match, idx: number) => {
                  const scheduleViolations = getMatchViolations(match);
                  const hasLegacyViolation = matchHasViolations(match);
                  return (
                    <div
                      key={idx}
                      className={`p-3 border rounded ${getCardColor(scheduleViolations)} ${hasLegacyViolation && scheduleViolations.length === 0 ? 'border-red-300 bg-red-50' : ''}`}
                    >
                      <div className="font-bold mb-1">{match.field}</div>
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className={`${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                        >
                          {match.team1.name}
                        </span>
                        <span>vs</span>
                        <span
                          className={`${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                        >
                          {match.team2.name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {match.division}, {match.refereeTeam ? `Ref: ${match.refereeTeam.name}` : 'No referee'}
                      </div>

                      {/* Show schedule violations */}
                      {scheduleViolations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {scheduleViolations.map((violation: ViolationInfo, vIndex: number) => (
                            <div
                              key={vIndex}
                              className={`text-xs px-2 py-1 rounded ${
                                violation.type === 'critical'
                                  ? 'bg-red-200 text-red-800'
                                  : 'bg-yellow-200 text-yellow-800'
                              }`}
                            >
                              {violation.message}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show legacy violations */}
                      {hasLegacyViolation && scheduleViolations.length === 0 && (
                        <div className="mt-2 text-xs text-red-500">
                          {getViolationDescriptions(match).map((desc: string, i: number) => (
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
          {fields.map((field: string) => (
            <div key={field} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">{field}</div>
              <div className="p-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left border">Time Slot</th>
                      <th className="p-2 text-left border">Division</th>
                      <th className="p-2 text-left border">Team 1</th>
                      <th className="p-2 text-left border">Team 2</th>
                      <th className="p-2 text-left border">Referee</th>
                      <th className="p-2 text-left border">Violations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupedMatches[field] || [])
                      .sort((a: Match, b: Match) => a.timeSlot - b.timeSlot)
                      .map((match: Match, idx: number) => {
                        const scheduleViolations = getMatchViolations(match);
                        const hasLegacyViolation = false;
                        const rowColor = getRowColor(scheduleViolations);
                        return (
                          <tr
                            key={idx}
                            className={`border-b ${rowColor} ${hasLegacyViolation && scheduleViolations.length === 0 ? 'bg-red-50' : ''}`}
                          >
                            <td className="p-2 border">{match.timeSlot}</td>
                            <td className="p-2 border">{match.division}</td>
                            <td
                              className={`p-2 border ${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                            >
                              {match.team1.name}
                            </td>
                            <td
                              className={`p-2 border ${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                            >
                              {match.team2.name}
                            </td>
                            <td className="p-2 border">{match.refereeTeam?.name || '-'}</td>
                            <td className="p-2 border">
                              {scheduleViolations.length > 0 ? (
                                <div className="space-y-1">
                                  {scheduleViolations.map((violation: ViolationInfo, vIndex: number) => (
                                    <div
                                      key={vIndex}
                                      className={`text-xs px-2 py-1 rounded ${
                                        violation.type === 'critical'
                                          ? 'bg-red-200 text-red-800'
                                          : 'bg-yellow-200 text-yellow-800'
                                      }`}
                                    >
                                      {violation.message}
                                    </div>
                                  ))}
                                </div>
                              ) : hasLegacyViolation ? (
                                <div className="space-y-1">
                                  {getViolationDescriptions(match).map((desc: string, i: number) => (
                                    <div key={i} className="text-xs px-2 py-1 rounded bg-red-200 text-red-800">
                                      {desc}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
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
