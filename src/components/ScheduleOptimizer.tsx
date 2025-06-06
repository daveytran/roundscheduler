import React, { useState, useEffect } from 'react';
import { Schedule } from '../models/Schedule';
import { Match } from '../models/Match';
import { ScheduleRule } from '../models/ScheduleRule';
import { OptimizerSettings } from '../lib/localStorage';
import { OPTIMIZATION_STRATEGIES, OptimizationStrategyInfo } from '../models/OptimizationStrategy';
import ScheduleVisualization from './ScheduleVisualization';

// Type for the progress callback info
interface OptimizationProgressInfo {
  iteration: number;
  progress: number;
  currentScore: number;
  bestScore: number;
  temperature: number;
  violations: any[];
}

// Props interface
interface ScheduleOptimizerProps {
  matches: Match[];
  rules: ScheduleRule[];
  initialSettings?: OptimizerSettings;
  onSettingsChange?: (settings: OptimizerSettings) => void;
  onOptimizationComplete?: (schedule: Schedule) => void;
}

export default function ScheduleOptimizer({
  matches,
  rules,
  initialSettings,
  onSettingsChange,
  onOptimizationComplete,
}: ScheduleOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [iterations, setIterations] = useState(initialSettings?.iterations || 10000);
  const [strategyId, setStrategyId] = useState(initialSettings?.strategyId || 'simulated-annealing');
  const [originalScore, setOriginalScore] = useState<number | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedSchedule, setRenderedSchedule] = useState<Schedule | null>(null);
  const [showLiveVisualization, setShowLiveVisualization] = useState(true);
  const [lastUpdateIteration, setLastUpdateIteration] = useState<number>(0);

  // Update settings when initialSettings change
  useEffect(() => {
    if (initialSettings) {
      setIterations(initialSettings.iterations);
      setStrategyId(initialSettings.strategyId || 'simulated-annealing');
    }
  }, [initialSettings]);

  // Save settings when iterations or strategy change
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({ iterations, strategyId });
    }
  }, [iterations, strategyId, onSettingsChange]);

  const handleStartOptimization = async () => {
    try {
      setError(null);
      setIsOptimizing(true);
      setProgress(0);
      setOriginalScore(null);
      setCurrentScore(null);
      setBestScore(null);
      setRenderedSchedule(null);
      setLastUpdateIteration(0);

      if (!matches || matches.length === 0) {
        throw new Error('No matches to optimize');
      }

      if (!rules || rules.length === 0) {
        throw new Error('No rules configured for optimization');
      }

      // Validate that rules have proper evaluate methods
      const invalidRules = rules.filter(rule => !rule || typeof rule.evaluate !== 'function');
      if (invalidRules.length > 0) {
        throw new Error('Some rules are not properly initialized. Please visit the Rules tab first to configure them.');
      }

      // Create a new schedule with the provided matches (no rules in constructor)
      const schedule = new Schedule(matches);

      // Initial evaluation to get the original score
      schedule.evaluate(rules); // Pass rules to evaluate method
      const originalScheduleScore = schedule.score;
      
      console.log(`🚀 Starting optimization: ${matches.length} matches, ${rules.length} rules, score ${originalScheduleScore}`);
      
      setOriginalScore(originalScheduleScore);
      setCurrentScore(originalScheduleScore);
      setBestScore(originalScheduleScore);
      
      // Set initial schedule for visualization
      setRenderedSchedule(schedule.deepCopy());
      setLastUpdateIteration(0);

      // Find the selected optimization strategy
      const selectedStrategy = OPTIMIZATION_STRATEGIES.find(s => s.id === strategyId);

      // Optimize the schedule (pass rules to optimize method)
      const optimized = await schedule.optimize(rules, iterations, info => {
        setProgress(info.progress);
        setCurrentScore(info.currentScore);
        setBestScore(info.bestScore);

        // Update schedules for live visualization - show best schedule found so far
        info.currentSchedule&& setRenderedSchedule(info.currentSchedule);
          setLastUpdateIteration(info.iteration);
      }, selectedStrategy);

      // Final evaluation
      optimized.evaluate(rules);

      // Clear live preview now that optimization is complete
      setRenderedSchedule(null);

      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(optimized);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Optimization error: ${errorMessage}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Optimizer</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          The optimizer will attempt to minimize rule violations using different strategies. Choose a strategy that best fits your needs and adjust iterations for better results.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Optimization Strategy</label>
            <select
              value={strategyId}
              onChange={e => setStrategyId(e.target.value)}
              className="w-48 p-2 border rounded"
              disabled={isOptimizing}
            >
              {OPTIMIZATION_STRATEGIES.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>

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

        {/* Strategy Description */}
        {(() => {
          const selectedStrategy = OPTIMIZATION_STRATEGIES.find(s => s.id === strategyId);
          return selectedStrategy ? (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-medium text-blue-900 mb-1">{selectedStrategy.name}</h4>
              <p className="text-sm text-blue-700">{selectedStrategy.description}</p>
            </div>
          ) : null;
        })()}

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

      {/* Live Visualization Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLiveVisualization}
            onChange={e => setShowLiveVisualization(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Show live optimization visualization</span>
        </label>
        {showLiveVisualization && (
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Watch as violations are reduced and the schedule score improves during optimization. Updates immediately when improvements are found.
          </p>
        )}
      </div>

      {/* Live Schedule Visualization - Only show during optimization */}
      {showLiveVisualization && isOptimizing && renderedSchedule && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Live Optimization Progress</h3>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Last updated: Iteration {lastUpdateIteration}
              </div>
              {renderedSchedule && (
                <div className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ${
                  renderedSchedule.score === 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Score: {renderedSchedule.score} | Violations: {renderedSchedule.violations?.length || 0}
                </div>
              )}
            </div>
          </div>
          <ScheduleVisualization schedule={renderedSchedule} />
        </div>
      )}

      {/* Message when optimization is complete */}
      {!isOptimizing && showLiveVisualization && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-medium">Optimization Complete</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Final optimized schedule is shown below in the results section.
          </p>
        </div>
      )}
    </div>
  );
}
