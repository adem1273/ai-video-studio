import type { AppError } from './types';

/**
 * Centralized error handling and formatting
 */
class ErrorHandler {
  private errorLog: AppError[] = [];
  private maxLogSize = 100;

  /**
   * Create a standardized app error
   */
  createError(
    code: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
    details?: string,
  ): AppError {
    const appError: AppError = {
      code,
      message,
      details,
      timestamp: Date.now(),
      severity,
    };

    this.logError(appError);
    return appError;
  }

  /**
   * Log error to internal buffer
   */
  private logError(error: AppError): void {
    this.errorLog.push(error);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    // Also log to console based on severity
    const consoleMethod = this.getConsoleMethod(error.severity);
    consoleMethod(`[${error.code}] ${error.message}`, error.details || '');
  }

  /**
   * Get appropriate console method for severity level
   */
  private getConsoleMethod(severity: string): typeof console.log {
    switch (severity) {
      case 'critical':
      case 'error':
        return console.error;
      case 'warning':
        return console.warn;
      case 'info':
      default:
        return console.info;
    }
  }

  /**
   * Handle promise rejection safely
   */
  async handleAsync<T>(
    promise: Promise<T>,
    errorCode: string,
    errorMessage: string,
    fallback?: T,
  ): Promise<T> {
    try {
      return await promise;
    } catch (err) {
      this.createError(
        errorCode,
        errorMessage,
        'error',
        err instanceof Error ? err.message : String(err),
      );
      
      if (fallback !== undefined) {
        return fallback;
      }
      throw err;
    }
  }

  /**
   * Wrap a function with error handling
   */
  wrapFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    errorCode: string,
    errorMessage: string,
  ): T {
    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.catch((err) => {
            this.createError(
              errorCode,
              errorMessage,
              'error',
              err instanceof Error ? err.message : String(err),
            );
            throw err;
          });
        }
        return result;
      } catch (err) {
        this.createError(
          errorCode,
          errorMessage,
          'error',
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }
    }) as T;
  }

  /**
   * Get user-facing error message
   */
  getUserMessage(code: string): string {
    const messages: Record<string, string> = {
      // Rendering errors
      'RENDER_NO_SCENES': 'Lütfen en az bir sahne ekleyin.',
      'RENDER_FRAME_FAILED': 'Sahne render edilirken hata oluştu. Lütfen tekrar deneyin.',
      'RENDER_AUDIO_FAILED': 'Ses işlenirken hata oluştu. Video sesiz devam edebilir.',
      'RENDER_CODEC_UNSUPPORTED': 'Seçilen video codec tarayıcınızda desteklenmiyor.',
      
      // Transcoding errors
      'TRANSCODE_FAILED': 'MP4 dönüşümü başarısız oldu. WebM formatında indirebilirsiniz.',
      'TRANSCODE_FFMPEG_LOAD': 'Video kodlama kütüphanesi yüklenemedi.',
      'TRANSCODE_NO_FRAMES': 'Kodlama için frame bulunamadı.',
      
      // TTS errors
      'TTS_FAILED': 'Seslendirme başarısız oldu. Devam edebilir.',
      'TTS_UNSUPPORTED': 'Seçilen dil desteklenmiyor.',
      
      // Subtitle errors
      'SUBTITLE_PARSE_FAILED': 'Altyazı parse edilirken hata oluştu.',
      'SUBTITLE_RENDER_FAILED': 'Altyazı render edilirken hata oluştu.',
      
      // Image errors
      'IMAGE_GENERATION_FAILED': 'Görsel üretilirken hata oluştu. Stok videoya geri dönülüyor.',
      'IMAGE_LOAD_FAILED': 'Görsel yüklenemedi.',
      
      // API errors
      'API_REQUEST_FAILED': 'API isteği başarısız oldu.',
      'API_TIMEOUT': 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
      'API_RATE_LIMITED': 'Çok fazla istek. Lütfen birkaç dakika bekleyin.',
      
      // Storage errors
      'STORAGE_QUOTA_EXCEEDED': 'Depolama alanı dolu. Eski projeleri silin.',
      'STORAGE_READ_FAILED': 'Proje okunurken hata oluştu.',
      'STORAGE_WRITE_FAILED': 'Proje kaydedilirken hata oluştu.',
      
      // Validation errors
      'VALIDATION_EMPTY_TITLE': 'Proje başlığı boş olamaz.',
      'VALIDATION_EMPTY_PROMPT': 'Prompt boş olamaz.',
      'VALIDATION_EMPTY_SCENES': 'En az bir sahne gerekli.',
      'VALIDATION_INVALID_DURATION': 'Geçersiz sahne süresi.',
      
      // Default
      'UNKNOWN_ERROR': 'Bilinmeyen hata oluştu. Lütfen tekrar deneyin.',
    };

    return messages[code] || messages['UNKNOWN_ERROR'];
  }

  /**
   * Get all logged errors
   */
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Export errors as JSON for debugging
   */
  exportErrors(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  /**
   * Check if there are critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errorLog.some((err) => err.severity === 'critical');
  }

  /**
   * Validate scene data
   */
  validateScene(scene: unknown): string | null {
    if (!scene || typeof scene !== 'object') {
      return 'Sahne geçersiz format';
    }

    const s = scene as Record<string, unknown>;

    if (!s.id || typeof s.id !== 'string') {
      return 'Sahne ID gerekli';
    }

    if (!s.narration || typeof s.narration !== 'string') {
      return 'Narration gerekli';
    }

    if (typeof s.duration !== 'number' || s.duration <= 0) {
      return 'Geçerli sahne süresi gerekli';
    }

    if (!s.image_prompt || typeof s.image_prompt !== 'string') {
      return 'Görsel prompt gerekli';
    }

    return null;
  }

  /**
   * Validate project data
   */
  validateProject(project: unknown): string | null {
    if (!project || typeof project !== 'object') {
      return 'Proje geçersiz format';
    }

    const p = project as Record<string, unknown>;

    if (!p.id || typeof p.id !== 'string') {
      return 'Proje ID gerekli';
    }

    if (!p.title || typeof p.title !== 'string') {
      return 'Proje başlığı gerekli';
    }

    if (!Array.isArray(p.script) || p.script.length === 0) {
      return 'En az bir sahne gerekli';
    }

    for (let i = 0; i < p.script.length; i++) {
      const sceneError = this.validateScene(p.script[i]);
      if (sceneError) {
        return `Sahne ${i + 1}: ${sceneError}`;
      }
    }

    return null;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Format error message for display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Bilinmeyen hata oluştu';
}

/**
 * Extract error code from error message
 */
export function extractErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.includes('[')) {
    const match = error.message.match(/\[([A-Z_]+)\]/);
    return match ? match[1] : 'UNKNOWN_ERROR';
  }

  return 'UNKNOWN_ERROR';
}
