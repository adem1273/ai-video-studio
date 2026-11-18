import { generateScriptWithFallback, generateLocalScript, extractTopicFromPrompt, generateTopicSpecificNarration } from './scriptGenerator';

describe('Script Generator - Topic Extraction', () => {
  it('should extract topic from Turkish prompt', () => {
    const prompt = 'Quantum bilgisayarlar hakkında video yap';
    const topic = extractTopicFromPrompt(prompt);
    expect(topic).toContain('Quantum');
    expect(topic).toContain('bilgisayar');
  });

  it('should extract topic from English prompt', () => {
    const prompt = 'Make a video about climate change';
    const topic = extractTopicFromPrompt(prompt);
    expect(topic).toContain('climate');
    expect(topic).toContain('change');
  });

  it('should handle short prompts', () => {
    const prompt = 'test';
    const topic = extractTopicFromPrompt(prompt);
    expect(topic).toBe('test');
  });
});

describe('Script Generator - Topic-Specific Narration', () => {
  it('should generate narration for topic', () => {
    const topic = 'Quantum bilgisayarlar';
    const narration = generateTopicSpecificNarration(topic, 0, 3);
    expect(narration).toContain('Quantum');
    expect(narration.length).toBeGreaterThan(10);
  });

  it('should generate different narration for different scene indices', () => {
    const topic = 'Kara köpek';
    const scene0 = generateTopicSpecificNarration(topic, 0, 3);
    const scene1 = generateTopicSpecificNarration(topic, 1, 3);
    const scene2 = generateTopicSpecificNarration(topic, 2, 3);
    // All should contain the topic but be different
    expect(scene0).toContain('Kara');
    expect(scene1).toContain('Kara');
    expect(scene2).toContain('Kara');
    // They should be different templates
    expect(scene0).not.toBe(scene1);
  });

  it('should handle empty topic', () => {
    const narration = generateTopicSpecificNarration('', 0, 3);
    expect(narration).toContain('Konu');
  });
});

describe('Script Generator - Local Script', () => {
  it('should generate title for tutorial type', () => {
    const prompt = 'How to bake a cake tutorial';
    const result = generateLocalScript(prompt, 3, 'tutorial', 'tr-TR');
    expect(result.title).toBeDefined();
    expect(result.scenes.length).toBe(3);
  });

  it('should generate title for story type', () => {
    const prompt = 'Once upon a time story';
    const result = generateLocalScript(prompt, 3, 'story', 'tr-TR');
    expect(result.title).toBeDefined();
    expect(result.scenes.length).toBe(3);
  });
});
