import React from 'react';

/**
 * Official Sabdham Music branded default cover image SVG placeholder.
 * Used as the final fallback when no external cover artwork is found.
 */
export const SABDHAM_DEFAULT_ARTWORK = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="sabdhamBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="40%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="500" height="500" fill="url(#sabdhamBg)"/>
  <circle cx="250" cy="225" r="200" fill="url(#glow)"/>

  <!-- Vinyl Grooves -->
  <circle cx="250" cy="225" r="180" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="2"/>
  <circle cx="250" cy="225" r="145" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1.5"/>
  <circle cx="250" cy="225" r="110" fill="none" stroke="#ffffff" stroke-opacity="0.03" stroke-width="1"/>

  <!-- Center Circle / Record Label -->
  <circle cx="250" cy="225" r="75" fill="#090d16" stroke="url(#accentGrad)" stroke-width="3"/>

  <!-- Equalizer / Waveform Bars -->
  <g transform="translate(200, 205)">
    <rect x="0" y="10" width="8" height="30" rx="4" fill="#10b981"/>
    <rect x="15" y="0" width="8" height="50" rx="4" fill="#06b6d4"/>
    <rect x="30" y="15" width="8" height="25" rx="4" fill="#3b82f6"/>
    <rect x="45" y="5" width="8" height="42" rx="4" fill="#10b981"/>
    <rect x="60" y="20" width="8" height="18" rx="4" fill="#06b6d4"/>
    <rect x="75" y="12" width="8" height="32" rx="4" fill="#3b82f6"/>
    <rect x="90" y="22" width="8" height="15" rx="4" fill="#10b981"/>
  </g>

  <!-- Sabdham Branding -->
  <text x="250" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="6">SABDHAM</text>
  <text x="250" y="405" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="14" fill="#06b6d4" text-anchor="middle" letter-spacing="3">MUSIC PLAYER</text>
  <rect x="210" y="425" width="80" height="3" rx="1.5" fill="url(#accentGrad)"/>
</svg>
`)}`;

export const DARK_GREY_VINYL_PLACEHOLDER = SABDHAM_DEFAULT_ARTWORK;
export const DEFAULT_MUSIC_COVER = SABDHAM_DEFAULT_ARTWORK;

const GRADIENT_PALETTES = [
  { name: 'Neon Dusk', stop1: '#8B5CF6', stop2: '#EC4899', accent: '#F472B6' },
  { name: 'Emerald Wave', stop1: '#059669', stop2: '#10B981', accent: '#34D399' },
  { name: 'Electric Ocean', stop1: '#2563EB', stop2: '#06B6D4', accent: '#38BDF8' },
  { name: 'Sunset Flare', stop1: '#D97706', stop2: '#DC2626', accent: '#FBBF24' },
  { name: 'Deep Purple', stop1: '#4C1D95', stop2: '#7C3AED', accent: '#A78BFA' },
  { name: 'Ruby Pulse', stop1: '#991B1B', stop2: '#E11D48', accent: '#FB7185' },
  { name: 'Midnight Synth', stop1: '#0F172A', stop2: '#3B82F6', accent: '#60A5FA' },
  { name: 'Golden Glow', stop1: '#B45309', stop2: '#F59E0B', accent: '#FDE047' },
];

function getHashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Dynamically generates a vibrant gradient SVG placeholder featuring an artist silhouette & vinyl groove accent
 * based on the track title or artist name.
 */
export function generateGradientCoverPlaceholder(title?: string, artist?: string): string {
  const seed = `${title || 'Music'}-${artist || 'Artist'}`;
  const hash = getHashString(seed);
  const palette = GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length];

  const cleanTitle = (title || 'Unknown Track').slice(0, 30);
  const cleanArtist = (artist || 'Sabdham Music').slice(0, 32);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.stop1}"/>
        <stop offset="100%" stop-color="${palette.stop2}"/>
      </linearGradient>
      <radialGradient id="aura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${palette.stop1}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    
    <rect width="400" height="400" fill="url(#bgGrad)"/>
    <circle cx="200" cy="200" r="180" fill="url(#aura)"/>
    
    <circle cx="200" cy="200" r="140" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
    <circle cx="200" cy="200" r="110" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1.5"/>
    
    <!-- Center Record Icon -->
    <circle cx="200" cy="155" r="42" fill="#000000" fill-opacity="0.45" stroke="${palette.accent}" stroke-width="2.5"/>
    <g transform="translate(185, 140) scale(0.75)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 3 14 A 17 17 0 0 1 37 14" stroke="${palette.accent}" stroke-width="2.5"/>
      <rect x="0" y="13" width="6" height="10" rx="3" fill="${palette.accent}"/>
      <rect x="34" y="13" width="6" height="10" rx="3" fill="${palette.accent}"/>
      <circle cx="20" cy="18" r="5" fill="#ffffff" stroke="none"/>
    </g>
    
    <!-- Song Title & Artist -->
    <text x="200" y="240" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${escapeXml(cleanTitle)}</text>
    <text x="200" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="14" fill="${palette.accent}" text-anchor="middle" letter-spacing="0.5">${escapeXml(cleanArtist)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Robust URL validation check for cover art image URLs.
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return false;
  if (clean.includes('i.ytimg.com') || clean.includes('ytimg.com')) return false;

  const isUrlFormat =
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('/') ||
    clean.startsWith('data:image/');

  return isUrlFormat;
}

/**
 * Gets high-quality YouTube thumbnail URL for a video ID.
 */
export function getYouTubeThumbnail(videoId: string | undefined | null): string {
  return DARK_GREY_VINYL_PLACEHOLDER;
}

/**
 * Validates and ensures that a cover URL is valid.
 * Strictly rejects YouTube thumbnails in favor of default gradient cover with song title.
 */
export function ensureValidCoverUrl(
  coverUrl: string | undefined | null,
  sourceId?: string | null,
  title?: string,
  artist?: string
): string {
  if (
    isValidImageUrl(coverUrl) &&
    coverUrl !== DARK_GREY_VINYL_PLACEHOLDER &&
    !coverUrl!.includes('data:image/svg+xml')
  ) {
    return coverUrl!.trim();
  }
  return generateGradientCoverPlaceholder(title, artist);
}

/**
 * Handles image load errors gracefully.
 * Triggered on <img> onError. Rejects YouTube thumbnails in favor of iTunes/MusicBrainz or gradient placeholder.
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackYtId?: string,
  fallbackUrl?: string,
  title?: string,
  artist?: string
) {
  const img = e.currentTarget;

  if (img.dataset.hasFailedFinal) {
    return;
  }

  // Try fallbackUrl if provided and NOT a YouTube thumbnail
  if (
    fallbackUrl &&
    isValidImageUrl(fallbackUrl) &&
    !fallbackUrl.includes('ytimg.com') &&
    !img.dataset.fallbackUrlTried
  ) {
    img.dataset.fallbackUrlTried = 'true';
    img.src = fallbackUrl;
    return;
  }

  // Final fallback to dynamic gradient silhouette placeholder
  img.dataset.hasFailedFinal = 'true';
  img.src = generateGradientCoverPlaceholder(title, artist);
}
