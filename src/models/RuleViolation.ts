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
}
