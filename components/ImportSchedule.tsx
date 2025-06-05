import React, { useState } from 'react';
import { Importer, ImporterField } from 'react-csv-importer';
import 'react-csv-importer/dist/index.css';
import { parseCSV, importSchedule } from '../src/lib/importUtils';
import { Team, TeamsMap } from '../src/models/Team';
import { Match } from '../src/models/Match';

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

// Types for react-csv-importer callbacks
interface ImportInfo {
  file: File;
  fields: string[];
}

interface ImportComplete {
  file: File;
}

interface ViolationInfo {
  type: 'critical' | 'warning' | 'invalid';
  message: string;
}

interface HardConstraintViolation {
  type: 'invalid';
  message: string;
  matchIndex: number;
}

export default function ImportSchedule({ teams, onImportComplete }: ImportScheduleProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Detect violations for a specific match
  const detectViolations = (match: Match, allMatches: Match[]): ViolationInfo[] => {
    const violations: ViolationInfo[] = [];
    const sortedMatches = [...allMatches].sort((a, b) => a.timeSlot - b.timeSlot);
    const currentIndex = sortedMatches.findIndex(m => m === match);

    // Get all teams involved in this match (including referee)
    const teamsInMatch = [match.team1.name, match.team2.name];
    if (match.refereeTeam) {
      teamsInMatch.push(match.refereeTeam.name);
    }

    // Check for same-timeslot conflicts (CRITICAL - teams cannot be in multiple matches at once)
    const sameTimeSlotMatches = allMatches.filter(m => m.timeSlot === match.timeSlot && m !== match);

    // Check for field conflicts first
    const sameFieldMatches = sameTimeSlotMatches.filter(m => m.field === match.field);
    if (sameFieldMatches.length > 0) {
      violations.push({
        type: 'invalid',
        message: `Field conflict: Multiple matches on ${match.field} in time slot ${match.timeSlot}`,
      });
    }

    // Check team conflicts
    for (const teamName of teamsInMatch) {
      const conflictingMatches = sameTimeSlotMatches.filter(
        m => m.team1.name === teamName || m.team2.name === teamName || m.refereeTeam?.name === teamName
      );

      if (conflictingMatches.length > 0) {
        const isPlaying = match.team1.name === teamName || match.team2.name === teamName;
        const isRefereeing = match.refereeTeam?.name === teamName;

        // Count how many times this team appears in same time slot
        let playingConflicts = 0;
        let refereeingConflicts = 0;

        for (const conflictMatch of conflictingMatches) {
          if (conflictMatch.team1.name === teamName || conflictMatch.team2.name === teamName) {
            playingConflicts++;
          }
          if (conflictMatch.refereeTeam?.name === teamName) {
            refereeingConflicts++;
          }
        }

        if (isPlaying && playingConflicts > 0) {
          violations.push({
            type: 'invalid',
            message: `Team conflict: ${teamName} plays multiple matches in time slot ${match.timeSlot}`,
          });
        }

        if (isRefereeing && refereeingConflicts > 0) {
          violations.push({
            type: 'invalid',
            message: `Referee conflict: ${teamName} referees multiple matches in time slot ${match.timeSlot}`,
          });
        }

        if ((isPlaying && refereeingConflicts > 0) || (isRefereeing && playingConflicts > 0)) {
          violations.push({
            type: 'invalid',
            message: `Dual role conflict: ${teamName} cannot play and referee in time slot ${match.timeSlot}`,
          });
        }
      }
    }

    // Check for consecutive games
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
    if (violations.some(v => v.type === 'invalid')) {
      return 'bg-red-200 border-red-500';
    } else if (violations.some(v => v.type === 'critical')) {
      return 'bg-red-100 border-red-300';
    } else if (violations.some(v => v.type === 'warning')) {
      return 'bg-yellow-100 border-yellow-300';
    }
    return '';
  };

  // Check for hard constraint violations that make the schedule completely invalid
  const detectHardConstraintViolations = (matches: Match[]): HardConstraintViolation[] => {
    const violations: HardConstraintViolation[] = [];

    // Group matches by time slot for easier analysis
    const matchesByTimeSlot = new Map<number, Match[]>();
    matches.forEach((match, index) => {
      if (!matchesByTimeSlot.has(match.timeSlot)) {
        matchesByTimeSlot.set(match.timeSlot, []);
      }
      matchesByTimeSlot.get(match.timeSlot)!.push(match);
    });

    // Check each time slot for hard constraint violations
    matchesByTimeSlot.forEach((slotMatches, timeSlot) => {
      // Check for field conflicts (multiple matches on same field at same time)
      const fieldToMatches = new Map<string, Match[]>();
      slotMatches.forEach(match => {
        if (match.field) {
          if (!fieldToMatches.has(match.field)) {
            fieldToMatches.set(match.field, []);
          }
          fieldToMatches.get(match.field)!.push(match);
        }
      });

      fieldToMatches.forEach((fieldMatches, field) => {
        if (fieldMatches.length > 1) {
          violations.push({
            type: 'invalid',
            message: `Multiple matches scheduled on ${field} in time slot ${timeSlot}`,
            matchIndex: matches.indexOf(fieldMatches[0]),
          });
        }
      });

      // Check for team conflicts (teams playing/refereeing multiple matches at same time)
      const teamToRoles = new Map<string, { playing: Match[]; refereeing: Match[] }>();

      slotMatches.forEach(match => {
        // Track teams playing
        [match.team1.name, match.team2.name].forEach(teamName => {
          if (!teamToRoles.has(teamName)) {
            teamToRoles.set(teamName, { playing: [], refereeing: [] });
          }
          teamToRoles.get(teamName)!.playing.push(match);
        });

        // Track teams refereeing
        if (match.refereeTeam) {
          const refTeamName = match.refereeTeam.name;
          if (!teamToRoles.has(refTeamName)) {
            teamToRoles.set(refTeamName, { playing: [], refereeing: [] });
          }
          teamToRoles.get(refTeamName)!.refereeing.push(match);
        }
      });

      // Check for violations
      teamToRoles.forEach((roles, teamName) => {
        const { playing, refereeing } = roles;

        // Check if team is playing multiple matches
        if (playing.length > 1) {
          violations.push({
            type: 'invalid',
            message: `${teamName} is scheduled to play multiple matches in time slot ${timeSlot}`,
            matchIndex: matches.indexOf(playing[0]),
          });
        }

        // Check if team is refereeing multiple matches
        if (refereeing.length > 1) {
          violations.push({
            type: 'invalid',
            message: `${teamName} is scheduled to referee multiple matches in time slot ${timeSlot}`,
            matchIndex: matches.indexOf(refereeing[0]),
          });
        }

        // Check if team is playing and refereeing simultaneously
        if (playing.length >= 1 && refereeing.length >= 1) {
          violations.push({
            type: 'invalid',
            message: `${teamName} cannot play and referee simultaneously in time slot ${timeSlot}`,
            matchIndex: matches.indexOf(playing[0]),
          });
        }
      });
    });

    return violations;
  };

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

      // Check for hard constraint violations that make the schedule invalid
      const hardViolations = detectHardConstraintViolations(importedMatches);
      if (hardViolations.length > 0) {
        const violationMessages = hardViolations.map(v => v.message).join('\n• ');
        setError(
          `Schedule contains invalid constraints that cannot be optimized:\n\n• ${violationMessages}\n\nPlease fix these issues in your source data before importing.`
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
              onStart={({ file, fields }: ImportInfo) => {
                setError(null);
                console.log('Schedule import started:', { file: file.name, fields });
              }}
              onComplete={({ file }: ImportComplete) => {
                console.log('Schedule import completed:', { file: file.name });
              }}
            >
              <ImporterField name="timeSlot" label="Time Slot" optional />
              <ImporterField name="round" label="Round" optional />
              <ImporterField name="division" label="Division" optional />
              <ImporterField name="court" label="Court" optional />
              <ImporterField name="team1" label="Team 1" />
              <ImporterField name="team2" label="Team 2" />
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

          {/* Legend */}
          <div className="mb-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 border border-red-500 rounded"></div>
              <span>Invalid (schedule impossible - rejected during import)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span>Critical (3+ consecutive games)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>Warning (2 consecutive games, venue limits)</span>
            </div>
          </div>

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
                  <th className="p-2 text-left border">Violations</th>
                </tr>
              </thead>
              <tbody>
                {matches
                  .sort((a, b) => a.timeSlot - b.timeSlot)
                  .map((match, index) => {
                    const violations = detectViolations(match, matches);
                    const rowColor = getRowColor(violations);

                    return (
                      <tr key={index} className={`border-b ${rowColor}`}>
                        <td className="p-2 border">{formatTimeSlot(match.timeSlot)}</td>
                        <td className="p-2 border">{match.division}</td>
                        <td className="p-2 border">{match.field}</td>
                        <td className="p-2 border">{match.team1.name}</td>
                        <td className="p-2 border">{match.team2.name}</td>
                        <td className="p-2 border">{match.refereeTeam?.name || '-'}</td>
                        <td className="p-2 border">
                          {violations.length > 0 ? (
                            <div className="space-y-1">
                              {violations.map((violation, vIndex) => (
                                <div
                                  key={vIndex}
                                  className={`text-xs px-2 py-1 rounded ${
                                    violation.type === 'invalid'
                                      ? 'bg-red-300 text-red-900 font-bold'
                                      : violation.type === 'critical'
                                        ? 'bg-red-200 text-red-800'
                                        : 'bg-yellow-200 text-yellow-800'
                                  }`}
                                >
                                  {violation.message}
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
      )}
    </div>
  );
}
