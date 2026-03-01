import { Match } from './Match'

/**
 * Represents a rule violation found in the schedule
 */
export interface RuleViolation {
  /** Name of the rule that was violated */
  rule: string
  /** Human-readable description of the violation */
  description: string
  /** Array of matches involved in the violation (optional) */
  matches?: Match[]
  /** Severity level of the violation */
  level: 'note' | 'warning' | 'alert' | 'critical'
  /** Pain points contributed by this violation (derived from rule priority) */
  painPoints?: number
  /** Whether this violation is team-scoped, player-scoped, or other */
  painScope?: 'team' | 'player' | 'other'
  /** Pain unit used by the originating rule priority */
  painUnit?: 'per_player' | 'per_team'
  /** Number of participants directly impacted by this violation */
  affectedParticipants?: number
  /** Pain points assigned to each affected participant */
  painPerParticipant?: number
  /** Whether this violation should contribute to concentration scoring */
  concentrationScope?: 'entity' | 'league'
}
