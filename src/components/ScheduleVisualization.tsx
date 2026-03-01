import React, { useMemo, useState } from 'react'
import { Schedule } from '../models/Schedule'
import { Match } from '../models/Match'
import { RuleViolation } from '../models/RuleViolation'

interface ScheduleVisualizationProps {
  schedule: Schedule
  isLiveUpdating?: boolean
  liveViolationBaseline?: number | null
  liveBestViolationCount?: number | null
  liveLatestViolationChange?: number
}

interface GroupedMatches {
  [key: string]: Match[]
}

interface ViolationInfo {
  type: 'note' | 'warning' | 'alert' | 'critical'
  message: string
}

const LEVEL_ORDER: Record<RuleViolation['level'], number> = {
  critical: 4,
  alert: 3,
  warning: 2,
  note: 1,
}

const LEVEL_STYLE_MAP: Record<
  RuleViolation['level'],
  { badge: string; panel: string; label: string; chart: string; block: string }
> = {
  critical: {
    badge: 'bg-red-200 text-red-900',
    panel: 'bg-red-50 border-red-200',
    label: 'Critical',
    chart: 'bg-red-500',
    block: 'bg-red-600',
  },
  alert: {
    badge: 'bg-red-200 text-red-900',
    panel: 'bg-red-50 border-red-200',
    label: 'Alert',
    chart: 'bg-red-400',
    block: 'bg-red-400',
  },
  warning: {
    badge: 'bg-yellow-200 text-yellow-900',
    panel: 'bg-yellow-50 border-yellow-200',
    label: 'Warning',
    chart: 'bg-yellow-400',
    block: 'bg-yellow-400',
  },
  note: {
    badge: 'bg-blue-200 text-blue-900',
    panel: 'bg-blue-50 border-blue-200',
    label: 'Note',
    chart: 'bg-blue-400',
    block: 'bg-blue-400',
  },
}

interface RuleViolationSummary {
  rule: string
  total: number
  levelCounts: Record<RuleViolation['level'], number>
  highestLevel: RuleViolation['level']
  descriptions: string[]
}

interface EntityViolationSummary {
  name: string
  total: number
  levelCounts: Record<RuleViolation['level'], number>
  highestLevel: RuleViolation['level']
  topRules: Array<{ rule: string; count: number }>
}

interface RuleImpactSummary {
  rule: string
  summary: string
  affectedEntities: number
  maxOverage: number
}

interface EntityGroupAnalytics {
  totalViolations: number
  levelCounts: Record<RuleViolation['level'], number>
  affectedEntities: number
  averageViolationsPerEntity: number
  maxViolationsPerEntity: number
  uniqueRules: number
  entities: EntityViolationSummary[]
  ruleImpactSummaries: RuleImpactSummary[]
}

type ViolationEntityGroup = 'team' | 'player' | 'other'

const ENTITY_LABEL_MAP: Record<ViolationEntityGroup, string> = {
  team: 'Team Violations',
  player: 'Player Violations',
  other: 'Other Violations',
}

function classifyViolationEntity(violation: RuleViolation): ViolationEntityGroup {
  const normalizedDescription = violation.description.trim().toLowerCase()
  if (normalizedDescription.startsWith('team ')) {
    return 'team'
  }

  if (normalizedDescription.startsWith('player ')) {
    return 'player'
  }

  return 'other'
}

function splitViolationsByEntity(violations: RuleViolation[]): Record<ViolationEntityGroup, RuleViolation[]> {
  const groupedViolations: Record<ViolationEntityGroup, RuleViolation[]> = {
    team: [],
    player: [],
    other: [],
  }

  violations.forEach((violation: RuleViolation) => {
    groupedViolations[classifyViolationEntity(violation)].push(violation)
  })

  return groupedViolations
}

function createEmptyLevelCounts(): Record<RuleViolation['level'], number> {
  return { critical: 0, alert: 0, warning: 0, note: 0 }
}

