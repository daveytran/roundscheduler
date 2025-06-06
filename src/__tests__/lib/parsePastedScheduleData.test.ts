import { parsePastedScheduleData } from '../../lib/importUtils';

describe('parsePastedScheduleData - Packdown Handling', () => {
  test('should mark all slots after packdown as packdown activities', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Final,Mixed,14:30,Team D,Team E,2,Team F
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
Clean Up,Mixed,15:30,Team J,Team K,4,Team L
Awards,Mixed,16:00,Team M,Team N,5,Team O`;

    const result = parsePastedScheduleData(scheduleData);

    // Should have 5 rows
    expect(result).toHaveLength(5);

    // First two rows should be normal
    expect(result[0].round).toBe('Final');
    expect(result[0].team1).toBe('Team A');
    expect(result[1].round).toBe('Final');
    expect(result[1].team1).toBe('Team D');

    // Third row should be packdown
    expect(result[2].round).toBe('Packing Down');
    expect(result[2].team1).toBe('Team G');

    // Fourth and fifth rows should be marked as packdown
    expect(result[3].round).toBe('Clean Up - PACKING DOWN');
    expect(result[3].team1).toBe('Team J - PACKING DOWN');
    expect(result[4].round).toBe('Awards - PACKING DOWN');
    expect(result[4].team1).toBe('Team M - PACKING DOWN');
  });

  test('should group all packdown activities into the same time slot as the first packdown', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Final,Mixed,14:30,Team D,Team E,2,Team F
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
Clean Up,Mixed,15:30,Team J,Team K,4,Team L
Awards,Mixed,16:00,Team M,Team N,5,Team O`;

    const result = parsePastedScheduleData(scheduleData);

    // First two rows should keep their original time slots
    expect(result[0].timeSlot).toBe('14:00');
    expect(result[1].timeSlot).toBe('14:30');

    // All packdown activities should have the same time slot as the first packdown
    expect(result[2].timeSlot).toBe('15:00'); // Original packdown
    expect(result[3].timeSlot).toBe('15:00'); // Should be grouped with first packdown
    expect(result[4].timeSlot).toBe('15:00'); // Should be grouped with first packdown
  });

  test('should handle packdown detection in team1 field', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Final,Mixed,14:30,Team D,Team E,2,Team F
Clean Up,Mixed,15:00,PACKING DOWN,Team H,3,Team I
Awards,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Should have 4 rows
    expect(result).toHaveLength(4);

    // Third row triggers packdown (has "PACKING" in team1)
    expect(result[2].round).toBe('Clean Up');
    expect(result[2].team1).toBe('PACKING DOWN');

    // Fourth row should be marked as packdown
    expect(result[3].round).toBe('Awards - PACKING DOWN');
    expect(result[3].team1).toBe('Team J - PACKING DOWN');

    // All packdown activities should share the same time slot
    expect(result[2].timeSlot).toBe('15:00');
    expect(result[3].timeSlot).toBe('15:00');
  });

  test('should handle case-insensitive packdown detection', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
PACKING down activities,Mixed,15:00,Team G,Team H,3,Team I
Clean Up,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Should detect "PACKING down" (mixed case)
    expect(result[1].round).toBe('PACKING down activities');
    expect(result[2].round).toBe('Clean Up - PACKING DOWN');
    expect(result[2].team1).toBe('Team J - PACKING DOWN');

    // Time slot grouping
    expect(result[1].timeSlot).toBe('15:00');
    expect(result[2].timeSlot).toBe('15:00');
  });

  test('should handle empty round fields when converting to packdown', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
,Mixed,15:30,Team J,Team K,4,Team L
,Mixed,16:00,Team M,Team N,5,Team O`;

    const result = parsePastedScheduleData(scheduleData);

    // Rows with empty round should get "PACKING DOWN"
    expect(result[2].round).toBe('PACKING DOWN');
    expect(result[2].team1).toBe('Team J - PACKING DOWN');
    expect(result[3].round).toBe('PACKING DOWN');
    expect(result[3].team1).toBe('Team M - PACKING DOWN');

    // Time slot grouping
    expect(result[1].timeSlot).toBe('15:00');
    expect(result[2].timeSlot).toBe('15:00');
    expect(result[3].timeSlot).toBe('15:00');
  });

  test('should handle empty team1 fields when converting to packdown', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
Clean Up,Mixed,15:30,,Team K,4,Team L
Awards,Mixed,16:00,,Team N,5,Team O`;

    const result = parsePastedScheduleData(scheduleData);

    // Rows with empty team1 should get "PACKING DOWN"
    expect(result[2].round).toBe('Clean Up - PACKING DOWN');
    expect(result[2].team1).toBe('PACKING DOWN');
    expect(result[3].round).toBe('Awards - PACKING DOWN');
    expect(result[3].team1).toBe('PACKING DOWN');
  });

  test('should handle time field vs timeSlot field consistently', () => {
    const scheduleData = `Round,Division,Time Slot,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
Clean Up,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Should detect "Time Slot" header and use timeSlot field
    expect(result[0].timeSlot).toBe('14:00');
    expect(result[1].timeSlot).toBe('15:00');
    expect(result[2].timeSlot).toBe('15:00'); // Grouped with first packdown
  });

  test('should preserve rows that only have packdown detection without team2', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Packing Down,Mixed,15:00,ACTIVITY_PLACEHOLDER,,3,Team I
Clean Up,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Should preserve packdown activities even without team2
    expect(result).toHaveLength(3);
    expect(result[1].round).toBe('Packing Down');
    expect(result[1].team1).toBe('ACTIVITY_PLACEHOLDER');
    expect(result[2].round).toBe('Clean Up - PACKING DOWN');
  });

  test('should handle multiple packdown indicators in same row', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Final,Mixed,14:00,Team A,Team B,1,Team C
Packing Down Activities,Mixed,15:00,Packing Team,Team H,3,Team I
More Work,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Should detect packdown from both round and team1
    expect(result[1].round).toBe('Packing Down Activities');
    expect(result[1].team1).toBe('Packing Team');
    expect(result[2].round).toBe('More Work - PACKING DOWN');
    expect(result[2].team1).toBe('Team J - PACKING DOWN');

    // Time slot grouping
    expect(result[1].timeSlot).toBe('15:00');
    expect(result[2].timeSlot).toBe('15:00');
  });

  test('should handle tab-separated data', () => {
    const scheduleData = `Round	Division	Time	Team1	Team2	Court	Referee
Final	Mixed	14:00	Team A	Team B	1	Team C
Packing Down	Mixed	15:00	Team G	Team H	3	Team I
Clean Up	Mixed	15:30	Team J	Team K	4	Team L`;

    const result = parsePastedScheduleData(scheduleData);

    expect(result).toHaveLength(3);
    expect(result[1].round).toBe('Packing Down');
    expect(result[2].round).toBe('Clean Up - PACKING DOWN');
    expect(result[2].team1).toBe('Team J - PACKING DOWN');

    // Time slot grouping
    expect(result[1].timeSlot).toBe('15:00');
    expect(result[2].timeSlot).toBe('15:00');
  });

  test('should not modify rows before packdown starts', () => {
    const scheduleData = `Round,Division,Time,Team1,Team2,Court,Referee
Setup,Mixed,13:00,Team Setup,Team Helper,1,Team Ref
Semi Final,Mixed,14:00,Team A,Team B,1,Team C
Final,Mixed,14:30,Team D,Team E,2,Team F
Packing Down,Mixed,15:00,Team G,Team H,3,Team I
Awards,Mixed,15:30,Team J,Team K,4,Team L`;

    const result = parsePastedScheduleData(scheduleData);

    // Rows before packdown should remain unchanged
    expect(result[0].round).toBe('Setup');
    expect(result[0].team1).toBe('Team Setup');
    expect(result[0].timeSlot).toBe('13:00');

    expect(result[1].round).toBe('Semi Final');
    expect(result[1].team1).toBe('Team A');
    expect(result[1].timeSlot).toBe('14:00');

    expect(result[2].round).toBe('Final');
    expect(result[2].team1).toBe('Team D');
    expect(result[2].timeSlot).toBe('14:30');

    // Packdown and after should be modified
    expect(result[3].round).toBe('Packing Down');
    expect(result[3].timeSlot).toBe('15:00');
    expect(result[4].round).toBe('Awards - PACKING DOWN');
    expect(result[4].timeSlot).toBe('15:00'); // Grouped with first packdown
  });
}); 