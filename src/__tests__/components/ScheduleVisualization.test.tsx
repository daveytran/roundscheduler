import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ScheduleVisualization from '../../components/ScheduleVisualization';
import { Schedule } from '../../models/Schedule';
import { createMockMatch } from '../../lib/testUtils';

describe('ScheduleVisualization', () => {
  it('shows a violations-only view mode in the visualization', () => {
    const match = createMockMatch('Team A', 'Team B', 1, 'Field 1', 'mixed', 'Team C');
    const schedule = new Schedule([match]);
    schedule.score = 5;
    schedule.violations = [
      {
        rule: 'Consecutive Games Rule',
        description: 'Team A has back-to-back games',
        level: 'warning',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);

    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));

    expect(screen.getByText('Violation List (1)')).toBeTruthy();
    expect(screen.getByText('Consecutive Games Rule')).toBeTruthy();
    expect(screen.getByText('Team A has back-to-back games')).toBeTruthy();
    expect(screen.queryByText('Time Slot 1')).toBeNull();
  });

  it('respects Show Notes in violations-only mode', () => {
    const match = createMockMatch('Team D', 'Team E', 2, 'Field 2', 'mixed', 'Team F');
    const schedule = new Schedule([match]);
    schedule.score = 2;
    schedule.violations = [
      {
        rule: 'Warning Rule',
        description: 'Warning violation',
        level: 'warning',
        matches: [match],
      },
      {
        rule: 'Note Rule',
        description: 'Note violation',
        level: 'note',
        matches: [match],
      },
    ];

    render(<ScheduleVisualization schedule={schedule} />);

    fireEvent.click(screen.getByRole('button', { name: 'Violations Only' }));
    expect(screen.getByText('Violation List (1)')).toBeTruthy();
    expect(screen.queryByText('Note violation')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Notes' }));

    expect(screen.getByText('Violation List (2)')).toBeTruthy();
    expect(screen.getByText('Note violation')).toBeTruthy();
  });
});
