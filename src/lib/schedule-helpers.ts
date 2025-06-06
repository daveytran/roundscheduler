/**
 * Helper functions for schedule rule evaluation
 * These functions are available in the rule evaluation context as ScheduleHelpers
 */

import { Match } from '../models/Match';
import { Player } from '../models/Player';
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
   * Groups matches by player name
   * @param matches Array of matches to group
   * @returns Object with player names as keys and match arrays as values
   */
  groupMatchesByPlayer(matches: Match[]): Record<string, Match[]> {
    const playerMatches: Record<string, Match[]> = {};

    matches.forEach(match => {
      // Get all players from both teams
      const allPlayers = [...match.team1.players, ...match.team2.players];

      allPlayers.forEach(player => {
        if (!playerMatches[player.name]) {
          playerMatches[player.name] = [];
        }
        playerMatches[player.name].push(match);
      });
    });

    return playerMatches;
  },

  /**
   * Gets all players participating in a specific match
   * @param match The match to extract players from
   * @returns Array of players in the match
   */
  getPlayersInMatch(match: Match): Player[] {
    return [...match.team1.players, ...match.team2.players];
  },

  /**
   * Gets all matches for a specific team
   * @param schedule The schedule to search
   * @param teamName Name of the team
   * @returns Array of matches involving this team
   */
  getTeamMatches(schedule: Schedule, teamName: string): Match[] {
    const matches = schedule.matches ?? [];
    return matches.filter(match => match.team1.name === teamName || match.team2.name === teamName);
  },

  /**
   * Gets all matches for a specific player
   * @param schedule The schedule to search
   * @param playerName Name of the player
   * @returns Array of matches involving this player
   */
  getPlayerMatches(schedule: Schedule, playerName: string): Match[] {
    const matches = schedule.matches ?? [];
    return matches.filter(match => {
      const allPlayers = [...match.team1.players, ...match.team2.players];
      return allPlayers.some(player => player.name === playerName);
    });
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
   * @param level Severity level (optional)
   * @returns Formatted violation object
   */
  createViolation(
    rule: string,
    description: string,
    matches?: Match[],
    level: 'note' | 'warning' | 'alert' | 'critical' = 'warning'
  ): RuleViolation {
    return {
      rule,
      description,
      matches,
      level,
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
   * Gets schedule statistics
   * @param schedule The schedule to analyze
   * @returns Object with various schedule statistics
   */
  getScheduleStats(schedule: Schedule): {
    totalMatches: number;
    totalPlayers: number;
    matchesPerTimeSlot: Record<number, number>;
    matchesPerField: Record<string, number>;
    matchesPerDivision: Record<string, number>;
    playersPerTeam: Record<string, number>;
  } {
    const matches = schedule.matches ?? [];
    const stats = {
      totalMatches: matches.length,
      totalPlayers: 0,
      matchesPerTimeSlot: {} as Record<number, number>,
      matchesPerField: {} as Record<string, number>,
      matchesPerDivision: {} as Record<string, number>,
      playersPerTeam: {} as Record<string, number>,
    };

    const uniquePlayers = new Set<string>();

    matches.forEach(match => {
      // Count time slots
      stats.matchesPerTimeSlot[match.timeSlot] = (stats.matchesPerTimeSlot[match.timeSlot] || 0) + 1;

      // Count fields
      stats.matchesPerField[match.field] = (stats.matchesPerField[match.field] || 0) + 1;

      // Count divisions
      stats.matchesPerDivision[match.division] = (stats.matchesPerDivision[match.division] || 0) + 1;

      // Count players per team and unique players
      [match.team1, match.team2].forEach(team => {
        stats.playersPerTeam[team.name] = team.players.length;
        team.players.forEach(player => uniquePlayers.add(player.name));
      });
    });

    stats.totalPlayers = uniquePlayers.size;
    return stats;
  },
};

// Helper function to convert the helpers to a string for Monaco
export function getScheduleHelpersAsString(): string {
  return `
const ScheduleHelpers = {
  groupMatchesByTeam: ${ScheduleHelpers.groupMatchesByTeam.toString()},
  groupMatchesByField: ${ScheduleHelpers.groupMatchesByField.toString()},
  groupMatchesByPlayer: ${ScheduleHelpers.groupMatchesByPlayer.toString()},
  getPlayersInMatch: ${ScheduleHelpers.getPlayersInMatch.toString()},
  getTeamMatches: ${ScheduleHelpers.getTeamMatches.toString()},
  getPlayerMatches: ${ScheduleHelpers.getPlayerMatches.toString()},
  areConsecutive: ${ScheduleHelpers.areConsecutive.toString()},
  createViolation: ${ScheduleHelpers.createViolation.toString()},
  groupMatchesByDivision: ${ScheduleHelpers.groupMatchesByDivision.toString()},
  getScheduleStats: ${ScheduleHelpers.getScheduleStats.toString()}
};
`;
}
