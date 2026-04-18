import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_START_HOUR,
  SCHEDULE_END_HOUR,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  CELL_MIN_WIDTH,
  minutesSinceStart,
  cellLeft,
  cellWidth,
  currentTimeMinutes,
  sunsetMinutesForDate,
  hoursLabels,
} from '../schedule-geometry';

describe('constants', () => {
  it('exports the 11–25 grid window with 3px/min', () => {
    expect(SCHEDULE_START_HOUR).toBe(11);
    expect(SCHEDULE_END_HOUR).toBe(25);
    expect(PX_PER_MINUTE).toBe(3);
    expect(ROW_HEIGHT).toBe(72);
    expect(CELL_MIN_WIDTH).toBe(48);
  });
});

describe('minutesSinceStart', () => {
  it('returns 0 for 11:00 exactly', () => {
    expect(minutesSinceStart('11:00')).toBe(0);
  });
  it('returns 105 for 12:45', () => {
    expect(minutesSinceStart('12:45')).toBe(105);
  });
  it('returns 840 for 01:00 next day (25:00)', () => {
    expect(minutesSinceStart('01:00')).toBe((25 - 11) * 60);
  });
  it('returns a negative number for times before the grid opens (treat as pre-window)', () => {
    expect(minutesSinceStart('09:00')).toBeLessThan(0);
  });
});

describe('cellLeft / cellWidth', () => {
  it('cellLeft multiplies minutesSinceStart by PX_PER_MINUTE', () => {
    expect(cellLeft('12:00')).toBe(60 * PX_PER_MINUTE);
  });
  it('cellWidth uses runtime * PX_PER_MINUTE', () => {
    expect(cellWidth(108)).toBe(108 * PX_PER_MINUTE);
  });
  it('cellWidth floors at CELL_MIN_WIDTH', () => {
    expect(cellWidth(5)).toBe(CELL_MIN_WIDTH);
  });
  it('cellWidth handles null runtime as CELL_MIN_WIDTH', () => {
    expect(cellWidth(null)).toBe(CELL_MIN_WIDTH);
  });
});

describe('currentTimeMinutes', () => {
  it('returns null when "now" is outside the grid window', () => {
    const tenAm = new Date('2026-04-23T10:00:00');
    expect(currentTimeMinutes(tenAm, '2026-04-23')).toBeNull();
  });
  it('returns minutes offset inside the window', () => {
    const fn = new Date('2026-04-23T14:30:00');
    expect(currentTimeMinutes(fn, '2026-04-23')).toBe(210);
  });
  it('returns null when the selected date is not today', () => {
    const now = new Date('2026-04-23T14:30:00');
    expect(currentTimeMinutes(now, '2026-04-24')).toBeNull();
  });
});

describe('sunsetMinutesForDate', () => {
  it('returns a value in the grid window for April (≈ 8:05pm)', () => {
    const offset = sunsetMinutesForDate('2026-04-23');
    // 20:10 → 9h10 after 11:00 = 550 min, allow ±15 min table tolerance
    expect(offset).toBeGreaterThan(525);
    expect(offset).toBeLessThan(570);
  });
  it('returns a value in the grid window for December (≈ 5:30pm)', () => {
    const offset = sunsetMinutesForDate('2026-12-21');
    // 17:30 → 6h30 after 11:00 = 390 min, allow ±20 min
    expect(offset).toBeGreaterThan(370);
    expect(offset).toBeLessThan(410);
  });
});

describe('hoursLabels', () => {
  it('returns 15 entries covering 11 AM through 1 AM', () => {
    const labels = hoursLabels();
    expect(labels).toHaveLength(SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1);
    expect(labels[0]).toMatchObject({ label: '11 AM', minutes: 0 });
    expect(labels[1]).toMatchObject({ label: '12 PM', minutes: 60 });
    expect(labels[13]).toMatchObject({ label: '12 AM' });
    expect(labels[14]).toMatchObject({ label: '1 AM' });
  });
});
