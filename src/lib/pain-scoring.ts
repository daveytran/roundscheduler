import { Match } from '../models/Match'
import { RuleViolation } from '../models/RuleViolation'

export type ViolationPainScope = 'team' | 'player' | 'other'
export type RulePainUnit = 'per_player' | 'per_team'

const PAIN_DECIMALS = 2

function round(value: number, decimals = PAIN_DECIMALS): number {
  const multiplier = 10 ** decimals
  return Math.round(value * multiplier) / multiplier
}

function extractEntityName(description: string, scope: 'team' | 'player'): string | null {
  const normalizedDescription = description.trim()
  const normalizedLower = normalizedDescription.toLowerCase()
  const prefix = `${scope} `

  if (!normalizedLower.startsWith(prefix)) {
    return null
  }

  const remaining = normalizedDescription.slice(prefix.length)
  const remainingLower = remaining.toLowerCase()
  const delimiters = [':', ' participates', ' has', ' referees', ' does', ' needs', ' plays', ' is']

  let cutIndex = remaining.length
  delimiters.forEach((delimiter: string) => {
    const delimiterIndex = remainingLower.indexOf(delimiter)
    if (delimiterIndex > 0 && delimiterIndex < cutIndex) {
      cutIndex = delimiterIndex
    }
  })

  const name = remaining.slice(0, cutIndex).trim()
  return name.length > 0 ? name : null
}

export function classifyViolationPainScope(violation: RuleViolation): ViolationPainScope {
  if (violation.painScope === 'team' || violation.painScope === 'player' || violation.painScope === 'other') {
    return violation.painScope
  }

  const normalizedDescription = violation.description.trim().toLowerCase()
  if (normalizedDescription.startsWith('team ')) {
    return 'team'
  }

  if (normalizedDescription.startsWith('player ')) {
    return 'player'
  }

  return 'other'
}

function addTeamPlayers(match: Match, teamName: string, playerNames: Set<string>) {
  if (match.team1.name === teamName) {
    match.team1.players.forEach(player => playerNames.add(player.name))
  }

  if (match.team2.name === teamName) {
    match.team2.players.forEach(player => playerNames.add(player.name))
  }

  if (match.refereeTeam?.name === teamName) {
    match.refereeTeam.players.forEach(player => playerNames.add(player.name))
  }
}

function estimateAffectedTeamParticipants(violation: RuleViolation): number {
  const matches = violation.matches || []
  const teamName = extractEntityName(violation.description, 'team')

  if (!teamName || matches.length === 0) {
    return 1
  }

  const impactedPlayers = new Set<string>()
  matches.forEach(match => {
    addTeamPlayers(match, teamName, impactedPlayers)
  })

  if (impactedPlayers.size > 0) {
    return impactedPlayers.size
  }

  // Fallback to roster size when player names are not populated.
  for (const match of matches) {
    if (match.team1.name === teamName && match.team1.players.length > 0) {
      return match.team1.players.length
    }
    if (match.team2.name === teamName && match.team2.players.length > 0) {
      return match.team2.players.length
    }
    if (match.refereeTeam?.name === teamName && match.refereeTeam.players.length > 0) {
      return match.refereeTeam.players.length
    }
  }

  return 1
}

export interface ViolationPainScore {
  painPoints: number
  painPerParticipant: number
  painUnit: RulePainUnit
  scope: ViolationPainScope
  affectedParticipants: number
}

export function calculateViolationPainScore(
  violation: RuleViolation,
  basePainPoints: number,
  rulePainUnit: RulePainUnit = 'per_player'
): ViolationPainScore {
  const normalizedBasePain = Number.isFinite(basePainPoints) && basePainPoints > 0 ? basePainPoints : 1
  const scope = classifyViolationPainScope(violation)
  const painUnit = violation.painUnit === 'per_player' || violation.painUnit === 'per_team'
    ? violation.painUnit
    : rulePainUnit

  const explicitAffectedParticipants =
    typeof violation.affectedParticipants === 'number' && Number.isFinite(violation.affectedParticipants)
      ? Math.max(1, Math.round(violation.affectedParticipants))
      : null

  const inferredParticipants = scope === 'team' ? estimateAffectedTeamParticipants(violation) : 1
  const affectedParticipants = explicitAffectedParticipants || inferredParticipants

  const painPerParticipant = round(
    painUnit === 'per_team'
      ? normalizedBasePain / affectedParticipants
      : normalizedBasePain
  )

  const painPoints = round(
    painUnit === 'per_team'
      ? normalizedBasePain
      : normalizedBasePain * affectedParticipants
  )

  return {
    painPoints,
    painPerParticipant,
    painUnit,
    scope,
    affectedParticipants,
  }
}
