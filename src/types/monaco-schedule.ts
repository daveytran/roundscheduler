/**
 * TypeScript declarations for the Monaco editor rule evaluation context
 * These types represent the objects available when writing schedule rules
 */

/**
 * Represents a team in the tournament
 */
export interface Team {
  /** The team's name */
  name: string;
  /** Division the team plays in */
  division: 'mixed' | 'gendered' | 'cloth';
  /** Array of players on this team */
  players: Player[];
}

/**
 * Represents a player in the tournament
 */
export interface Player {
  /** Player's full name */
  name: string;
  /** Team name for mixed division (optional) */
  mixedTeam?: string;
  /** Team name for gendered division (optional) */
  genderedTeam?: string;
  /** Team name for cloth division (optional) */
  clothTeam?: string;
}

/**
 * Represents a match between two teams or a special activity
 */
export interface Match {
  /** First team in the match */
  team1: Team;
  /** Second team in the match */
  team2: Team;
  /** Numeric time slot (lower numbers = earlier times) */
  timeSlot: number;
  /** Field/court identifier where match is played */
  field: string;
  /** Division this match belongs to */
  division: 'mixed' | 'gendered' | 'cloth';
  /** Team assigned to referee this match (null if no referee) */
  refereeTeam: Team | null;
  /** Type of activity - SETUP, PACKING_DOWN, or REGULAR match */
  activityType: 'SETUP' | 'PACKING_DOWN' | 'REGULAR';
}

/**
 * Represents a rule violation found in the schedule
 */
export interface RuleViolation {
  /** Name of the rule that was violated */
  rule: string;
  /** Human-readable description of the violation */
  description: string;
  /** Array of matches involved in the violation (optional) */
  matches?: Match[];
  /** Severity level of the violation */
  level: 'note' | 'warning' | 'alert' | 'critical';
}

/**
 * Represents the complete tournament schedule
 */
export interface Schedule {
  /** Array of all matches in the tournament */
  matches: Match[];
  /** Array of scheduling rules applied to this schedule */
  rules: any[];
  /** Array of rule violations found in this schedule */
  violations: RuleViolation[];
  /** Overall score (lower is better, 0 = no violations) */
  score: number;

  /**
   * Evaluate all rules and calculate the score
   * @returns The calculated score (lower is better)
   */
  evaluate(): number;

  /**
   * Create a randomized version of this schedule
   * @returns A new randomized schedule
   */
  randomize(): Schedule;
}

/**
 * Utility type for creating violations more easily
 */
export interface ViolationBuilder {
  rule: string;
  description: string;
  matches?: Match[];
  level?: 'note' | 'warning' | 'alert' | 'critical';
}

/**
 * Helper functions available in the rule evaluation context
 */
declare namespace ScheduleHelpers {
  /**
   * Groups matches by team name
   * @param matches Array of matches to group
   * @returns Object with team names as keys and match arrays as values
   */
  function groupMatchesByTeam(matches: Match[]): Record<string, Match[]>;

  /**
   * Groups matches by field
   * @param matches Array of matches to group
   * @returns Object with field names as keys and match arrays as values
   */
  function groupMatchesByField(matches: Match[]): Record<string, Match[]>;

  /**
   * Groups matches by player name - NEW for player-based rules
   * @param matches Array of matches to group
   * @returns Object with player names as keys and match arrays as values
   */
  function groupMatchesByPlayer(matches: Match[]): Record<string, Match[]>;

  /**
   * Gets all players participating in a specific match - NEW for player-based rules
   * @param match The match to extract players from
   * @returns Array of players in the match
   */
  function getPlayersInMatch(match: Match): Player[];

  /**
   * Gets all matches for a specific team
   * @param schedule The schedule to search
   * @param teamName Name of the team
   * @returns Array of matches involving this team
   */
  function getTeamMatches(schedule: Schedule, teamName: string): Match[];

  /**
   * Gets all matches for a specific player - NEW for player-based rules
   * @param schedule The schedule to search
   * @param playerName Name of the player
   * @returns Array of matches involving this player
   */
  function getPlayerMatches(schedule: Schedule, playerName: string): Match[];

  /**
   * Checks if two matches are consecutive (timeSlot difference of 1)
   * @param match1 First match
   * @param match2 Second match
   * @returns True if matches are consecutive
   */
  function areConsecutive(match1: Match, match2: Match): boolean;

  /**
   * Creates a standardized violation object
   * @param rule Rule name
   * @param description Description of the violation
   * @param matches Matches involved (optional)
   * @param level Severity level (optional)
   * @returns Formatted violation object
   */
  function createViolation(
    rule: string,
    description: string,
    matches?: Match[],
    level?: 'note' | 'warning' | 'alert' | 'critical'
  ): RuleViolation;

  /**
   * Groups matches by division
   * @param matches Array of matches to group
   * @returns Object with division names as keys and match arrays as values
   */
  function groupMatchesByDivision(matches: Match[]): Record<string, Match[]>;

  /**
   * Gets schedule statistics including player data
   * @param schedule The schedule to analyze
   * @returns Object with various schedule statistics
   */
  function getScheduleStats(schedule: Schedule): {
    totalMatches: number;
    totalPlayers: number;
    matchesPerTimeSlot: Record<number, number>;
    matchesPerField: Record<string, number>;
    matchesPerDivision: Record<string, number>;
    playersPerTeam: Record<string, number>;
  };
}

/**
 * Global variables available in the rule evaluation context
 */
declare const schedule: Schedule;

/**
 * Main function that evaluates a schedule for rule violations
 * @param schedule The schedule to evaluate
 * @returns Array of violations found
 */
declare function evaluate(schedule: Schedule): RuleViolation[];
