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
   * Gets all matches for a specific team
   * @param schedule The schedule to search
   * @param teamName Name of the team
   * @returns Array of matches involving this team
   */
  function getTeamMatches(schedule: Schedule, teamName: string): Match[];

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
