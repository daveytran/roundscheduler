import { RuleViolation } from '../models/RuleViolation'

export const DEFAULT_CONCENTRATION_PENALTY_WEIGHT = 0.35
// Backward-compatible alias for older code paths.
export const DEFAULT_SPREAD_PENALTY_WEIGHT = DEFAULT_CONCENTRATION_PENALTY_WEIGHT

type EntityType = 'team' | 'player'

export interface PainSpreadEntitySummary {
  name: string
  pain: number
  violations: number
  share: number
}

export interface PainSpreadGroupMetrics {
  entityType: EntityType
  totalPain: number
  affectedEntities: number
  maxPain: number
  topShare: number
  hhi: number
  normalizedConcentration: number
  normalizedSpread: number
  effectiveEntities: number
  entities: PainSpreadEntitySummary[]
}

export interface PainSpreadMetrics {
  totalPainScore: number
  concentrationPenaltyWeight: number
  concentrationPenaltyScore: number
  // Backward-compatible aliases. Prefer concentrationPenalty* fields.
  spreadPenaltyWeight: number
  spreadPenaltyScore: number
  objectiveScore: number
  combinedConcentration: number
  combinedSpread: number
  team: PainSpreadGroupMetrics
  player: PainSpreadGroupMetrics
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, decimals = 2): number {
  const multiplier = 10 ** decimals
  return Math.round(value * multiplier) / multiplier
}

function extractEntityName(description: string, entityType: EntityType): string | null {
  const normalizedDescription = description.trim()
  const normalizedLower = normalizedDescription.toLowerCase()
  const prefix = `${entityType} `

  if (!normalizedLower.startsWith(prefix)) {
    return null
  }

  const remaining = normalizedDescription.slice(prefix.length)
  const remainingLower = remaining.toLowerCase()

  const delimiters = [
    ':',
    ' participates',
    ' has',
    ' referees',
    ' does',
    ' needs',
    ' plays',
    ' is',
  ]

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

function getViolationPainPoints(
  violation: RuleViolation,
  fallbackPainPerViolation: number
): number {
  if (typeof violation.painPoints === 'number' && Number.isFinite(violation.painPoints) && violation.painPoints > 0) {
    return violation.painPoints
  }

  return fallbackPainPerViolation
}

function createEmptyGroup(entityType: EntityType): PainSpreadGroupMetrics {
  return {
    entityType,
    totalPain: 0,
    affectedEntities: 0,
    maxPain: 0,
    topShare: 0,
    hhi: 0,
    normalizedConcentration: 0,
    normalizedSpread: 1,
    effectiveEntities: 0,
    entities: [],
  }
}

function buildGroupMetrics(
  entityType: EntityType,
  painByEntity: Map<string, { pain: number; violations: number }>
): PainSpreadGroupMetrics {
  if (painByEntity.size === 0) {
    return createEmptyGroup(entityType)
  }

  const entities = Array.from(painByEntity.entries())
    .map(([name, value]): PainSpreadEntitySummary => ({
      name,
      pain: value.pain,
      violations: value.violations,
      share: 0,
    }))
    .sort((left, right) => {
      if (right.pain !== left.pain) {
        return right.pain - left.pain
      }
      return left.name.localeCompare(right.name)
    })

  const totalPain = entities.reduce((sum, entity) => sum + entity.pain, 0)
  if (totalPain <= 0) {
    return createEmptyGroup(entityType)
  }

  entities.forEach((entity: PainSpreadEntitySummary) => {
    entity.share = entity.pain / totalPain
  })

  const hhi = entities.reduce((sum, entity) => sum + entity.share * entity.share, 0)
  const maxPain = entities[0]?.pain || 0
  const topShare = maxPain / totalPain
  const effectiveEntities = hhi > 0 ? 1 / hhi : 0

  const normalizedConcentration =
    entities.length <= 1
      ? 1
      : clamp((hhi - 1 / entities.length) / (1 - 1 / entities.length), 0, 1)
  const normalizedSpread = 1 - normalizedConcentration

  return {
    entityType,
    totalPain: round(totalPain),
    affectedEntities: entities.length,
    maxPain: round(maxPain),
    topShare: round(topShare, 4),
    hhi: round(hhi, 4),
    normalizedConcentration: round(normalizedConcentration, 4),
    normalizedSpread: round(normalizedSpread, 4),
    effectiveEntities: round(effectiveEntities, 3),
    entities,
  }
}

export function calculatePainSpreadMetrics(
  violations: RuleViolation[],
  totalPainScore: number,
  concentrationPenaltyWeight = DEFAULT_CONCENTRATION_PENALTY_WEIGHT
): PainSpreadMetrics {
  const effectiveTotalPainScore = Number.isFinite(totalPainScore) && totalPainScore > 0 ? totalPainScore : 0
  const fallbackPainPerViolation =
    violations.length > 0 && effectiveTotalPainScore > 0 ? effectiveTotalPainScore / violations.length : 1

  const teamPainByEntity = new Map<string, { pain: number; violations: number }>()
  const playerPainByEntity = new Map<string, { pain: number; violations: number }>()

  violations.forEach((violation: RuleViolation) => {
    const painPoints = getViolationPainPoints(violation, fallbackPainPerViolation)
    if (painPoints <= 0) {
      return
    }

    const teamName = extractEntityName(violation.description, 'team')
    if (teamName) {
      const previous = teamPainByEntity.get(teamName) || { pain: 0, violations: 0 }
      previous.pain += painPoints
      previous.violations += 1
      teamPainByEntity.set(teamName, previous)
    }

    const playerName = extractEntityName(violation.description, 'player')
    if (playerName) {
      const previous = playerPainByEntity.get(playerName) || { pain: 0, violations: 0 }
      previous.pain += painPoints
      previous.violations += 1
      playerPainByEntity.set(playerName, previous)
    }
  })

  const team = buildGroupMetrics('team', teamPainByEntity)
  const player = buildGroupMetrics('player', playerPainByEntity)

  const groupsWithPain = [team, player].filter((group: PainSpreadGroupMetrics) => group.totalPain > 0)
  const combinedConcentration =
    groupsWithPain.length > 0
      ? groupsWithPain.reduce((sum, group) => sum + group.normalizedConcentration, 0) / groupsWithPain.length
      : 0

  const concentrationPenaltyScore =
    effectiveTotalPainScore > 0
      ? effectiveTotalPainScore * combinedConcentration * concentrationPenaltyWeight
      : 0
  const objectiveScore = effectiveTotalPainScore + concentrationPenaltyScore
  const combinedSpread = groupsWithPain.length > 0 ? 1 - combinedConcentration : 0

  return {
    totalPainScore: round(effectiveTotalPainScore),
    concentrationPenaltyWeight: round(concentrationPenaltyWeight, 4),
    concentrationPenaltyScore: round(concentrationPenaltyScore),
    spreadPenaltyWeight: round(concentrationPenaltyWeight, 4),
    spreadPenaltyScore: round(concentrationPenaltyScore),
    objectiveScore: round(objectiveScore),
    combinedConcentration: round(combinedConcentration, 4),
    combinedSpread: round(combinedSpread, 4),
    team,
    player,
  }
}