type ParsedViolationMetric = {
  kind: 'venue_time' | 'max_games'
  observed: number
  maxAllowed: number
  overage: number
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function parseViolationMetric(description: string): ParsedViolationMetric | null {
  const venueTimeMatch = description.match(/at venue for (\d+(?:\.\d+)?) hours \(max:\s*(\d+(?:\.\d+)?)h\)/i)
  if (venueTimeMatch) {
    const observed = parseFloat(venueTimeMatch[1])
    const maxAllowed = parseFloat(venueTimeMatch[2])
    return {
      kind: 'venue_time',
      observed,
      maxAllowed,
      overage: observed - maxAllowed,
    }
  }

  const maxGamesMatch = description.match(/scheduled for (\d+(?:\.\d+)?) games \(max:\s*(\d+(?:\.\d+)?)\)/i)
  if (maxGamesMatch) {
    const observed = parseFloat(maxGamesMatch[1])
    const maxAllowed = parseFloat(maxGamesMatch[2])
    return {
      kind: 'max_games',
      observed,
      maxAllowed,
      overage: observed - maxAllowed,
    }
  }

  return null
}

function extractEntityName(description: string, entityGroup: 'team' | 'player'): string {
  const prefix = entityGroup === 'team' ? 'team ' : 'player '
  const normalizedDescription = description.trim()
  const lowerDescription = normalizedDescription.toLowerCase()

  if (!lowerDescription.startsWith(prefix)) {
    return `Unknown ${entityGroup}`
  }

  const remainingDescription = normalizedDescription.slice(prefix.length)
  const lowerRemainingDescription = remainingDescription.toLowerCase()
  const delimiters = [':', ' participates', ' has', ' referees', ' does', ' needs', ' plays', ' is']

  let cutIndex = remainingDescription.length
  delimiters.forEach(delimiter => {
    const delimiterIndex = lowerRemainingDescription.indexOf(delimiter)
    if (delimiterIndex > 0 && delimiterIndex < cutIndex) {
      cutIndex = delimiterIndex
    }
  })

  const extractedName = remainingDescription.slice(0, cutIndex).trim()
  return extractedName || `Unknown ${entityGroup}`
}

function buildEntityAnalytics(entityGroup: ViolationEntityGroup, violations: RuleViolation[]): EntityGroupAnalytics {
  const levelCounts = createEmptyLevelCounts()
  const uniqueRules = new Set<string>()
  const ruleImpactMap = new Map<
    string,
    {
      entities: Set<string>
      metrics: ParsedViolationMetric[]
      totalViolations: number
    }
  >()
  const entitySummaryMap = new Map<
    string,
    {
      total: number
      levelCounts: Record<RuleViolation['level'], number>
      highestLevel: RuleViolation['level']
      ruleCounts: Map<string, number>
    }
  >()

  violations.forEach((violation: RuleViolation) => {
    levelCounts[violation.level] += 1
    uniqueRules.add(violation.rule)
    const metric = parseViolationMetric(violation.description)

    const ruleImpactEntry = ruleImpactMap.get(violation.rule) || {
      entities: new Set<string>(),
      metrics: [],
      totalViolations: 0,
    }
    ruleImpactEntry.totalViolations += 1
    if (metric) {
      ruleImpactEntry.metrics.push(metric)
    }

    if (entityGroup === 'other') {
      ruleImpactEntry.entities.add(`${violation.rule}:${violation.description}`)
      ruleImpactMap.set(violation.rule, ruleImpactEntry)
      return
    }

    const entityName = extractEntityName(violation.description, entityGroup)
    ruleImpactEntry.entities.add(entityName)
    ruleImpactMap.set(violation.rule, ruleImpactEntry)
    const existingSummary = entitySummaryMap.get(entityName)

    if (!existingSummary) {
      entitySummaryMap.set(entityName, {
        total: 1,
        levelCounts: {
          critical: violation.level === 'critical' ? 1 : 0,
          alert: violation.level === 'alert' ? 1 : 0,
          warning: violation.level === 'warning' ? 1 : 0,
          note: violation.level === 'note' ? 1 : 0,
        },
        highestLevel: violation.level,
        ruleCounts: new Map([[violation.rule, 1]]),
      })
      return
    }

    existingSummary.total += 1
    existingSummary.levelCounts[violation.level] += 1
    existingSummary.ruleCounts.set(violation.rule, (existingSummary.ruleCounts.get(violation.rule) || 0) + 1)
    if (LEVEL_ORDER[violation.level] > LEVEL_ORDER[existingSummary.highestLevel]) {
      existingSummary.highestLevel = violation.level
    }
  })

  const entityLabelPlural =
    entityGroup === 'team' ? 'teams' : entityGroup === 'player' ? 'players' : 'violations'

  const ruleImpactSummaries: RuleImpactSummary[] = Array.from(ruleImpactMap.entries())
    .map(([rule, impactEntry]) => {
      const affectedEntities = impactEntry.entities.size > 0 ? impactEntry.entities.size : impactEntry.totalViolations
      const maxOverage = impactEntry.metrics.length > 0 ? Math.max(...impactEntry.metrics.map(metric => metric.overage)) : 0

      if (impactEntry.metrics.length > 0) {
        const dominantMetric =
          impactEntry.metrics.sort((left, right) => right.overage - left.overage)[0]
        const maxObserved = Math.max(...impactEntry.metrics.map(metric => metric.observed))

        if (dominantMetric.kind === 'venue_time') {
          return {
            rule,
            summary: `${affectedEntities} ${entityLabelPlural} at venue up to ${formatMetricNumber(maxObserved)} hrs (${formatMetricNumber(maxOverage)} hrs over max)`,
            affectedEntities,
            maxOverage,
          }
        }

        return {
          rule,
          summary: `${affectedEntities} ${entityLabelPlural} up to ${formatMetricNumber(maxObserved)} games (${formatMetricNumber(maxOverage)} over max)`,
          affectedEntities,
          maxOverage,
        }
      }

      return {
        rule,
        summary: `${affectedEntities} ${entityLabelPlural} affected`,
        affectedEntities,
        maxOverage: 0,
      }
    })
    .sort((left, right) => {
      if (right.maxOverage !== left.maxOverage) {
        return right.maxOverage - left.maxOverage
      }
      if (right.affectedEntities !== left.affectedEntities) {
        return right.affectedEntities - left.affectedEntities
      }
      return left.rule.localeCompare(right.rule)
    })

  const entities = Array.from(entitySummaryMap.entries())
    .map(([name, summary]): EntityViolationSummary => {
      const topRules = Array.from(summary.ruleCounts.entries())
        .map(([rule, count]) => ({ rule, count }))
        .sort((left, right) => right.count - left.count || left.rule.localeCompare(right.rule))
        .slice(0, 2)

      return {
        name,
        total: summary.total,
        levelCounts: summary.levelCounts,
        highestLevel: summary.highestLevel,
        topRules,
      }
    })
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total
      }
      if (LEVEL_ORDER[right.highestLevel] !== LEVEL_ORDER[left.highestLevel]) {
        return LEVEL_ORDER[right.highestLevel] - LEVEL_ORDER[left.highestLevel]
      }
      return left.name.localeCompare(right.name)
    })

  const affectedEntities = entities.length
  const totalViolations = violations.length
  const averageViolationsPerEntity = affectedEntities > 0 ? totalViolations / affectedEntities : 0
  const maxViolationsPerEntity = entities.length > 0 ? Math.max(...entities.map(entity => entity.total)) : 0

  return {
    totalViolations,
    levelCounts,
    affectedEntities,
    averageViolationsPerEntity,
    maxViolationsPerEntity,
    uniqueRules: uniqueRules.size,
    entities,
    ruleImpactSummaries,
  }
}

