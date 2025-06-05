/**
 * Helper functions for schedule rule evaluation
 * These functions are available in the rule evaluation context as ScheduleHelpers
 */

import { Match } from '../models/Match';
import { RuleViolation } from '../models/RuleViolation';
import { Schedule } from '../models/Schedule';

// Type imports for better TypeScript support

export const ScheduleHelpers = {
  /**
   * Groups matches by team name
   * @param matches Array of matches to group
   * @returns Object with team names as keys and match arrays as values
   */
  groupMatchesByTeam(matches: Match[]): Record<string, Match[]> {
    const teamMatches: Record<string, Match[]> = {};

    matches.forEach(match => {
      // Add match to both teams
      [match.team1.name, match.team2.name].forEach(teamName => {
        if (!teamMatches[teamName]) {
          teamMatches[teamName] = [];
        }
        teamMatches[teamName].push(match);
      });
    });

    return teamMatches;
  },

  /**
   * Groups matches by field
   * @param matches Array of matches to group
   * @returns Object with field names as keys and match arrays as values
   */
  groupMatchesByField(matches: Match[]): Record<string, Match[]> {
    const fieldMatches: Record<string, Match[]> = {};

    matches.forEach(match => {
      if (!fieldMatches[match.field]) {
        fieldMatches[match.field] = [];
      }
      fieldMatches[match.field].push(match);
    });

    return fieldMatches;
  },

  /**
   * Gets all matches for a specific team
   * @param schedule The schedule to search
   * @param teamName Name of the team
   * @returns Array of matches involving this team
   */
  getTeamMatches(schedule: Schedule, teamName: string): Match[] {
    return schedule.matches.filter(match => match.team1.name === teamName || match.team2.name === teamName);
  },

  /**
   * Checks if two matches are consecutive (timeSlot difference of 1)
   * @param match1 First match
   * @param match2 Second match
   * @returns True if matches are consecutive
   */
  areConsecutive(match1: Match, match2: Match): boolean {
    return Math.abs(match1.timeSlot - match2.timeSlot) === 1;
  },

  /**
   * Creates a standardized violation object
   * @param rule Rule name
   * @param description Description of the violation
   * @param matches Matches involved (optional)
   * @param severity Severity level (optional)
   * @returns Formatted violation object
   */
  createViolation(rule: string, description: string, matches?: Match[], priority: number = 1): RuleViolation {
    return {
      rule,
      description,
      matches,
      priority,
    };
  },

  /**
   * Groups matches by division
   * @param matches Array of matches to group
   * @returns Object with division names as keys and match arrays as values
   */
  groupMatchesByDivision(matches: Match[]): Record<string, Match[]> {
    const divisionMatches: Record<string, Match[]> = {};

    matches.forEach(match => {
      if (!divisionMatches[match.division]) {
        divisionMatches[match.division] = [];
      }
      divisionMatches[match.division].push(match);
    });

    return divisionMatches;
  },

  /**
   * Gets matches in a specific time slot
   * @param schedule The schedule to search
   * @param timeSlot The time slot to filter by
   * @returns Array of matches in the specified time slot
   */
  getMatchesInTimeSlot(schedule: Schedule, timeSlot: number): Match[] {
    return schedule.matches.filter(match => match.timeSlot === timeSlot);
  },

  /**
   * Finds teams that have matches in consecutive time slots
   * @param schedule The schedule to analyze
   * @returns Array of objects with team name and consecutive matches
   */
  findConsecutiveMatches(schedule: Schedule): Array<{ teamName: string; matches: Match[] }> {
    const teamMatches = this.groupMatchesByTeam(schedule.matches);
    const consecutiveMatches: Array<{ teamName: string; matches: Match[] }> = [];

    Object.entries(teamMatches).forEach(([teamName, matches]) => {
      const sortedMatches = matches.sort((a, b) => a.timeSlot - b.timeSlot);

      for (let i = 0; i < sortedMatches.length - 1; i++) {
        if (this.areConsecutive(sortedMatches[i], sortedMatches[i + 1])) {
          consecutiveMatches.push({
            teamName,
            matches: [sortedMatches[i], sortedMatches[i + 1]],
          });
        }
      }
    });

    return consecutiveMatches;
  },

  /**
   * Calculates basic statistics about the schedule
   * @param schedule The schedule to analyze
   * @returns Object with various schedule statistics
   */
  getScheduleStats(schedule: Schedule) {
    const totalMatches = schedule.matches.length;
    const divisions = Array.from(new Set(schedule.matches.map(m => m.division)));
    const fields = Array.from(new Set(schedule.matches.map(m => m.field)));
    const timeSlots = Array.from(new Set(schedule.matches.map(m => m.timeSlot))).sort((a, b) => a - b);

    const fieldUsage = this.groupMatchesByField(schedule.matches);
    const divisionCounts = this.groupMatchesByDivision(schedule.matches);

    return {
      totalMatches,
      divisions: divisions.length,
      fields: fields.length,
      timeSlots: timeSlots.length,
      minTimeSlot: timeSlots[0] || 0,
      maxTimeSlot: timeSlots[timeSlots.length - 1] || 0,
      fieldUsage: Object.fromEntries(Object.entries(fieldUsage).map(([field, matches]) => [field, matches.length])),
      divisionCounts: Object.fromEntries(
        Object.entries(divisionCounts).map(([division, matches]) => [division, matches.length])
      ),
    };
  },
};

// Helper function to convert the helpers to a string for Monaco
export function getScheduleHelpersAsString(): string {
  return `
const ScheduleHelpers = {
  groupMatchesByTeam: ${ScheduleHelpers.groupMatchesByTeam.toString()},
  groupMatchesByField: ${ScheduleHelpers.groupMatchesByField.toString()},
  getTeamMatches: ${ScheduleHelpers.getTeamMatches.toString()},
  areConsecutive: ${ScheduleHelpers.areConsecutive.toString()},
  createViolation: ${ScheduleHelpers.createViolation.toString()},
  groupMatchesByDivision: ${ScheduleHelpers.groupMatchesByDivision.toString()},
  getMatchesInTimeSlot: ${ScheduleHelpers.getMatchesInTimeSlot.toString()},
  findConsecutiveMatches: ${ScheduleHelpers.findConsecutiveMatches.toString()},
  getScheduleStats: ${ScheduleHelpers.getScheduleStats.toString()}
};
`;
}
