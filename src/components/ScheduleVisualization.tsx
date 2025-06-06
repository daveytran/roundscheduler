import React, { useState, useEffect } from 'react'
import { Schedule } from '../models/Schedule'
import { Match } from '../models/Match'
import { RuleViolation } from '../models/RuleViolation'

interface ScheduleVisualizationProps {
  schedule: Schedule
}

interface GroupedMatches {
  [key: string]: Match[]
}

interface GroupedMatchesByTime {
  [timeSlot: number]: Match[]
}

interface ViolationInfo {
  type: 'note' | 'warning' | 'alert' | 'critical'
  message: string
}

export default function ScheduleVisualization({ schedule }: ScheduleVisualizationProps) {
  const [violations, setViolations] = useState<RuleViolation[]>([])
  const [viewMode, setViewMode] = useState<'by_time' | 'by_field'>('by_time')
  const [selectedDivision, setSelectedDivision] = useState<string>('all')
  const [showSpecialActivities, setShowSpecialActivities] = useState<boolean>(true)
  const [showNotes, setShowNotes] = useState<boolean>(false)
  const [isViolationsExpanded, setIsViolationsExpanded] = useState<boolean>(false)

  useEffect(() => {
    if (schedule) {
      setViolations(schedule.violations || [])
    }
  }, [schedule])

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
  } else {
    filteredMatches.forEach((match: Match) => {
      if (!groupedMatches[match.field]) {
        groupedMatches[match.field] = []
      }
      groupedMatches[match.field].push(match)
    })
  }

  // Helper to check if a match has violations (legacy system)
  const matchHasViolations = (match: Match): boolean => {
    return violations.some(
      (v: RuleViolation) =>
        v.matches &&
        v.matches.some(
          (m: Match) =>
            (m.team1.name === match.team1.name && m.team2.name === match.team2.name) ||
            (m.team1.name === match.team2.name && m.team2.name === match.team1.name)
        )
    )
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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showNotes}
              onChange={e => setShowNotes(e.target.checked)}
              className="rounded"
            />
            Show Notes
          </label>

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
          </div>

          <button onClick={handleExportCSV} className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">
            Export CSV
          </button>
        </div>
      </div>

      {/* Color Legend */}
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

      {schedule.score > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <button
            onClick={() => setIsViolationsExpanded(!isViolationsExpanded)}
            className="flex items-center justify-between w-full text-left hover:bg-amber-100 rounded p-1 -m-1"
          >
            <h3 className="font-bold text-amber-800">
              Schedule Violations (Score: {schedule.score}) - {violations.length} violation
              {violations.length !== 1 ? 's' : ''}
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
              {violations.map((v: RuleViolation, i: number) => (
                <li key={i} className="text-amber-700">
                  {v.rule}: {v.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewMode === 'by_time' ? (
        <div className="space-y-6">
          {timeSlots.map((slot: number) => (
            <div key={slot} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">Time Slot {slot}</div>
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
        <div className="space-y-6">
          {fields.map((field: string) => (
            <div key={field} className="border rounded overflow-hidden">
              <div className="bg-gray-100 p-2 font-bold">{field}</div>
              <div className="p-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
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
          ))}
        </div>
      )}
    </div>
  )
}