export default function ScheduleVisualization({
  schedule,
  isLiveUpdating = false,
  liveViolationBaseline = null,
  liveBestViolationCount = null,
  liveLatestViolationChange = 0,
}: ScheduleVisualizationProps) {
  const violations: RuleViolation[] = schedule?.violations || []
  const [viewMode, setViewMode] = useState<'by_time' | 'by_field' | 'violations_only'>('by_time')
  const [violationsDisplayMode, setViolationsDisplayMode] = useState<'grouped' | 'entity_split'>('entity_split')
  const [showSpecificEntities, setShowSpecificEntities] = useState<boolean>(false)
  const [levelFilter, setLevelFilter] = useState<'all' | RuleViolation['level']>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDivision, setSelectedDivision] = useState<string>('all')
  const [showSpecialActivities, setShowSpecialActivities] = useState<boolean>(true)
  const [showNotes, setShowNotes] = useState<boolean>(false)
  const [isViolationsExpanded, setIsViolationsExpanded] = useState<boolean>(false)
  const isViolationsOnlyMode = viewMode === 'violations_only'
  const visibleViolations = showNotes ? violations : violations.filter((violation: RuleViolation) => violation.level !== 'note')
  const levelDisplayOrder: RuleViolation['level'][] = showNotes
    ? ['critical', 'alert', 'warning', 'note']
    : ['critical', 'alert', 'warning']
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const visibleViolationCountsByLevel = useMemo(() => {
    return visibleViolations.reduce(
      (counts, violation) => {
        counts[violation.level] += 1
        return counts
      },
      { critical: 0, alert: 0, warning: 0, note: 0 } as Record<RuleViolation['level'], number>
    )
  }, [visibleViolations])

  const filteredVisibleViolations = useMemo(() => {
    return visibleViolations.filter(violation => {
      if (levelFilter !== 'all' && violation.level !== levelFilter) {
        return false
      }

      if (!normalizedSearchQuery) {
        return true
      }

      return (
        violation.rule.toLowerCase().includes(normalizedSearchQuery) ||
        violation.description.toLowerCase().includes(normalizedSearchQuery)
      )
    })
  }, [visibleViolations, levelFilter, normalizedSearchQuery])

  const groupedViolationSummaries = useMemo(() => {
    const groupedMap = new Map<string, RuleViolationSummary>()

    filteredVisibleViolations.forEach((violation: RuleViolation) => {
      const existingSummary = groupedMap.get(violation.rule)

      if (!existingSummary) {
        groupedMap.set(violation.rule, {
          rule: violation.rule,
          total: 1,
          levelCounts: {
            critical: violation.level === 'critical' ? 1 : 0,
            alert: violation.level === 'alert' ? 1 : 0,
            warning: violation.level === 'warning' ? 1 : 0,
            note: violation.level === 'note' ? 1 : 0,
          },
          highestLevel: violation.level,
          descriptions: [violation.description],
        })
        return
      }

      existingSummary.total += 1
      existingSummary.levelCounts[violation.level] += 1

      if (LEVEL_ORDER[violation.level] > LEVEL_ORDER[existingSummary.highestLevel]) {
        existingSummary.highestLevel = violation.level
      }

      if (!existingSummary.descriptions.includes(violation.description)) {
        existingSummary.descriptions.push(violation.description)
      }
    })

    return Array.from(groupedMap.values()).sort((left, right) => {
      if (LEVEL_ORDER[right.highestLevel] !== LEVEL_ORDER[left.highestLevel]) {
        return LEVEL_ORDER[right.highestLevel] - LEVEL_ORDER[left.highestLevel]
      }

      if (right.total !== left.total) {
        return right.total - left.total
      }

      return left.rule.localeCompare(right.rule)
    })
  }, [filteredVisibleViolations])

  const filteredViolationsByEntity = useMemo(() => {
    return splitViolationsByEntity(filteredVisibleViolations)
  }, [filteredVisibleViolations])

  const filteredEntityAnalytics = useMemo(() => {
    return {
      team: buildEntityAnalytics('team', filteredViolationsByEntity.team),
      player: buildEntityAnalytics('player', filteredViolationsByEntity.player),
      other: buildEntityAnalytics('other', filteredViolationsByEntity.other),
    }
  }, [filteredViolationsByEntity])

  const initialViolationCount = liveViolationBaseline
  const bestViolationCount = liveBestViolationCount
  const latestViolationChange = liveLatestViolationChange
  const violationChangeFromStart = initialViolationCount !== null ? violations.length - initialViolationCount : 0

  // Get violations for a specific match using the rule system
  const getMatchViolations = (match: Match): ViolationInfo[] => {
    const matchViolations: ViolationInfo[] = []

    // Check schedule violations that involve this match
    schedule.violations?.forEach(violation => {
      if (
        violation.matches &&
        violation.matches.some(
          m =>
            m.timeSlot === match.timeSlot &&
            m.field === match.field &&
            m.team1.name === match.team1.name &&
            m.team2.name === match.team2.name
        )
      ) {
        // Filter out notes if they shouldn't be shown
        if (violation.level === 'note' && !showNotes) {
          return
        }

        matchViolations.push({
          type: violation.level,
          message: violation.description,
        })
      }
    })

    return matchViolations
  }

  // Get row color based on violations
  const getRowColor = (violations: ViolationInfo[]): string => {
    if (violations.some(v => v.type === 'critical')) {
      return 'bg-red-100 border-red-300'
    } else if (violations.some(v => v.type === 'alert')) {
      return 'bg-red-100 border-red-300'
    } else if (violations.some(v => v.type === 'warning')) {
      return 'bg-yellow-100 border-yellow-300'
    } else if (violations.some(v => v.type === 'note')) {
      return 'bg-blue-100 border-blue-300'
    }
    return ''
  }

  // Get card color based on violations and activity type
  const getCardColor = (violations: ViolationInfo[], match: Match): string => {
    // Special styling for setup/pack down activities
    if (match.activityType === 'SETUP') {
      return 'border-blue-300 bg-blue-50'
    } else if (match.activityType === 'PACKING_DOWN') {
      return 'border-purple-300 bg-purple-50'
    }

    // Regular violation-based coloring for regular matches
    if (violations.some(v => v.type === 'critical')) {
      return 'border-red-300 bg-red-50'
    } else if (violations.some(v => v.type === 'alert')) {
      return 'border-red-300 bg-red-50'
    } else if (violations.some(v => v.type === 'warning')) {
      return 'border-yellow-300 bg-yellow-50'
    } else if (violations.some(v => v.type === 'note')) {
      return 'border-blue-300 bg-blue-50'
    }
    return 'border-gray-200'
  }

  if (!schedule || !schedule.matches || schedule.matches.length === 0) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-4">Schedule Visualization</h2>
        <p className="text-gray-500">No schedule data to display</p>
      </div>
    )
  }

  // Get unique divisions
  const divisions: string[] = ['all', ...Array.from(new Set(schedule.matches.map((match: Match) => match.division)))]

  // Get unique fields
  const fields: string[] = Array.from(new Set(schedule.matches.map((match: Match) => match.field)))

  // Get all time slots
  const timeSlots: number[] = Array.from(new Set(schedule.matches.map((match: Match) => match.timeSlot))).sort(
    (a: number, b: number) => a - b
  )

  // Filter matches by division and special activities
  let filteredMatches: Match[] = schedule.matches

  // Filter by division
  if (selectedDivision !== 'all') {
    filteredMatches = filteredMatches.filter((match: Match) => match.division === selectedDivision)
  }

  // Filter by special activities
  if (!showSpecialActivities) {
    filteredMatches = filteredMatches.filter(
      (match: Match) => match.activityType !== 'SETUP' && match.activityType !== 'PACKING_DOWN'
    )
  }

  // Group matches by time or field based on view mode
  const groupedMatches: GroupedMatches = {}

  if (viewMode === 'by_time') {
    filteredMatches.forEach((match: Match) => {
      if (!groupedMatches[match.timeSlot]) {
        groupedMatches[match.timeSlot] = []
      }
      groupedMatches[match.timeSlot].push(match)
    })
  } else if (viewMode === 'by_field') {
    filteredMatches.forEach((match: Match) => {
      if (!groupedMatches[match.field]) {
        groupedMatches[match.field] = []
      }
      groupedMatches[match.field].push(match)
    })
  }

  // Helper to get violation descriptions for a match (legacy system)
  const getViolationDescriptions = (match: Match): string[] => {
    return violations
      .filter(
        (v: RuleViolation) =>
          v.matches &&
          v.matches.some(
            (m: Match) =>
              (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
              (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
          )
      )
      .map((v: RuleViolation) => v.description)
  }

  const handleExportCSV = (): void => {
    // Create CSV content
    const headers = ['Time Slot', 'Activity Type', 'Division', 'Field', 'Team 1', 'Team 2', 'Referee']
    const rows = schedule.matches.map((match: Match) => [
      match.timeSlot,
      match.activityType || 'REGULAR',
      match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN' ? match.activityType : match.division,
      match.field,
      match.team1.name !== 'ACTIVITY_PLACEHOLDER' ? match.team1.name : '',
      match.team2.name !== 'ACTIVITY_PLACEHOLDER' ? match.team2.name : '',
      match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN' ? '' : match.refereeTeam?.name || '',
    ])

    const csvContent = [headers.join(','), ...rows.map((row: (string | number)[]) => row.join(','))].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'optimized_schedule.csv')
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Schedule Visualization</h2>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex border rounded overflow-hidden">
            <button
              onClick={() => setViewMode('by_time')}
              className={`px-3 py-1 ${viewMode === 'by_time' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              By Time
            </button>
            <button
              onClick={() => setViewMode('by_field')}
              className={`px-3 py-1 ${viewMode === 'by_field' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              By Field
            </button>
            <button
              onClick={() => setViewMode('violations_only')}
              className={`px-3 py-1 ${viewMode === 'violations_only' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              Violations Only
            </button>
          </div>

          {!isViolationsOnlyMode && (
            <>
              <select
                value={selectedDivision}
                onChange={e => setSelectedDivision(e.target.value)}
                className="p-2 border rounded"
              >
                {divisions.map((div: string) => (
                  <option key={div} value={div}>
                    {div === 'all' ? 'All Divisions' : div.charAt(0).toUpperCase() + div.slice(1)}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSpecialActivities}
                  onChange={e => setShowSpecialActivities(e.target.checked)}
                  className="rounded"
                />
                Show Setup/Pack Down
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showNotes}
              onChange={e => setShowNotes(e.target.checked)}
              className="rounded"
            />
            Show Notes
          </label>

          <button onClick={handleExportCSV} className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            Export CSV
          </button>
        </div>
      </div>

      {/* Color Legend */}
      {!isViolationsOnlyMode && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
            <span>🔧 Setup Activities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
            <span>📦 Pack Down Activities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>🔴 Critical (disqualifies schedule)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>🚨 Alert (serious but won&apos;t disqualify)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>⚠️ Warning (standard violations)</span>
          </div>
          {showNotes && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span>ℹ️ Note (minor suggestions)</span>
            </div>
          )}
        </div>
      )}

      {schedule.score > 0 && !isViolationsOnlyMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <button
            onClick={() => setIsViolationsExpanded(!isViolationsExpanded)}
            className="flex items-center justify-between w-full text-left hover:bg-amber-100 rounded p-1 -m-1"
          >
            <h3 className="font-bold text-amber-800">
              Schedule Violations (Score: {schedule.score}) - {visibleViolations.length} violation
              {visibleViolations.length !== 1 ? 's' : ''}
            </h3>
            <svg
              className={`w-5 h-5 text-amber-800 transform transition-transform ${isViolationsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isViolationsExpanded && (
            <ul className="list-disc pl-5 text-sm mt-2">
              {visibleViolations.map((v: RuleViolation, i: number) => (
                <li key={i} className="text-amber-700">
                  {v.rule}: {v.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isViolationsOnlyMode ? (
        <div className="border border-gray-200 rounded p-4">
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-gray-800">Violation List ({visibleViolations.length})</h3>
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {filteredVisibleViolations.length === visibleViolations.length
                  ? `${visibleViolations.length} shown`
                  : `Showing ${filteredVisibleViolations.length} of ${visibleViolations.length}`}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="border rounded p-2 bg-gray-50">
                <div className="text-gray-500 uppercase tracking-wide">Total</div>
                <div className="text-lg font-semibold text-gray-800">{visibleViolations.length}</div>
              </div>
              {levelDisplayOrder.map((level: RuleViolation['level']) => (
                <div key={level} className={`border rounded p-2 ${LEVEL_STYLE_MAP[level].panel}`}>
                  <div className="text-gray-600 uppercase tracking-wide">{LEVEL_STYLE_MAP[level].label}</div>
                  <div className="text-lg font-semibold text-gray-800">{visibleViolationCountsByLevel[level]}</div>
                </div>
              ))}
            </div>

            {visibleViolations.length > 0 && (
              <div className="h-2 w-full rounded bg-gray-100 overflow-hidden flex">
                {levelDisplayOrder.map((level: RuleViolation['level']) => {
                  const count = visibleViolationCountsByLevel[level]
                  if (count === 0) {
                    return null
                  }

                  const percentage = (count / visibleViolations.length) * 100
                  return (
                    <div
                      key={level}
                      className={LEVEL_STYLE_MAP[level].chart}
                      style={{ width: `${Math.max(percentage, 3)}%` }}
                      title={`${LEVEL_STYLE_MAP[level].label}: ${count}`}
                    ></div>
                  )
                })}
              </div>
            )}

            {visibleViolations.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="border rounded p-3 bg-white">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Severity Chart</h4>
                  <div className="space-y-2">
                    {levelDisplayOrder.map((level: RuleViolation['level']) => {
                      const count = visibleViolationCountsByLevel[level]
                      const width = visibleViolations.length > 0 ? (count / visibleViolations.length) * 100 : 0
                      return (
                        <div key={level} className="flex items-center gap-2 text-xs">
                          <span className="w-14 text-gray-700">{LEVEL_STYLE_MAP[level].label}</span>
                          <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden">
                            <div className={`h-full ${LEVEL_STYLE_MAP[level].chart}`} style={{ width: `${width}%` }}></div>
                          </div>
                          <span className="w-10 text-right text-gray-700">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="border rounded p-3 bg-white">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Team vs Player Scale</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(Object.keys(filteredViolationsByEntity) as ViolationEntityGroup[]).map((entityGroup: ViolationEntityGroup) => {
                      const entityViolations = filteredViolationsByEntity[entityGroup]
                      return (
                        <div key={entityGroup} className="border rounded p-2 bg-gray-50">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-semibold text-gray-700">{ENTITY_LABEL_MAP[entityGroup].replace(' Violations', '')}</span>
                            <span className="text-gray-600">{entityViolations.length}</span>
                          </div>
                          {entityViolations.length === 0 ? (
                            <div className="text-[11px] text-gray-400">No items</div>
                          ) : (
                            <>
                              <div className="grid grid-cols-10 gap-1">
                                {entityViolations.slice(0, 80).map((violation: RuleViolation, index: number) => (
                                  <span
                                    key={`${entityGroup}-${index}`}
                                    className={`h-2.5 w-2.5 rounded-sm ${LEVEL_STYLE_MAP[violation.level].block}`}
                                    title={`${violation.rule}: ${violation.description}`}
                                  ></span>
                                ))}
                              </div>
                              {entityViolations.length > 80 && (
                                <div className="text-[11px] text-gray-500 mt-1">+{entityViolations.length - 80} more</div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {isLiveUpdating && initialViolationCount !== null && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Start: {initialViolationCount}</span>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Current: {violations.length}</span>
                <span
                  className={`px-2 py-1 rounded ${
                    violationChangeFromStart <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  Since start: {violationChangeFromStart <= 0 ? `${Math.abs(violationChangeFromStart)} fewer` : `${violationChangeFromStart} more`}
                </span>
                {bestViolationCount !== null && (
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Best so far: {bestViolationCount}</span>
                )}
                {latestViolationChange !== 0 && (
                  <span
                    className={`px-2 py-1 rounded ${
                      latestViolationChange < 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Last update: {latestViolationChange < 0 ? `${Math.abs(latestViolationChange)} fewer` : `${latestViolationChange} more`}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search rule or description"
                className="flex-1 min-w-[220px] p-2 border rounded text-sm"
              />

              <select
                value={levelFilter}
                onChange={event => setLevelFilter(event.target.value as 'all' | RuleViolation['level'])}
                className="p-2 border rounded text-sm"
              >
                <option value="all">All levels</option>
                {levelDisplayOrder.map((level: RuleViolation['level']) => (
                  <option key={level} value={level}>
                    {LEVEL_STYLE_MAP[level].label}
                  </option>
                ))}
              </select>

              <div className="flex border rounded overflow-hidden text-sm">
                <button
                  onClick={() => setViolationsDisplayMode('grouped')}
                  className={`px-3 py-2 ${violationsDisplayMode === 'grouped' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Grouped
                </button>
                <button
                  onClick={() => setViolationsDisplayMode('entity_split')}
                  className={`px-3 py-2 ${violationsDisplayMode === 'entity_split' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Team/Player Split
                </button>
              </div>

              {violationsDisplayMode === 'entity_split' && (
                <label className="flex items-center gap-2 text-sm border rounded px-3 py-2 bg-gray-50">
                  <input
                    type="checkbox"
                    checked={showSpecificEntities}
                    onChange={event => setShowSpecificEntities(event.target.checked)}
                    className="rounded"
                  />
                  Show specific teams/players
                </label>
              )}
            </div>
          </div>

          {filteredVisibleViolations.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
              No violations match the current filters.
            </p>
          ) : violationsDisplayMode === 'grouped' ? (
            <div className="max-h-[560px] overflow-y-auto border rounded">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="p-2 border text-left">Rule</th>
                      <th className="p-2 border text-left">Count</th>
                      <th className="p-2 border text-left">Severity Mix</th>
                      <th className="p-2 border text-left">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedViolationSummaries.map((summary: RuleViolationSummary) => (
                      <tr key={summary.rule} className="border-b align-top">
                        <td className="p-2 border font-medium text-gray-800">{summary.rule}</td>
                        <td className="p-2 border">
                          <span className="text-sm font-semibold text-gray-800">{summary.total}</span>
                        </td>
                        <td className="p-2 border">
                          <div className="flex flex-wrap gap-1">
                            {levelDisplayOrder
                              .filter((level: RuleViolation['level']) => summary.levelCounts[level] > 0)
                              .map((level: RuleViolation['level']) => (
                                <span key={level} className={`text-xs font-semibold px-2 py-0.5 rounded ${LEVEL_STYLE_MAP[level].badge}`}>
                                  {LEVEL_STYLE_MAP[level].label}: {summary.levelCounts[level]}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="p-2 border text-gray-700">
                          <div>{summary.descriptions.slice(0, 2).join(' | ')}</div>
                          {summary.descriptions.length > 2 && (
                            <div className="text-xs text-gray-500 mt-1">+{summary.descriptions.length - 2} more message(s)</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {(Object.keys(filteredViolationsByEntity) as ViolationEntityGroup[]).map((entityGroup: ViolationEntityGroup) => {
                const entityViolations = filteredViolationsByEntity[entityGroup]
                const entityAnalytics = filteredEntityAnalytics[entityGroup]
                const affectedLabel =
                  entityGroup === 'team'
                    ? 'Affected Teams'
                    : entityGroup === 'player'
                      ? 'Affected Players'
                      : 'Rule Groups'

                return (
                  <div key={entityGroup} className="border rounded p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 text-sm">{ENTITY_LABEL_MAP[entityGroup]}</h4>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{entityViolations.length}</span>
                    </div>

                    {entityViolations.length === 0 ? (
                      <p className="text-xs text-gray-500">No matching violations in this group.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-gray-500 uppercase tracking-wide">Violations</div>
                            <div className="text-base font-semibold text-gray-800">{entityAnalytics.totalViolations}</div>
                          </div>
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-gray-500 uppercase tracking-wide">{affectedLabel}</div>
                            <div className="text-base font-semibold text-gray-800">
                              {entityGroup === 'other' ? entityAnalytics.uniqueRules : entityAnalytics.affectedEntities}
                            </div>
                          </div>
                          {entityGroup !== 'other' && (
                            <>
                              <div className="border rounded p-2 bg-gray-50">
                                <div className="text-gray-500 uppercase tracking-wide">Avg/Entity</div>
                                <div className="text-base font-semibold text-gray-800">
                                  {entityAnalytics.averageViolationsPerEntity.toFixed(1)}
                                </div>
                              </div>
                              <div className="border rounded p-2 bg-gray-50">
                                <div className="text-gray-500 uppercase tracking-wide">Worst Entity</div>
                                <div className="text-base font-semibold text-gray-800">{entityAnalytics.maxViolationsPerEntity}</div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="h-2 w-full rounded bg-gray-100 overflow-hidden flex">
                          {levelDisplayOrder.map((level: RuleViolation['level']) => {
                            const levelCount = entityAnalytics.levelCounts[level]
                            if (levelCount === 0) {
                              return null
                            }

                            const width = (levelCount / entityAnalytics.totalViolations) * 100
                            return (
                              <div
                                key={`${entityGroup}-${level}`}
                                className={LEVEL_STYLE_MAP[level].chart}
                                style={{ width: `${Math.max(width, 3)}%` }}
                                title={`${LEVEL_STYLE_MAP[level].label}: ${levelCount}`}
                              ></div>
                            )
                          })}
                        </div>

                        {entityAnalytics.ruleImpactSummaries.length > 0 && (
                          <div className="border rounded p-2 bg-gray-50">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1">By How Much</div>
                            <div className="space-y-1">
                              {entityAnalytics.ruleImpactSummaries.slice(0, 3).map((impactSummary: RuleImpactSummary) => (
                                <div key={`${entityGroup}-${impactSummary.rule}`} className="text-xs text-gray-700">
                                  <span className="font-medium">{impactSummary.rule}:</span> {impactSummary.summary}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {showSpecificEntities ? (
                          entityGroup === 'other' ? (
                            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                              {entityViolations.map((violation: RuleViolation, index: number) => (
                                <div key={`${entityGroup}-${violation.rule}-${index}`} className={`border rounded p-3 ${LEVEL_STYLE_MAP[violation.level].panel}`}>
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${LEVEL_STYLE_MAP[violation.level].badge}`}>
                                      {violation.level.toUpperCase()}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800">{violation.rule}</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{violation.description}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                              {entityAnalytics.entities.map((entity: EntityViolationSummary) => (
                                <div key={`${entityGroup}-${entity.name}`} className={`border rounded p-3 ${LEVEL_STYLE_MAP[entity.highestLevel].panel}`}>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-sm font-semibold text-gray-800">{entity.name}</span>
                                    <span className="text-xs bg-white/70 border rounded px-2 py-0.5 text-gray-700">{entity.total}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {levelDisplayOrder
                                      .filter((level: RuleViolation['level']) => entity.levelCounts[level] > 0)
                                      .map((level: RuleViolation['level']) => (
                                        <span key={`${entity.name}-${level}`} className={`text-xs font-semibold px-2 py-0.5 rounded ${LEVEL_STYLE_MAP[level].badge}`}>
                                          {LEVEL_STYLE_MAP[level].label}: {entity.levelCounts[level]}
                                        </span>
                                      ))}
                                  </div>
                                  {entity.topRules.length > 0 && (
                                    <div className="text-xs text-gray-700">
                                      Top rules: {entity.topRules.map(ruleSummary => `${ruleSummary.rule} (${ruleSummary.count})`).join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                            Specific names are hidden. Enable &quot;Show specific teams/players&quot; to inspect which teams or players are affected.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Schedule content with max height and scrolling */}
          <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded">
            {viewMode === 'by_time' ? (
              <div className="space-y-4 p-3">
                {timeSlots.map((slot: number) => (
                  <div key={slot} className="border rounded overflow-hidden">
                    <div className="bg-gray-100 p-2 font-bold sticky top-0 z-10">Time Slot {slot}</div>
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(groupedMatches[slot] || []).map((match: Match, idx: number) => {
                        const scheduleViolations = getMatchViolations(match)
                        return (
                          <div
                            key={idx}
                            className={`p-3 border rounded ${getCardColor(scheduleViolations, match)} ${scheduleViolations.length > 0 ? 'border-red-300 bg-red-50' : ''}`}
                          >
                            <div className="font-bold mb-1">{match.field}</div>

                            {/* Special rendering for setup/pack down activities */}
                            {match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN' ? (
                              <div>
                                <div className="text-center mb-2">
                                  <span
                                    className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                                      match.activityType === 'SETUP'
                                        ? 'bg-blue-200 text-blue-800'
                                        : 'bg-purple-200 text-purple-800'
                                    }`}
                                  >
                                    {match.activityType === 'SETUP' ? '🔧 SETUP' : '📦 PACKING DOWN'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 text-center">
                                  {match.team1.name !== 'ACTIVITY_PLACEHOLDER' && match.team2.name !== 'ACTIVITY_PLACEHOLDER'
                                    ? `Teams: ${match.team1.name}, ${match.team2.name}`
                                    : 'All teams participate'}
                                </div>
                              </div>
                            ) : (
                              /* Regular match rendering */
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`${scheduleViolations.length > 0 ? 'text-red-600 font-semibold' : ''}`}>
                                    {match.team1.name}
                                  </span>
                                  <span>vs</span>
                                  <span className={`${scheduleViolations.length > 0 ? 'text-red-600 font-semibold' : ''}`}>
                                    {match.team2.name}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  {match.division}, {match.refereeTeam ? `Ref: ${match.refereeTeam.name}` : 'No referee'}
                                </div>
                              </div>
                            )}

                            {/* Show schedule violations */}
                            {scheduleViolations.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {scheduleViolations.map((violation: ViolationInfo, vIndex: number) => (
                                  <div
                                    key={vIndex}
                                    className={`text-xs px-2 py-1 rounded ${
                                      violation.type === 'critical'
                                        ? 'bg-red-200 text-red-800'
                                        : violation.type === 'alert'
                                          ? 'bg-red-200 text-red-800'
                                          : violation.type === 'warning'
                                            ? 'bg-yellow-200 text-yellow-800'
                                            : 'bg-blue-200 text-blue-800'
                                    }`}
                                  >
                                    {violation.message}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 p-3">
                {fields.map((field: string) => (
                  <div key={field} className="border rounded overflow-hidden">
                    <div className="bg-gray-100 p-2 font-bold sticky top-0 z-10">{field}</div>
                    <div className="p-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead className="sticky top-8 z-10 bg-white">
                            <tr className="bg-gray-50">
                              <th className="p-2 text-left border">Time Slot</th>
                              <th className="p-2 text-left border">Division</th>
                              <th className="p-2 text-left border">Team 1</th>
                              <th className="p-2 text-left border">Team 2</th>
                              <th className="p-2 text-left border">Referee</th>
                              <th className="p-2 text-left border">Violations</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(groupedMatches[field] || [])
                              .sort((a: Match, b: Match) => a.timeSlot - b.timeSlot)
                              .map((match: Match, idx: number) => {
                                const scheduleViolations = getMatchViolations(match)
                                const hasLegacyViolation = false
                                const rowColor = getRowColor(scheduleViolations)
                                return (
                                  <tr
                                    key={idx}
                                    className={`border-b ${rowColor} ${hasLegacyViolation && scheduleViolations.length === 0 ? 'bg-red-50' : ''}`}
                                  >
                                    <td className="p-2 border">{match.timeSlot}</td>
                                    <td className="p-2 border">
                                      {match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN' ? (
                                        <span
                                          className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                            match.activityType === 'SETUP'
                                              ? 'bg-blue-200 text-blue-800'
                                              : 'bg-purple-200 text-purple-800'
                                          }`}
                                        >
                                          {match.activityType === 'SETUP' ? 'SETUP' : 'PACK DOWN'}
                                        </span>
                                      ) : (
                                        match.division
                                      )}
                                    </td>
                                    <td
                                      className={`p-2 border ${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                                    >
                                      {match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN'
                                        ? match.team1.name !== 'ACTIVITY_PLACEHOLDER'
                                          ? match.team1.name
                                          : '-'
                                        : match.team1.name}
                                    </td>
                                    <td
                                      className={`p-2 border ${scheduleViolations.length > 0 || hasLegacyViolation ? 'text-red-600 font-semibold' : ''}`}
                                    >
                                      {match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN'
                                        ? match.team2.name !== 'ACTIVITY_PLACEHOLDER'
                                          ? match.team2.name
                                          : '-'
                                        : match.team2.name}
                                    </td>
                                    <td className="p-2 border">
                                      {match.activityType === 'SETUP' || match.activityType === 'PACKING_DOWN'
                                        ? '-'
                                        : match.refereeTeam?.name || '-'}
                                    </td>
                                    <td className="p-2 border">
                                      {scheduleViolations.length > 0 ? (
                                        <div className="space-y-1">
                                          {scheduleViolations.map((violation: ViolationInfo, vIndex: number) => (
                                            <div
                                              key={vIndex}
                                              className={`text-xs px-2 py-1 rounded ${
                                                violation.type === 'critical'
                                                  ? 'bg-red-200 text-red-800'
                                                  : violation.type === 'alert'
                                                    ? 'bg-red-200 text-red-800'
                                                    : violation.type === 'warning'
                                                      ? 'bg-yellow-200 text-yellow-800'
                                                      : 'bg-blue-200 text-blue-800'
                                              }`}
                                            >
                                              {violation.message}
                                            </div>
                                          ))}
                                        </div>
                                      ) : hasLegacyViolation ? (
                                        <div className="space-y-1">
                                          {getViolationDescriptions(match).map((desc: string, i: number) => (
                                            <div key={i} className="text-xs px-2 py-1 rounded bg-red-200 text-red-800">
                                              {desc}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-500">-</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
