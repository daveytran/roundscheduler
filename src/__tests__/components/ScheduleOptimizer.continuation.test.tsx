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

    jest.spyOn(Schedule.prototype, 'optimize').mockImplementation(async function (optRules) {
      const result = this.deepCopy();
      result.evaluate(optRules);
      return result;
    });

    const { rerender } = render(<ScheduleOptimizer matches={firstMatches} rules={rules} />);

    fireEvent.click(screen.getByRole('button', { name: /start optimization/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue optimization/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/ready to continue from optimized schedule/i)).toBeInTheDocument();

    // Swap in a different schedule with the same number of matches.
    rerender(<ScheduleOptimizer matches={secondMatches} rules={rules} />);

    await waitFor(() => {
      expect(screen.queryByText(/ready to continue from optimized schedule/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /start optimization/i })).toBeInTheDocument();
  });
});
