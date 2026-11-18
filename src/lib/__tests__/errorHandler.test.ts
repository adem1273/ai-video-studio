import { errorHandler, formatErrorMessage, extractErrorCode } from './errorHandler';

describe('Error Handler', () => {
  describe('createError', () => {
    it('should create error with default severity', () => {
      const err = errorHandler.createError('TEST_ERROR', 'Test message');
      expect(err.code).toBe('TEST_ERROR');
      expect(err.message).toBe('Test message');
      expect(err.severity).toBe('error');
    });

    it('should create error with custom severity', () => {
      const err = errorHandler.createError('CUSTOM', 'Custom message', 'critical');
      expect(err.severity).toBe('critical');
    });
  });

  describe('validateScene', () => {
    it('should validate valid scene', () => {
      const validScene = {
        id: 'test-1',
        narration: 'Test narration',
        image_prompt: 'Test image',
        duration: 5,
      };
      const error = errorHandler.validateScene(validScene);
      expect(error).toBeNull();
    });

    it('should return error for missing ID', () => {
      const invalidScene = {
        narration: 'Test',
        image_prompt: 'Test',
        duration: 5,
      };
      const error = errorHandler.validateScene(invalidScene);
      expect(error).toBe('Sahne ID gerekli');
    });

    it('should return error for invalid duration', () => {
      const invalidScene = {
        id: 'test-1',
        narration: 'Test',
        image_prompt: 'Test',
        duration: -1,
      };
      const error = errorHandler.validateScene(invalidScene);
      expect(error).toBe('Geçerli sahne süresi gerekli');
    });
  });

  describe('validateProject', () => {
    it('should validate valid project', () => {
      const validProject = {
        id: 'proj-1',
        title: 'Test Project',
        prompt: 'Test prompt',
        script: [{ id: 's1', narration: 'Test', image_prompt: 'Test', duration: 5 }],
        settings: {} as any,
        youtube_title: null,
        youtube_description: null,
        youtube_tags: null,
        thumbnail_url: null,
        thumbnail_style: null,
        is_published: false,
        published_at: null,
      };
      const error = errorHandler.validateProject(validProject);
      expect(error).toBeNull();
    });
  });

  describe('getUserMessage', () => {
    it('should return message for RENDER_NO_SCENES', () => {
      const msg = errorHandler.getUserMessage('RENDER_NO_SCENES');
      expect(msg).toBe('Lütfen en az bir sahne ekleyin.');
    });

    it('should return UNKNOWN_ERROR for unknown code', () => {
      const msg = errorHandler.getUserMessage('UNKNOWN_CODE');
      expect(msg).toBe('Bilinmeyen hata oluştu. Lütfen tekrar deneyin.');
    });
  });

  describe('formatErrorMessage', () => {
    it('should format Error object', () => {
      const err = new Error('test error');
      expect(formatErrorMessage(err)).toBe('test error');
    });

    it('should format string', () => {
      expect(formatErrorMessage('direct string')).toBe('direct string');
    });
  });

  describe('extractErrorCode', () => {
    it('should extract code from error message', () => {
      const err = new Error('[RENDER_NO_SCENES] test');
      expect(extractErrorCode(err)).toBe('RENDER_NO_SCENES');
    });

    it('should return UNKNOWN_ERROR when no code found', () => {
      const err = new Error('just a message');
      expect(extractErrorCode(err)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('singleton instance', () => {
    it('should return same instance', () => {
      const instance1 = errorHandler;
      const instance2 = errorHandler;
      expect(instance1).toBe(instance2);
    });
  });
});
