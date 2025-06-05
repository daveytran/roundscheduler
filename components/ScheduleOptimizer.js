import { useState } from 'react';
import { Schedule } from '../models/Schedule';
import { optimizeSchedule } from '../lib/scheduler';

export default function ScheduleOptimizer({ matches, rules, onOptimizationComplete }) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [iterations, setIterations] = useState(10000);
  const [currentScore, setCurrentScore] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [error, setError] = useState(null);
  
  const handleStartOptimization = async () => {
    try {
      setError(null);
      setIsOptimizing(true);
      setProgress(0);
      setCurrentScore(null);
      setBestScore(null);
      
      if (!matches || matches.length === 0) {
        throw new Error('No matches to optimize');
      }
      
      if (!rules || rules.length === 0) {
        throw new Error('No rules configured for optimization');
      }
      
      // Create a new schedule with the provided matches and rules
      const schedule = new Schedule(matches, rules);
      
      // Initial evaluation
      schedule.evaluate();
      setCurrentScore(schedule.score);
      setBestScore(schedule.score);
      
      // Optimize the schedule
      const optimized = await optimizeSchedule(schedule, {
        iterations,
        progressCallback: (info) => {
          setProgress(info.progress);
          setCurrentScore(info.currentScore);
          setBestScore(info.bestScore);
        }
      });
      
      // Final evaluation
      optimized.evaluate();
      
      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(optimized);
      }
      
    } catch (err) {
      setError(`Optimization error: ${err.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };
  
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Schedule Optimizer</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          The optimizer will attempt to minimize rule violations using simulated annealing.
          Higher iteration counts will produce better results but take longer.
        </p>
        
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Iterations
            </label>
            <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(Math.max(1000, Math.min(100000, parseInt(e.target.value) || 10000)))}
              min="1000"
              max="100000"
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
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${Math.round(progress * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{Math.round(progress * 100)}% complete</span>
              <span>Iteration {Math.round(progress * iterations)} of {iterations}</span>
            </div>
          </div>
        )}
        
        {(currentScore !== null || bestScore !== null) && (
          <div className="p-3 bg-gray-50 border rounded">
            <h3 className="font-bold mb-1">Optimization Results</h3>
            {currentScore !== null && (
              <p className="text-sm">Current Score: {currentScore}</p>
            )}
            {bestScore !== null && (
              <p className="text-sm">Best Score: {bestScore} {bestScore === 0 ? '(Perfect schedule!)' : ''}</p>
            )}
          </div>
        )}
        
        {error && (
          <div className="p-2 mt-3 bg-red-100 border border-red-300 text-red-500 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}