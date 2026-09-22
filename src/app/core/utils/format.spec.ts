import { formatCount, formatDate, formatDuration } from './format';

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(195)).toBe('3:15');
    expect(formatDuration(599)).toBe('9:59');
  });

  it('includes hours past the hour mark', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('returns a placeholder for missing or invalid input', () => {
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(undefined)).toBe('--:--');
    expect(formatDuration(-5)).toBe('--:--');
    expect(formatDuration(NaN)).toBe('--:--');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(65.9)).toBe('1:05');
  });
});

describe('formatCount', () => {
  it('leaves small numbers alone', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('abbreviates thousands and millions', () => {
    expect(formatCount(1000)).toBe('1K');
    expect(formatCount(12345)).toBe('12.3K');
    expect(formatCount(1000000)).toBe('1M');
    expect(formatCount(2500000)).toBe('2.5M');
  });

  it('treats missing values as zero', () => {
    expect(formatCount(null)).toBe('0');
    expect(formatCount(undefined)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date', () => {
    expect(formatDate('2024-01-15T00:00:00Z')).not.toBe('');
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});
