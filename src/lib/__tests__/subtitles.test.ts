import { parseSRT, generateSRT, generateSubtitles, renderSubtitlesOnCanvas, getSubtitleAtTime, mergeSubtitles, validateSubtitles } from './subtitles';

describe('Subtitle Parser', () => {
  it('should parse basic SRT', () => {
    const srtContent = '1\n00:00:00,000 --> 00:00:05,000\nHello World';
    const subtitles = parseSRT(srtContent);
    expect(subtitles.length).toBe(1);
    expect(subtitles[0].text).toBe('Hello World');
  });

  it('should parse multi-line SRT', () => {
    const srtContent = '1\n00:00:00,000 --> 00:00:05,000\nHello World\n2\n00:00:05,001 --> 00:00:10,000\nSecond subtitle';
    const subtitles = parseSRT(srtContent);
    expect(subtitles.length).toBe(2);
  });
});

describe('Subtitle Generator', () => {
  it('should generate SRT from entries', () => {
    const entries = [
      { startTime: 0, endTime: 5, text: 'Hello', index: 0 },
      { startTime: 5, endTime: 10, text: 'World', index: 1 },
    ];
    const srt = generateSRT(entries);
    expect(srt).toContain('Hello');
    expect(srt).toContain('World');
  });

  it('should generate subtitle entries', () => {
    const subtitles = generateSubtitles([{ text: 'Test', start: 0, end: 3 }]);
    expect(subtitles.length).toBe(1);
    expect(subtitles[0].text).toBe('Test');
  });
});

describe('Subtitle Merger', () => {
  it('should merge overlapping subtitles', () => {
    const subtitles = [
      { startTime: 0, endTime: 3, text: 'Hello', index: 0 },
      { startTime: 2, endTime: 5, text: ' World', index: 1 },
    ];
    const merged = mergeSubtitles(subtitles);
    expect(merged.length).toBe(1);
    expect(merged[0].text).toBe('Hello World');
    expect(merged[0].startTime).toBe(0);
    expect(merged[0].endTime).toBe(5);
  });
});

describe('Subtitle Validator', () => {
  it('should validate subtitle entries', () => {
    const validSubs = [
      { startTime: 0, endTime: 5, text: 'Hello', index: 0 },
    ];
    const error = validateSubtitles(validSubs);
    expect(error).toBeNull();
  });

  it('should reject invalid entries', () => {
    const invalidSubs = [
      { startTime: 5, endTime: 3, text: 'Bad', index: 0 }, // end before start
    ];
    const error = validateSubtitles(invalidSubs);
    expect(error).not.toBeNull();
  });
});
