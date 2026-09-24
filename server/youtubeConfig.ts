/**
 * Secure Backend Configuration Helper for YouTube Data API & Audio Streaming Proxy
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. This file executes SOLELY on the Node.js backend server.
 * 2. The YouTube API key is NEVER transmitted or bundled into client-side JS bundles.
 * 3. The Android APK / Kotlin network clients ONLY target backend `/api/youtube/*` endpoints
 *    and NEVER store or bundle raw API keys.
 * 4. Diagnostics and status endpoints return only masked keys or boolean health flags.
 */

export interface YouTubeConfigStatus {
  status: 'ok' | 'degraded' | 'not_configured';
  hasCustomKey: boolean;
  isConfigured: boolean;
  maskedKey: string;
  source: 'environment' | 'default_fallback';
  proxyEndpoints: {
    search: string;
    trending: string;
    stream: string;
  };
}

class YouTubeConfigManager {
  private static instance: YouTubeConfigManager;

  private constructor() {}

  public static getInstance(): YouTubeConfigManager {
    if (!YouTubeConfigManager.instance) {
      YouTubeConfigManager.instance = new YouTubeConfigManager();
    }
    return YouTubeConfigManager.instance;
  }

  /**
   * Lazily retrieve the active YouTube Data API Key.
   * Strips any accidental whitespace, quotes, or trailing formatting.
   */
  public getApiKey(): string {
    const rawKey = process.env.YOUTUBE_API_KEY;
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length < 15) {
      throw new Error('YOUTUBE_API_KEY environment variable is required');
    }
    return rawKey.trim();
  }

  /**
   * Check if a custom user API key was injected via environment secrets.
   */
  public hasCustomApiKey(): boolean {
    const rawKey = process.env.YOUTUBE_API_KEY;
    return !!(rawKey && typeof rawKey === 'string' && rawKey.trim().length > 10);
  }

  /**
   * Check if the API key is validly present and available.
   */
  public isConfigured(): boolean {
    const key = this.getApiKey();
    return typeof key === 'string' && key.length > 15;
  }

  /**
   * Return a masked representation of the API key for safe server logging / diagnostics.
   * e.g. "AIzaSyCYv...eShRLk"
   */
  public getMaskedKey(): string {
    const key = this.getApiKey();
    if (!key || key.length < 12) {
      return '••••••••••••';
    }
    const start = key.slice(0, 8);
    const end = key.slice(-6);
    return `${start}...${end}`;
  }

  /**
   * Safe URL builder for YouTube Data API v3 endpoints.
   * Automatically attaches the server-side API key.
   */
  public buildApiUrl(
    endpoint: 'search' | 'videos' | 'playlistItems',
    params: Record<string, string | number | boolean | undefined>
  ): string {
    const baseUrl = `https://www.googleapis.com/youtube/v3/${endpoint}`;
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }

    // Attach API key safely on the backend
    searchParams.append('key', this.getApiKey());

    return `${baseUrl}?${searchParams.toString()}`;
  }

  /**
   * Check if an error response from Google API indicates quota exhaustion or rate limits.
   */
  public isQuotaError(status: number, data?: any): boolean {
    if (status === 403) {
      if (data?.error?.errors) {
        return data.error.errors.some(
          (e: any) => e.reason === 'quotaExceeded' || e.reason === 'rateLimitExceeded'
        );
      }
      return true;
    }
    if (status === 429) return true;
    return false;
  }

  /**
   * Safe status payload for public health checks and diagnostic monitoring.
   * NEVER returns the raw API key.
   */
  public getPublicStatus(): YouTubeConfigStatus {
    const configured = this.isConfigured();
    const hasCustom = this.hasCustomApiKey();

    return {
      status: configured ? 'ok' : 'degraded',
      hasCustomKey: hasCustom,
      isConfigured: configured,
      maskedKey: this.getMaskedKey(),
      source: hasCustom ? 'environment' : 'default_fallback',
      proxyEndpoints: {
        search: '/api/youtube/search',
        trending: '/api/youtube/trending',
        stream: '/api/youtube/stream',
      },
    };
  }
}

export const youtubeConfig = YouTubeConfigManager.getInstance();
