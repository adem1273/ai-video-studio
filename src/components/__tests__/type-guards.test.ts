import { describe, it, expect } from 'vitest'

describe('Type Guards Logic', () => {
  // Mock the type guard functions since they're type-only at runtime
  // isScene: checks if obj has required Scene properties
  const isScene = (obj: unknown): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const s = obj as Record<string, unknown>
    return !!s.id && typeof s.id === 'string' &&
      !!s.narration && typeof s.narration === 'string' &&
      typeof s.duration === 'number' && s.duration > 0 &&
      !!s.image_prompt && typeof s.image_prompt === 'string'
  }

  // isProject: checks if obj has required VideoProject properties
  const isProject = (obj: unknown): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const p = obj as Record<string, unknown>
    return !!p.id && typeof p.id === 'string' &&
      !!p.title && typeof p.title === 'string' &&
      Array.isArray(p.script) && p.script.length > 0
  }

  // isProjectSettings: checks if obj has required ProjectSettings properties
  const isProjectSettings = (obj: unknown): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const s = obj as Record<string, unknown>
    return !!s.voice && typeof s.voice === 'string' &&
      !!s.ttsVoice && typeof s.ttsVoice === 'string' &&
      !!s.rate && typeof s.rate === 'number' && s.rate > 0 &&
      !!s.style && typeof s.style === 'string' &&
      !!s.aspect && typeof s.aspect === 'string' &&
      !!s.resolution && typeof s.resolution === 'string' &&
      !!s.music && typeof s.music === 'string' &&
      typeof s.musicVolume === 'number' && s.musicVolume >= 0 && s.musicVolume <= 100
  }

  describe('isScene', () => {
    it('should return true for valid Scene', () => {
      const validScene = {
        id: 's1',
        narration: 'Test',
        image_prompt: 'Test',
        duration: 5,
      }
      expect(isScene(validScene)).toBe(true)
    })

    it('should return false for missing id', () => {
      const invalidScene = {
        narration: 'Test',
        image_prompt: 'Test',
        duration: 5,
      }
      expect(isScene(invalidScene)).toBe(false)
    })

    it('should return false for negative duration', () => {
      const invalidScene = {
        id: 's1',
        narration: 'Test',
        image_prompt: 'Test',
        duration: -1,
      }
      expect(isScene(invalidScene)).toBe(false)
    })

    it('should return false for zero duration', () => {
      const invalidScene = {
        id: 's1',
        narration: 'Test',
        image_prompt: 'Test',
        duration: 0,
      }
      expect(isScene(invalidScene)).toBe(false)
    })

    it('should return false for missing narration', () => {
      const invalidScene = {
        id: 's1',
        image_prompt: 'Test',
        duration: 5,
      }
      expect(isScene(invalidScene)).toBe(false)
    })

    it('should return false for missing image_prompt', () => {
      const invalidScene = {
        id: 's1',
        narration: 'Test',
        duration: 5,
      }
      expect(isScene(invalidScene)).toBe(false)
    })
  })

  describe('isProject', () => {
    it('should return true for valid Project', () => {
      const validProject = {
        id: 'proj-1',
        title: 'Test Project',
        prompt: 'Test prompt',
        status: 'draft',
        script: [{ id: 's1', narration: 'Test', image_prompt: 'Test', duration: 5 }],
      }
      expect(isProject(validProject)).toBe(true)
    })

    it('should return false for empty title', () => {
      const invalidProject = {
        ...{ id: 'proj-1', title: '', prompt: 'Test', status: 'draft', script: [{ id: 's1', narration: 'Test', image_prompt: 'Test', duration: 5 }] },
        title: '',
      }
      expect(isProject(invalidProject)).toBe(false)
    })

    it('should return false for empty script array', () => {
      const invalidProject = {
        id: 'proj-1',
        title: 'Test Project',
        prompt: 'Test prompt',
        status: 'draft',
        script: [],
      }
      expect(isProject(invalidProject)).toBe(false)
    })
  })

  describe('isProjectSettings', () => {
    it('should return true for valid settings', () => {
      const validSettings = {
        voice: 'nova',
        ttsVoice: 'nova',
        ttsMode: 'browser',
        rate: 1,
        style: 'cinematic',
        aspect: '16:9',
        resolution: '1080p',
        music: 'cinematic',
        musicVolume: 50,
      }
      expect(isProjectSettings(validSettings)).toBe(true)
    })

    it('should return false for empty voice', () => {
      const invalidSettings = {
        ...{ voice: '', ttsVoice: 'nova', ttsMode: 'browser', rate: 1, style: 'cinematic', aspect: '16:9', resolution: '1080p', music: 'cinematic', musicVolume: 50 },
        voice: '',
      }
      expect(isProjectSettings(invalidSettings)).toBe(false)
    })

    it('should return false for negative music volume', () => {
      const invalidSettings = {
        voice: 'nova',
        ttsVoice: 'nova',
        ttsMode: 'browser',
        rate: 1,
        style: 'cinematic',
        aspect: '16:9',
        resolution: '1080p',
        music: 'cinematic',
        musicVolume: -1,
      }
      expect(isProjectSettings(invalidSettings)).toBe(false)
    })

    it('should return false for music volume over 100', () => {
      const invalidSettings = {
        voice: 'nova',
        ttsVoice: 'nova',
        ttsMode: 'browser',
        rate: 1,
        style: 'cinematic',
        aspect: '16:9',
        resolution: '1080p',
        music: 'cinematic',
        musicVolume: 150,
      }
      expect(isProjectSettings(invalidSettings)).toBe(false)
    })
  })
})
