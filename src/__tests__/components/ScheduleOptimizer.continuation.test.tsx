import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScheduleOptimizer from '../../components/ScheduleOptimizer';
import { createMockMatches } from '../../lib/testUtils';
import { Schedule } from '../../models/Schedule';
import { AvoidBackToBackGames } from '../../models/ScheduleRule';

describe('ScheduleOptimizer continuation state', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resets continuation when imported matches change with same count', async () => {
    const rules = [new AvoidBackToBackGames(5)];

    const firstMatches = createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1' },
    ]);

    const secondMatches = createMockMatches([
      { team1: 'Team X', team2: 'Team Y', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team Z', team2: 'Team W', timeSlot: 2, field: 'Field 1' },
    ]);

    jest.spyOn(Schedule.prototype, 'optimize').mockImplementation(async function (this: Schedule, optRules) {
      const result = this.deepCopy();
      result.evaluate(optRules);
      return result;
    });

    const { rerender } = render(<ScheduleOptimizer matches={firstMatches} rules={rules} />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /continue optimization/i })).not.toBeNull();
    });
    expect(screen.queryByText(/ready to continue from optimized schedule/i)).not.toBeNull();

    // Swap in a different schedule with the same number of matches.
    rerender(<ScheduleOptimizer matches={secondMatches} rules={rules} />);

    await waitFor(() => {
      expect(screen.queryByText(/ready to continue from optimized schedule/i)).toBeNull();
    });
    expect(screen.queryByRole('button', { name: /start optimization/i })).not.toBeNull();
  });

  it('continues from the last run best schedule', async () => {
    const rules = [new AvoidBackToBackGames(5)];

    const originalMatches = createMockMatches([
      { team1: 'Team A', team2: 'Team B', timeSlot: 1, field: 'Field 1' },
      { team1: 'Team C', team2: 'Team D', timeSlot: 2, field: 'Field 1' },
    ]);

    const bestFromFirstRunMatches = createMockMatches([
      { team1: 'Best 1', team2: 'Best 2', timeSlot: 3, field: 'Field 2' },
      { team1: 'Best 3', team2: 'Best 4', timeSlot: 4, field: 'Field 2' },
    ]);

    const bestFromFirstRun = new Schedule(bestFromFirstRunMatches);
    bestFromFirstRun.evaluate(rules);

    const callFingerprints: string[] = [];
    const fingerprint = (schedule: Schedule) =>
      schedule.matches
        .map(m => `${m.team1.name}-${m.team2.name}-${m.timeSlot}-${m.field}`)
        .sort()
        .join('|');

    let callCount = 0;
    jest.spyOn(Schedule.prototype, 'optimize').mockImplementation(async function (this: Schedule) {
      callCount += 1;
      callFingerprints.push(fingerprint(this));

      if (callCount === 1) {
        return bestFromFirstRun.deepCopy();
      }

      const result = this.deepCopy();
      result.evaluate(rules);
      return result;
    });

    render(<ScheduleOptimizer matches={originalMatches} rules={rules} />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /continue optimization/i })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue optimization/i }));
    await waitFor(() => {
      expect(callCount).toBe(2);
    });

    expect(callFingerprints[0]).toBe(fingerprint(new Schedule(originalMatches)));
    expect(callFingerprints[1]).toBe(fingerprint(bestFromFirstRun));
  });
});
