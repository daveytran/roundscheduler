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
 * Represents a match between two teams
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
  /** Whether this match is locked and cannot be moved */
  locked: boolean;
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
  /** Severity level of the violation (optional) */
  severity?: 'low' | 'medium' | 'high';
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

  /**
   * Swap two matches in the schedule
   * @param match1 First match to swap
   * @param match2 Second match to swap
   * @returns New schedule with swapped matches, or null if either match is locked
   */
  swapMatches(match1: Match, match2: Match): Schedule | null;

  /**
   * Move matches to a specific time slot
   * @param matches Array of matches to move
   * @param targetTimeSlot Target time slot to move matches to
   * @returns New schedule with moved matches, or null if not enough courts available
   */
  moveMatchesToTimeSlot(matches: Match[], targetTimeSlot: number): Schedule | null;

  /**
   * Swap all matches between two time slots
   * @param timeSlot1 First time slot
   * @param timeSlot2 Second time slot
   * @returns New schedule with swapped time slots, or null if any matches are locked
   */
  swapTimeSlots(timeSlot1: number, timeSlot2: number): Schedule | null;
}

/**
 * Utility type for creating violations more easily
 */
export interface ViolationBuilder {
  rule: string;
  description: string;
  matches?: Match[];
  severity?: 'low' | 'medium' | 'high';
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
   * @param severity Severity level (optional)
   * @returns Formatted violation object
   */
  function createViolation(
    rule: string,
    description: string,
    matches?: Match[],
    severity?: 'low' | 'medium' | 'high'
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
