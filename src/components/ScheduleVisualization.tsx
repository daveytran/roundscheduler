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

  useEffect(() => {
    if (schedule) {
      setViolations(schedule.violations || []);
    }
  }, [schedule]);

  // Detect violations for a specific match (same logic as ImportSchedule)
  const detectViolations = (match: Match, allMatches: Match[]): ViolationInfo[] => {
    const violations: ViolationInfo[] = [];
    const sortedMatches = [...allMatches].sort((a, b) => a.timeSlot - b.timeSlot);
    const currentIndex = sortedMatches.findIndex(m => m === match);

    // Get all teams involved in this match (including referee)
    const teamsInMatch = [match.team1.name, match.team2.name];
    if (match.refereeTeam) {
      teamsInMatch.push(match.refereeTeam.name);
    }

    // Check for consecutive games (TEAMS)
    for (const teamName of teamsInMatch) {
      let consecutiveCount = 0;
      let currentStreak = 0;

      // Count consecutive games around current match
      for (let i = 0; i < sortedMatches.length; i++) {
        const m = sortedMatches[i];
        const isTeamInvolved =
          m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

        if (isTeamInvolved) {
          currentStreak++;
          if (i === currentIndex) {
            consecutiveCount = currentStreak;
          }
        } else {
          if (i < currentIndex) {
            currentStreak = 0;
          } else if (i > currentIndex) {
            break;
          }
        }
      }

      // Also check backwards from current position
      let backwardStreak = 0;
      for (let i = currentIndex; i >= 0; i--) {
        const m = sortedMatches[i];
        const isTeamInvolved =
          m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

        if (isTeamInvolved) {
          backwardStreak++;
        } else {
          break;
        }
      }

      // Check forward from current position
      let forwardStreak = 0;
      for (let i = currentIndex; i < sortedMatches.length; i++) {
        const m = sortedMatches[i];
        const isTeamInvolved =
          m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName;

        if (isTeamInvolved) {
          forwardStreak++;
        } else {
          break;
        }
      }

      const totalConsecutive = Math.max(consecutiveCount, backwardStreak + forwardStreak - 1);

      if (totalConsecutive >= 3) {
        violations.push({
          type: 'critical',
          message: `${teamName}: ${totalConsecutive} consecutive games`,
        });
      } else if (totalConsecutive === 2) {
        violations.push({
          type: 'warning',
          message: `${teamName}: 2 back-to-back games`,
        });
      }
    }

    // Check for consecutive games (PLAYERS) - Same color scheme as teams
    const playersInMatch: string[] = [];
    if (match.team1.players) {
      playersInMatch.push(...match.team1.players.map(p => p.name));
    }
    if (match.team2.players) {
      playersInMatch.push(...match.team2.players.map(p => p.name));
    }

    for (const playerName of playersInMatch) {
      // Get all matches where this player is involved
      const playerMatches = sortedMatches.filter(m => {
        const team1Players = m.team1.players?.map(p => p.name) || [];
        const team2Players = m.team2.players?.map(p => p.name) || [];
        return team1Players.includes(playerName) || team2Players.includes(playerName);
      });

      if (playerMatches.length < 2) continue;

      const playerMatchesSorted = playerMatches.sort((a, b) => a.timeSlot - b.timeSlot);
      const currentPlayerIndex = playerMatchesSorted.findIndex(m => m === match);

      if (currentPlayerIndex === -1) continue;

      // Use the same logic as team detection - check for consecutive time slots
      let consecutiveCount = 0;
      let currentStreak = 0;

      // Count consecutive games around current match
      for (let i = 0; i < playerMatchesSorted.length; i++) {
        const m = playerMatchesSorted[i];
        const isConsecutive = i === 0 || m.timeSlot === playerMatchesSorted[i - 1].timeSlot + 1;

        if (isConsecutive) {
          currentStreak++;
          if (i === currentPlayerIndex) {
            consecutiveCount = currentStreak;
          }
        } else {
          if (i < currentPlayerIndex) {
            currentStreak = 1; // Reset streak but count current match
          } else if (i > currentPlayerIndex) {
            break;
          }
        }
      }

      // Also check backwards from current position
      let backwardStreak = 0;
      for (let i = currentPlayerIndex; i >= 0; i--) {
        const m = playerMatchesSorted[i];
        const prevMatch = i > 0 ? playerMatchesSorted[i - 1] : null;

        if (!prevMatch || m.timeSlot === prevMatch.timeSlot + 1) {
          backwardStreak++;
        } else {
          break;
        }
      }

      // Check forward from current position
      let forwardStreak = 0;
      for (let i = currentPlayerIndex; i < playerMatchesSorted.length; i++) {
        const m = playerMatchesSorted[i];
        const nextMatch = i < playerMatchesSorted.length - 1 ? playerMatchesSorted[i + 1] : null;

        if (!nextMatch || nextMatch.timeSlot === m.timeSlot + 1) {
          forwardStreak++;
        } else {
          break;
        }
      }

      const totalConsecutive = Math.max(consecutiveCount, backwardStreak + forwardStreak - 1);

      if (totalConsecutive >= 3) {
        violations.push({
          type: 'critical',
          message: `Player ${playerName}: ${totalConsecutive} consecutive games`,
        });
      } else if (totalConsecutive === 2) {
        violations.push({
          type: 'warning',
          message: `Player ${playerName}: 2 back-to-back games`,
        });
      }
    }

    // Check venue time limits (if teams play too long at same venue)
    const venueMatches = sortedMatches.filter(m => m.field === match.field);
    for (const teamName of teamsInMatch) {
      const teamVenueMatches = venueMatches.filter(
        m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName
      );

      if (teamVenueMatches.length >= 3) {
        const timeSpan = teamVenueMatches[teamVenueMatches.length - 1].timeSlot - teamVenueMatches[0].timeSlot;
        if (timeSpan <= 3) {
          // If 3+ games within 3 time slots
          violations.push({
            type: 'warning',
            message: `${teamName}: Extended time at ${match.field}`,
          });
        }
      }
    }

    return violations;
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
          <h3 className="font-bold text-amber-800 mb-2">Schedule Violations (Score: {schedule.score})</h3>
          <ul className="list-disc pl-5 text-sm">
            {violations.map((v: RuleViolation, i: number) => (
              <li key={i} className="text-amber-700">
                {v.rule}: {v.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewMode === 'by_time' ? (
        <div className="space-y-6">
          {timeSlots.map((slot: number) => (
            <div key={slot} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">Time Slot {slot}</div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(groupedMatches[slot] || []).map((match: Match, idx: number) => {
                  const scheduleViolations = detectViolations(match, schedule.matches);
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
                          {scheduleViolations.map((violation, vIndex) => (
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
                        const scheduleViolations = detectViolations(match, schedule.matches);
                        const hasLegacyViolation = matchHasViolations(match);
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
                                  {scheduleViolations.map((violation, vIndex) => (
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
