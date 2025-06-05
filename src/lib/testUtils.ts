import { Team } from '../models/Team';
import { Match } from '../models/Match';
import { Player } from '../models/Player';
import { Division, TeamsMap } from '../models/Team';
import { RuleViolation } from '@/src/models/RuleViolation';

/**
 * Create a mock team with optional players
 */
export function createMockTeam(name: string, division: Division = 'mixed', playerNames: string[] = []): Team {
  const team = new Team(name, division);
  playerNames.forEach(playerName => {
    team.addPlayer(new Player(playerName, division, 'cloth'));
  });
  return team;
}

/**
 * Create a mock match
 */
export function createMockMatch(
  team1Name: string,
  team2Name: string,
  timeSlot: number,
  field: string = 'Field 1',
  division: Division = 'mixed',
  refereeTeamName?: string
): Match {
  const team1 = createMockTeam(team1Name, division, [`${team1Name} Player 1`, `${team1Name} Player 2`]);
  const team2 = createMockTeam(team2Name, division, [`${team2Name} Player 1`, `${team2Name} Player 2`]);
  const refereeTeam = refereeTeamName ? createMockTeam(refereeTeamName, division) : null;

  return new Match(team1, team2, timeSlot, field, division, refereeTeam);
}

/**
 * Create multiple mock matches
 */
export function createMockMatches(
  matchData: Array<{
    team1: string;
    team2: string;
    timeSlot: number;
    field?: string;
    division?: Division;
    referee?: string;
  }>
): Match[] {
  return matchData.map(data =>
    createMockMatch(
      data.team1,
      data.team2,
      data.timeSlot,
      data.field || 'Field 1',
      data.division || 'mixed',
      data.referee
    )
  );
}

/**
 * Create a mock teams map
 */
export function createMockTeamsMap(teamsByDivision: {
  mixed?: string[];
  gendered?: string[];
  cloth?: string[];
}): TeamsMap {
  const teamsMap: TeamsMap = {
    mixed: {},
    gendered: {},
    cloth: {},
  };

  Object.entries(teamsByDivision).forEach(([division, teamNames]) => {
    if (teamNames) {
      teamNames.forEach(teamName => {
        teamsMap[division as Division][teamName] = createMockTeam(teamName, division as Division);
      });
    }
  });

  return teamsMap;
}

/**
 * Create test data for common violation scenarios
 */
export const testScenarios = {
  // Field conflicts - multiple matches on same field at same time
  fieldConflicts: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 1' }, // Conflict!
    ]),

  // Team playing multiple matches simultaneously
  teamPlayingConflicts: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 1, field: 'Field 2' }, // Team A conflict!
    ]),

  // Team refereeing multiple matches simultaneously
  teamRefereeingConflicts: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', referee: 'Team C' },
      { team1: 'Team D', team2: 'Team E', timeSlot: 1, field: 'Field 2', referee: 'Team C' }, // Team C referee conflict!
    ]),

  // Team playing and refereeing simultaneously
  playingAndRefereeingConflicts: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 2', referee: 'Team A' }, // Team A conflict!
    ]),

  // Back-to-back games
  backToBackGames: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' }, // Team A back-to-back
    ]),

  // Three consecutive games
  threeConsecutiveGames: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 2, field: 'Field 1' },
      { team1: 'Team A', team2: 'Team D', timeSlot: 3, field: 'Field 1' }, // Team A three in a row
    ]),

  // Valid schedule with no conflicts
  validSchedule: () =>
    createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', referee: 'Team E' },
      { team1: 'Team C', team2: 'Team D', timeSlot: 1, field: 'Field 2', referee: 'Team F' },
      { team1: 'Team A', team2: 'Team C', timeSlot: 3, field: 'Field 1', referee: 'Team G' },
      { team1: 'Team E', team2: 'Team F', timeSlot: 4, field: 'Field 2', referee: 'Team H' },
    ]),

  // Complex scenario with multiple types of violations
  complexViolations: () =>
    createMockMatches([
      // Time slot 1 - Field conflict and team playing conflict
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1', referee: 'Team E' },
      { team1: 'Team C', team2: 'Team A', timeSlot: 1, field: 'Field 1', referee: 'Team F' }, // Field + Team A conflict

      // Time slot 2 - Referee conflict and playing+refereeing conflict
      { team1: 'Team B', team2: 'Team C', timeSlot: 2, field: 'Field 1', referee: 'Team D' },
      { team1: 'Team E', team2: 'Team F', timeSlot: 2, field: 'Field 2', referee: 'Team D' }, // Team D referee conflict
      { team1: 'Team G', team2: 'Team H', timeSlot: 2, field: 'Field 3', referee: 'Team B' }, // Team B playing + refereeing

      // Time slot 3 - Creating consecutive games for Team A
      { team1: 'Team A', team2: 'Team G', timeSlot: 3, field: 'Field 1' }, // Team A three consecutive (1,2,3)
    ]),
};

/**
 * Helper to extract violation messages from violation objects
 */
export function extractViolationMessages(violations: Array<RuleViolation>): string[] {
  return violations.map(v => v.description);
}

/**
 * Helper to check if violations contain specific patterns
 */
export function hasViolationType(violations: Array<{ message: string }>, pattern: string): boolean {
  return violations.some(v => v.message.toLowerCase().includes(pattern.toLowerCase()));
}
