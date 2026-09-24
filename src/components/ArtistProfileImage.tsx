import React, { useState, useEffect } from 'react';
import { Artist } from '../types';
import {
  getCachedArtistImage,
  resolveArtistImage,
  DEFAULT_ARTIST_PLACEHOLDER,
  isValidArtistProfileImage,
} from '../services/artistImageService';

interface ArtistProfileImageProps {
  artist: Artist;
  className?: string;
  alt?: string;
}

export const ArtistProfileImage: React.FC<ArtistProfileImageProps> = ({
  artist,
  className = 'w-full h-full object-cover',
  alt,
}) => {
  const getInitialUrl = (): string => {
    const cached = getCachedArtistImage(artist.id, artist.name);
    if (cached) return cached;
    if (isValidArtistProfileImage(artist.imageUrl)) return artist.imageUrl;
    return DEFAULT_ARTIST_PLACEHOLDER;
  };

  const [imgSrc, setImgSrc] = useState<string>(getInitialUrl);

  useEffect(() => {
    let isMounted = true;

    // Check cache or valid catalog image first
    const cached = getCachedArtistImage(artist.id, artist.name);
    if (cached) {
      setImgSrc(cached);
      return;
    }

    if (isValidArtistProfileImage(artist.imageUrl)) {
      setImgSrc(artist.imageUrl);
      return;
    }

    // Resolve asynchronously via TheAudioDB -> Wikidata/Wikimedia -> Default Placeholder
    resolveArtistImage(artist).then((resolved) => {
      if (isMounted && resolved) {
        setImgSrc(resolved);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [artist.id, artist.name, artist.imageUrl]);

  const handleError = () => {
    setImgSrc(DEFAULT_ARTIST_PLACEHOLDER);
  };

  return (
    <img
      src={imgSrc}
      alt={alt || artist.name}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
      loading="lazy"
    />
  );
};
