import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ScheduleFormatOptions from '../../components/ScheduleFormatOptions';
import { Match } from '../../models/Match';
import { createMockTeam } from '../../lib/testUtils';

describe('ScheduleFormatOptions', () => {
  it('preserves activityType and locked flags in "As Imported" formatting', () => {
    const teamA = createMockTeam('Team A', 'mixed');
    const teamB = createMockTeam('Team B', 'mixed');
    const teamC = createMockTeam('Team C', 'mixed');
    const teamD = createMockTeam('Team D', 'mixed');

    const matches = [
      new Match(teamA, teamB, 5, 'Field 1', 'mixed', null, 'SETUP', true),
      new Match(teamC, teamD, 7, 'Field 2', 'mixed', null, 'REGULAR', false),
      new Match(teamA, teamB, 9, 'Field 1', 'mixed', null, 'PACKING_DOWN', true),
    ];

    const onFormatApplied = jest.fn();
    render(<ScheduleFormatOptions matches={matches} onFormatApplied={onFormatApplied} />);

    fireEvent.click(screen.getByRole('button', { name: /apply format/i }));

    expect(onFormatApplied).toHaveBeenCalledTimes(1);
    const formatted = onFormatApplied.mock.calls[0][0] as Match[];

    expect(formatted).toHaveLength(3);
    expect(formatted[0].activityType).toBe('SETUP');
    expect(formatted[0].locked).toBe(true);
    expect(formatted[1].activityType).toBe('REGULAR');
    expect(formatted[1].locked).toBe(false);
    expect(formatted[2].activityType).toBe('PACKING_DOWN');
    expect(formatted[2].locked).toBe(true);
  });
});

