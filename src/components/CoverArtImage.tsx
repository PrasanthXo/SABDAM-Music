import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { resolveTrackCoverArt, getOrGenerateTrackCover } from '../services/metadataService';
import { handleImageError } from '../utils/imageUtils';

interface CoverArtImageProps {
  track?: Track | null;
  coverUrl?: string;
  title?: string;
  artist?: string;
  className?: string;
  alt?: string;
}

/**
 * CoverArtImage component
 * Primary artwork source: iTunes Search API
 * Secondary fallback: MusicBrainz + Cover Art Archive
 * Final fallback: Sabdham Gradient Silhouette Placeholder
 * NOTE: YouTube thumbnails are strictly filtered out and never used as cover art.
 */
export const CoverArtImage: React.FC<CoverArtImageProps> = ({
  track,
  coverUrl: propCoverUrl,
  title: propTitle,
  artist: propArtist,
  className = 'w-full h-full object-cover',
  alt,
}) => {
  const trackTitle = track?.title || propTitle || '';
  const trackArtist = track?.artist || propArtist || '';
  const initialCover = propCoverUrl || track?.coverArtUrl || track?.coverUrl;

  const ytSourceId = track?.youtubeVideoId || (track?.audio_source_id && !track.audio_source_id.startsWith('catalog-') ? track.audio_source_id : null);

  const [currentCoverUrl, setCurrentCoverUrl] = useState<string>(() => {
    return getOrGenerateTrackCover(initialCover, trackTitle, trackArtist, ytSourceId);
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // Check if current cover is missing or placeholder
    const needsItunesLookup =
      !initialCover ||
      initialCover.includes('data:image/svg+xml') ||
      initialCover === 'DARK_GREY_VINYL_PLACEHOLDER';

    const syncCover = getOrGenerateTrackCover(initialCover, trackTitle, trackArtist, ytSourceId);
    setCurrentCoverUrl(syncCover);

    if (needsItunesLookup && trackTitle) {
      setIsLoading(true);
      resolveTrackCoverArt(trackTitle, trackArtist)
        .then((resolvedUrl) => {
          if (isMounted && resolvedUrl) {
            setCurrentCoverUrl(resolvedUrl);
          }
        })
        .catch(() => {
          // Keep sync placeholder cover
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [track?.id, trackTitle, trackArtist, initialCover, ytSourceId]);

  return (
    <div className={`relative overflow-hidden bg-neutral-900 shrink-0 ${className}`}>
      <img
        src={currentCoverUrl}
        alt={alt || trackTitle || 'Album Cover'}
        referrerPolicy="no-referrer"
        onError={(e) => handleImageError(e, undefined, undefined, trackTitle, trackArtist)}
        className="w-full h-full object-cover transition-opacity duration-300"
        loading="lazy"
      />
      {isLoading && !currentCoverUrl.includes('mzstatic.com') && (
        <div className="absolute inset-0 bg-neutral-800/40 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};
