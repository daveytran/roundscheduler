import React, { useState, useEffect, useMemo } from 'react';
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
  
  // New state for tracking original matches and current optimized schedule
  const [originalMatches, setOriginalMatches] = useState<Match[]>([]);
  const [currentOptimizedSchedule, setCurrentOptimizedSchedule] = useState<Schedule | null>(null);

  // Throttling state for live updates
  const [lastUIUpdate, setLastUIUpdate] = useState<number>(0);

  // Update original matches when matches prop changes
  useEffect(() => {
    if (matches && matches.length > 0) {
      setOriginalMatches(matches);
      // Only reset scores if we have completely new matches (different count or content)
      if (originalMatches.length !== matches.length) {
        setCurrentOptimizedSchedule(null);
        setOriginalScore(null);
        setCurrentScore(null);
        setBestScore(null);
      }
    }
  }, [matches, originalMatches.length]);

  // Track if settings were changed by user vs props to prevent feedback loop
  const [userChangedSettings, setUserChangedSettings] = useState(false);

  // Update settings when initialSettings change (but not if user made changes)
  useEffect(() => {
    if (initialSettings && !userChangedSettings) {
      setIterations(initialSettings.iterations);
      setStrategyId(initialSettings.strategyId || 'simulated-annealing');
    }
  }, [initialSettings, userChangedSettings]);

  // Save settings when iterations or strategy change (debounced to prevent spam)
  useEffect(() => {
    if (onSettingsChange && userChangedSettings) {
      const timeoutId = setTimeout(() => {
        onSettingsChange({ iterations, strategyId });
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [iterations, strategyId, onSettingsChange, userChangedSettings]);

  const handleStartOptimization = async () => {
    try {
      setError(null);
      setIsOptimizing(true);
      setProgress(0);
      setRenderedSchedule(null);
      setLastUpdateIteration(0);
      setLastUIUpdate(0); // Reset throttling timer
      setUserChangedSettings(false); // Reset user changes flag so future prop updates work

      if (!originalMatches || originalMatches.length === 0) {
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

      // Determine starting point: use current optimized schedule if available, otherwise original matches
      let startingSchedule: Schedule;
      let preservedOriginalScore = originalScore;
      
      if (currentOptimizedSchedule) {
        // Continue optimization from the last optimized result
        startingSchedule = currentOptimizedSchedule.deepCopy();
        // Preserve the original score from the previous optimization
        if (currentOptimizedSchedule.originalScore !== undefined) {
          preservedOriginalScore = currentOptimizedSchedule.originalScore;
        }
        console.log(`🔄 Continuing optimization from previous result with score ${startingSchedule.score}`);
      } else {
        // Start optimization from original matches
        startingSchedule = new Schedule(originalMatches);
        console.log(`🚀 Starting optimization from original matches`);
      }

      // Initial evaluation to get the starting score
      startingSchedule.evaluate(rules);
      const startingScore = startingSchedule.score;
      
      // Set original score only if this is the first optimization
      if (preservedOriginalScore === null) {
        preservedOriginalScore = startingScore;
        setOriginalScore(startingScore);
      } else {
        setOriginalScore(preservedOriginalScore);
      }
      
      setCurrentScore(startingScore);
      setBestScore(startingScore);
      
      console.log(`Starting optimization: ${originalMatches.length} matches, ${rules.length} rules, starting score ${startingScore}`);
      
      // Set initial schedule for visualization
      setRenderedSchedule(startingSchedule.deepCopy());
      setLastUpdateIteration(0);

      // Find the selected optimization strategy
      const selectedStrategy = OPTIMIZATION_STRATEGIES.find(s => s.id === strategyId);

      // Optimize the schedule (pass rules to optimize method)
      const optimized = await startingSchedule.optimize(rules, iterations, info => {
        // Update progress and current score immediately (very lightweight)
        setProgress(info.progress);
        setCurrentScore(info.currentScore); // Always update current score for responsiveness

        // Always update scores on first few iterations to ensure they show
        const isEarlyIteration = info.iteration <= 5;
        
        // Throttle visualization updates after initial iterations to prevent flashing
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUIUpdate;
        const isImprovement = bestScore !== null && info.bestScore < bestScore;
        const isNearCompletion = info.progress >= 0.99;
        
        const shouldUpdate = isEarlyIteration || // Always update first few iterations
                            timeSinceLastUpdate >= 300 || // Update at most every 300ms (reduced from 500ms)
                            isImprovement || // Always update on improvement
                            isNearCompletion; // Always update near completion

        if (shouldUpdate) {
          // Update best score and visualization
          setBestScore(info.bestScore);
          
          // Update visualization
          if (info.currentSchedule) {
            setRenderedSchedule(info.currentSchedule);
            setLastUpdateIteration(info.iteration);
          }
          
          setLastUIUpdate(now);
        }
      }, selectedStrategy);

      // Final evaluation
      optimized.evaluate(rules);

      // Ensure the optimized schedule has the correct originalScore
      if (preservedOriginalScore !== null) {
        optimized.originalScore = preservedOriginalScore;
      }

      // Store the optimized schedule for future continuation
      setCurrentOptimizedSchedule(optimized);

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

  const handleResetToOriginal = () => {
    if (window.confirm('Are you sure you want to reset to the original schedule? This will lose your current optimization progress.')) {
      setCurrentOptimizedSchedule(null);
      setOriginalScore(null);
      setCurrentScore(null);
      setBestScore(null);
      setRenderedSchedule(null);
      setError(null);
      console.log('🔄 Reset to original schedule');
      
      // Notify parent component with original schedule
      if (onOptimizationComplete && originalMatches.length > 0) {
        const originalSchedule = new Schedule(originalMatches);
        originalSchedule.evaluate(rules);
        // Clear any originalScore property since this is the original
        originalSchedule.originalScore = undefined;
        onOptimizationComplete(originalSchedule);
      }
    }
  };



  const hasOptimizedSchedule = currentOptimizedSchedule !== null;
  const isStartingFromOptimized = hasOptimizedSchedule && !isOptimizing;

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Optimizer</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          The optimizer will attempt to minimize rule violations using different strategies. 
          {isStartingFromOptimized 
            ? ' Continue optimizing from your current result, or reset to start over.'
            : ' Choose a strategy that best fits your needs and adjust iterations for better results.'
          }
        </p>

        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Optimization Strategy</label>
            <select
              value={strategyId}
              onChange={e => {
                setStrategyId(e.target.value);
                setUserChangedSettings(true);
              }}
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
              onChange={e => {
                setIterations(parseInt(e.target.value) || 0);
                setUserChangedSettings(true);
              }}
              min="0"
              step="1000"
              className="w-32 p-2 border rounded"
              disabled={isOptimizing}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartOptimization}
              disabled={isOptimizing || !originalMatches || originalMatches.length === 0 || !rules || rules.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
              {isOptimizing 
                ? 'Optimizing...' 
                : isStartingFromOptimized 
                  ? 'Continue Optimization' 
                  : 'Start Optimization'
              }
            </button>

            {hasOptimizedSchedule && !isOptimizing && (
              <button
                onClick={handleResetToOriginal}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                title="Reset to the original unoptimized schedule"
              >
                🔄 Reset to Original
              </button>
            )}
          </div>
        </div>

        {/* Status message for current state */}
        {isStartingFromOptimized && !isOptimizing && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🎯</span>
              <span className="text-sm text-blue-800 font-medium">
                Ready to continue from optimized schedule (Score: {currentOptimizedSchedule?.score})
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Next optimization will start from your current results, not the original schedule.
            </p>
          </div>
        )}

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
            
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <strong>Debug:</strong> Original: {originalScore}, Best: {bestScore}, Current: {currentScore}
              </div>
            )}

            {/* Always show original score if available */}
            {originalScore !== null && (
              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Original Score:</span> {originalScore}
                  {originalScore === 0 ? ' (Already perfect!)' : ''}
                </p>
              </div>
            )}

            {/* Show current score during optimization (before best score for logical flow) */}
            {isOptimizing && currentScore !== null && (
              <div className="mb-2">
                <p className="text-sm text-blue-600">
                  <span className="font-medium">Current Score:</span> {currentScore}
                  {bestScore !== null && currentScore === bestScore && (
                    <span className="ml-2 text-xs text-blue-500">(matches best)</span>
                  )}
                  {bestScore !== null && currentScore > bestScore && (
                    <span className="ml-2 text-xs text-amber-600">(exploring)</span>
                  )}
                  {bestScore !== null && currentScore < bestScore && (
                    <span className="ml-2 text-xs text-green-600">(improvement!)</span> 
                  )}
                </p>
              </div>
            )}

            {/* Show best score independently */}
            {bestScore !== null && (
              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Best Score:</span> {bestScore}
                  {bestScore === 0 ? ' 🎉 (Perfect schedule!)' : ''}
                </p>

                {/* Show improvement only if we have both scores */}
                {originalScore !== null && originalScore !== bestScore && (
                  <div className="mt-1">
                    <p className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                      ✅ Improvement: {originalScore - bestScore} points (
                      {Math.round(((originalScore - bestScore) / originalScore) * 100)}% better)
                    </p>
                  </div>
                )}

                {originalScore !== null && originalScore === bestScore && originalScore > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ No improvement found - try more iterations or adjust rules
                    </p>
                  </div>
                )}
              </div>
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
                Live update: Iteration {lastUpdateIteration}
              </div>
              {renderedSchedule && (
                <div className={`px-2 py-1 rounded text-xs font-medium ${
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
