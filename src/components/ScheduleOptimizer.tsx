import React, { useState, useEffect } from 'react'
import { Schedule } from '../models/Schedule'
import { Match } from '../models/Match'
import { ScheduleRule } from '../models/ScheduleRule'
import { OptimizerSettings } from '../lib/localStorage'

// Type for the progress callback info
interface OptimizationProgressInfo {
  iteration: number
  progress: number
  currentScore: number
  bestScore: number
  temperature: number
  violations: any[]
}

// Props interface
interface ScheduleOptimizerProps {
  matches: Match[]
  rules: ScheduleRule[]
  initialSettings?: OptimizerSettings
  onSettingsChange?: (settings: OptimizerSettings) => void
  onOptimizationComplete?: (schedule: Schedule) => void
}

export default function ScheduleOptimizer({
  matches,
  rules,
  initialSettings,
  onSettingsChange,
  onOptimizationComplete,
}: ScheduleOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [iterations, setIterations] = useState(initialSettings?.iterations || 10000)
  const [originalScore, setOriginalScore] = useState<number | null>(null)
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Update iterations when initialSettings change
  useEffect(() => {
    if (initialSettings) {
      setIterations(initialSettings.iterations)
    }
  }, [initialSettings])

  // Save settings when iterations change
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({ iterations })
    }
  }, [iterations, onSettingsChange])

  const handleStartOptimization = async () => {
    try {
      setError(null)
      setIsOptimizing(true)
      setProgress(0)
      setOriginalScore(null)
      setCurrentScore(null)
      setBestScore(null)

      if (!matches || matches.length === 0) {
        throw new Error('No matches to optimize')
      }

      if (!rules || rules.length === 0) {
        throw new Error('No rules configured for optimization')
      }

      // Validate that rules have proper evaluate methods
      const invalidRules = rules.filter(rule => !rule || typeof rule.evaluate !== 'function')
      if (invalidRules.length > 0) {
        throw new Error('Some rules are not properly initialized. Please visit the Rules tab first to configure them.')
      }

      // Create a new schedule with the provided matches and rules
      const schedule = new Schedule(matches, rules)

      // Initial evaluation to get the original score
      schedule.evaluate()
      const originalScheduleScore = schedule.score
      setOriginalScore(originalScheduleScore)
      setCurrentScore(originalScheduleScore)
      setBestScore(originalScheduleScore)

      // Optimize the schedule
      const optimized = await schedule.optimize(iterations, info => {
        setProgress(info.progress)
        setCurrentScore(info.currentScore)
        setBestScore(info.bestScore)
      })

      // Final evaluation
      optimized.evaluate()

      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(optimized)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Optimization error: ${errorMessage}`)
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Optimizer</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          The optimizer will attempt to minimize rule violations using simulated annealing. It shuffles match time slots
          and referee assignments to find better arrangements. Higher iteration counts will produce better results but
          take longer.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Iterations</label>
            <input
              type="number"
              value={iterations}
              onChange={e => setIterations(parseInt(e.target.value))}
              min="0"
              step="1000"
              className="w-32 p-2 border rounded"
              disabled={isOptimizing}
            />
          </div>

          <button
            onClick={handleStartOptimization}
            disabled={isOptimizing || !matches || matches.length === 0 || !rules || rules.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {isOptimizing ? 'Optimizing...' : 'Start Optimization'}
          </button>
        </div>

        {isOptimizing && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.round(progress * 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{Math.round(progress * 100)}% complete</span>
              <span>
                Iteration {Math.round(progress * iterations)} of {iterations}
              </span>
            </div>
          </div>
        )}

        {(originalScore !== null || currentScore !== null || bestScore !== null) && (
          <div className="p-3 bg-gray-50 border rounded">
            <h3 className="font-bold mb-2">Optimization Results</h3>

            {originalScore !== null && (
              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Original Score:</span> {originalScore}
                  {originalScore === 0 ? ' (Already perfect!)' : ''}
                </p>
              </div>
            )}

            {bestScore !== null && originalScore !== null && (
              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Best Score:</span> {bestScore}
                  {bestScore === 0 ? ' 🎉 (Perfect schedule!)' : ''}
                </p>

                {originalScore !== bestScore && (
                  <div className="mt-1">
                    <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                      ✅ Improvement: {originalScore - bestScore} points (
                      {Math.round(((originalScore - bestScore) / originalScore) * 100)}% better)
                    </p>
                  </div>
                )}

                {originalScore === bestScore && originalScore > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ No improvement found - try more iterations or adjust rules
                    </p>
                  </div>
                )}
              </div>
            )}

            {isOptimizing && currentScore !== null && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Current Score:</span> {currentScore}
              </p>
            )}
          </div>
        )}

        {error && <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">{error}</div>}
      </div>
    </div>
  )
}
