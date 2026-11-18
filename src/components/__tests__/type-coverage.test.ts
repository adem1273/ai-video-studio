import { describe, it, expect } from 'vitest'
// Test that type guards work correctly at runtime
import { isScene, isProject, isProjectSettings } from '@/lib/types'

describe('Type Coverage', () => {
  // isScene coverage tests
  it('isScene validates scene with all required fields', () => {
    const validScene = {
      id: 's1',
      narration: 'Test narration',
      image_prompt: 'Test image',
      duration: 5,
    }
    expect(isScene(validScene)).toBe(true)
  })

  it('isScene rejects scene with negative duration', () => {
    const invalidScene = {
      id: 's1',
      narration: 'Test',
      image_prompt: 'Test',
      duration: -1,
    }
    expect(isScene(invalidScene)).toBe(false)
  })

  it('isScene rejects scene with zero duration', () => {
    const invalidScene = {
      id: 's1',
      narration: 'Test',
      image_prompt: 'Test',
      duration: 0,
    }
    expect(isScene(invalidScene)).toBe(false)
  })

  // isProject coverage tests
  it('isProject validates project with all required fields', () => {
    const validScene = {
      id: 's1',
      narration: 'Test',
      image_prompt: 'Test',
      duration: 5,
    }
    const validProject = {
      id: 'p1',
      title: 'Test Project',
      prompt: 'Test prompt',
      status: 'draft',
      script: [validScene],
      settings: {
        voice: 'nova',
        ttsVoice: 'nova',
        ttsMode: 'browser',
        rate: 1,
        style: 'cinematic',
        aspect: '16:9',
        resolution: '1080p',
        music: 'cinematic',
        musicVolume: 50,
      } as const,
      youtube_title: null,
      youtube_description: null,
      youtube_tags: null,
      thumbnail_url: null,
      is_published: false,
      published_at: null,
      category: null,
      video_blob_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    expect(isProject(validProject)).toBe(true)
  })

  it('isProject rejects project with empty title', () => {
    const validScene = {
      id: 's1',
      narration: 'Test',
      image_prompt: 'Test',
      duration: 5,
    }
    const invalidProject = {
      ...{ id: 'p1', title: '', prompt: 'Test prompt', status: 'draft', script: [{ id: 's1', narration: 'Test', image_prompt: 'Test', duration: 5 }] },
      title: '',
    }
    expect(isProject(invalidProject)).toBe(false)
  })

  // isProjectSettings coverage tests
  it('isProjectSettings validates settings with all required fields', () => {
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

  it('isProjectSettings rejects settings with empty voice', () => {
    const invalidSettings = {
      ...{ voice: '', ttsVoice: 'nova', ttsMode: 'browser', rate: 1, style: 'cinematic', aspect: '16:9', resolution: '1080p', music: 'cinematic', musicVolume: 50 },
      voice: '',
    }
    expect(isProjectSettings(invalidSettings)).toBe(false)
  })

  it('isProjectSettings rejects settings with negative music volume', () => {
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

  it('isProjectSettings rejects settings with music volume over 100', () => {
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
