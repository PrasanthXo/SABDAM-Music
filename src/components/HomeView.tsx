import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Sparkles, Heart, Compass } from 'lucide-react';
import { Language, Artist, Track } from '../types';
import { SectionRow } from './SectionRow';
import { PopularArtistsRow } from './PopularArtistsRow';
import { GenresRow } from './GenresRow';
import { CatalogView } from './CatalogView';
import {
  POPULAR_TAMIL_TRACKS,
  POPULAR_SINHALA_TRACKS,
  POPULAR_ENGLISH_TRACKS,
  RECENT_NEW_RELEASES_TRACKS,
  ACOUSTIC_MELODIES_TRACKS,
  WORKOUT_ENERGY_TRACKS,
  CHILL_MIDNIGHT_TRACKS,
  ROMANTIC_MELODIES_TRACKS,
  RETRO_CLASSICS_TRACKS,
  ANIRUDH_HITS_TRACKS,
  TAYLOR_SWIFT_TRACKS,
  SINHALA_LEGENDS_TRACKS,
  TAMIL_KUTHU_DANCE_TRACKS,
  AR_RAHMAN_HITS_TRACKS,
  MODERN_ENGLISH_POP_TRACKS,
  MODERN_SINHALA_POP_TRACKS,
  SID_SRIRAM_HITS_TRACKS,
  ED_SHEERAN_HITS_TRACKS,
  THE_WEEKND_HITS_TRACKS,
  TAMIL_80S_90S_TRACKS,
  ENGLISH_90S_00S_TRACKS,
  BILLBOARD_GLOBAL_HITS_TRACKS,
  ARTISTS,
  ALL_TRACKS,
  TRACK_CATALOG_MAP,
  getTrackById,
  deduplicateTracks,
  GENRES,
  GenreItem,
} from '../data/musicCatalog';
import { useMusic } from '../context/MusicContext';
import { CoverArtImage } from './CoverArtImage';
import { SongCard } from './SongCard';
import { getRecentHitsTracks, isWithin90Days } from '../utils/recentHits';
import { getCurrentHourIndex, getHourlyRotatedCatalog } from '../utils/hourlyRotation';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface HomeViewProps {
  selectedLanguage: Language;
  onSelectArtist: (artist: Artist) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ selectedLanguage, onSelectArtist }) => {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, likedTrackIds, customSongs } = useMusic();
  const [currentHour, setCurrentHour] = useState<number>(getCurrentHourIndex);
  const [catalogView, setCatalogView] = useState<{ title: string; subtitle?: string; tracks: Track[] } | null>(null);
  const [trendingHits, setTrendingHits] = useState<Track[]>([]);

  // Automatic hourly rotation boundary checker
  useEffect(() => {
    const checkHour = () => {
      const freshHour = getCurrentHourIndex();
      if (freshHour !== currentHour) {
        setCurrentHour(freshHour);
      }
    };

    const interval = setInterval(checkHour, 30000); // Check every 30 seconds
    const handleFocus = () => checkHour();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentHour]);

  // Fetch trending hits from Firestore safely
  useEffect(() => {
    let isMounted = true;
    async function fetchTrendingHits() {
      try {
        const q = query(collection(db, 'trending_hits'), orderBy('updatedAt', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        const hits = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Track[];
        
        // Filter hits by 90-day rule
        const filteredHits = hits.filter(hit => {
          return hit.releaseDate && isWithin90Days(hit.releaseDate);
        });
        if (isMounted) {
          setTrendingHits(filteredHits);
        }
      } catch (err) {
        console.warn('Could not load trending hits from Firestore:', err);
      }
    }
    fetchTrendingHits();
    return () => {
      isMounted = false;
    };
  }, []);

  // Liked tracks derived from catalog + customSongs + MusicContext state
  const likedTracks = Array.from(likedTrackIds as Set<string>)
    .map((id: string) => {
      const catalogTrack = getTrackById(id, customSongs);
      if (catalogTrack) return catalogTrack;
      return customSongs.find((s) => s.id === id) || null;
    })
    .filter((t): t is Track => t != null);

  const [ytTamilTracks, setYtTamilTracks] = useState<Track[]>([]);
  const [ytSinhalaTracks, setYtSinhalaTracks] = useState<Track[]>([]);
  const [ytEnglishTracks, setYtEnglishTracks] = useState<Track[]>([]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const tamilRes = await fetch('/api/youtube/playlist?id=PLWnQnS5Gf25x7mZ9lV7_l3R0P6bCkqe8V&maxResults=50');
        if (tamilRes.ok) {
          const data = await tamilRes.json();
          if (data.tracks?.length) {
            setYtTamilTracks(data.tracks.map((t: Track) => ({ ...t, language: 'tamil' })));
          }
        }

        const sinhalaRes = await fetch('/api/youtube/playlist?id=PL8Yn_w3_Opx845Xm0j-GkRkP9mQ13oW6z&maxResults=50');
        if (sinhalaRes.ok) {
          const data = await sinhalaRes.json();
          if (data.tracks?.length) {
            setYtSinhalaTracks(data.tracks.map((t: Track) => ({ ...t, language: 'sinhala' })));
          }
        }

        const englishRes = await fetch('/api/youtube/playlist?id=PL4fGSI1puc06EQO4aEokWd59h7Xm9w6yK&maxResults=50');
        if (englishRes.ok) {
          const data = await englishRes.json();
          if (data.tracks?.length) {
            setYtEnglishTracks(data.tracks.map((t: Track) => ({ ...t, language: 'english' })));
          }
        }
      } catch (err) {
        console.error('Failed to fetch YouTube playlists:', err);
      }
    };
    fetchPlaylists();
  }, []);

  // Background auto-updated catalog slices using deterministic Hourly Rotation Engine
  const recentHitsPool = useMemo(() => getRecentHitsTracks(ALL_TRACKS, selectedLanguage), [selectedLanguage]);
  
  const dynamicRecentTracks = useMemo(
    () => getHourlyRotatedCatalog(recentHitsPool, 'recent_hits', currentHour, 20),
    [recentHitsPool, currentHour]
  );

  const dynamicTamilTracks = useMemo(
    () => getHourlyRotatedCatalog(ytTamilTracks.length > 0 ? ytTamilTracks : POPULAR_TAMIL_TRACKS, 'popular_tamil', currentHour, 20),
    [ytTamilTracks, currentHour]
  );

  const dynamicSinhalaTracks = useMemo(
    () => getHourlyRotatedCatalog(ytSinhalaTracks.length > 0 ? ytSinhalaTracks : POPULAR_SINHALA_TRACKS, 'popular_sinhala', currentHour, 20),
    [ytSinhalaTracks, currentHour]
  );

  const dynamicEnglishTracks = useMemo(
    () => getHourlyRotatedCatalog(ytEnglishTracks.length > 0 ? ytEnglishTracks : POPULAR_ENGLISH_TRACKS, 'popular_english', currentHour, 20),
    [ytEnglishTracks, currentHour]
  );

  const filteredArtists = useMemo(() => {
    return selectedLanguage === 'all' || selectedLanguage === 'recent'
      ? ARTISTS
      : ARTISTS.filter((a) => a.language === selectedLanguage);
  }, [selectedLanguage]);

  const dynamicArtists = useMemo(() => {
    if (!filteredArtists.length) return filteredArtists;
    const offset = currentHour % filteredArtists.length;
    return [...filteredArtists.slice(offset), ...filteredArtists.slice(0, offset)];
  }, [filteredArtists, currentHour]);

  const dynamicAcousticTracks = useMemo(() => getHourlyRotatedCatalog(ACOUSTIC_MELODIES_TRACKS, 'acoustic', currentHour, 18), [currentHour]);
  const dynamicWorkoutTracks = useMemo(() => getHourlyRotatedCatalog(WORKOUT_ENERGY_TRACKS, 'workout', currentHour, 18), [currentHour]);
  const dynamicChillTracks = useMemo(() => getHourlyRotatedCatalog(CHILL_MIDNIGHT_TRACKS, 'chill', currentHour, 18), [currentHour]);
  const dynamicRomanticTracks = useMemo(() => getHourlyRotatedCatalog(ROMANTIC_MELODIES_TRACKS, 'romantic', currentHour, 18), [currentHour]);
  const dynamicRetroTracks = useMemo(() => getHourlyRotatedCatalog(RETRO_CLASSICS_TRACKS, 'retro', currentHour, 18), [currentHour]);
  const dynamicAnirudhTracks = useMemo(() => getHourlyRotatedCatalog(ANIRUDH_HITS_TRACKS, 'anirudh', currentHour, 18), [currentHour]);
  const dynamicTaylorTracks = useMemo(() => getHourlyRotatedCatalog(TAYLOR_SWIFT_TRACKS, 'taylor_swift', currentHour, 18), [currentHour]);
  const dynamicSinhalaLegends = useMemo(() => getHourlyRotatedCatalog(SINHALA_LEGENDS_TRACKS, 'sinhala_legends', currentHour, 18), [currentHour]);

  const dynamicTamilKuthu = useMemo(() => getHourlyRotatedCatalog(TAMIL_KUTHU_DANCE_TRACKS, 'tamil_kuthu', currentHour, 18), [currentHour]);
  const dynamicARRahman = useMemo(() => getHourlyRotatedCatalog(AR_RAHMAN_HITS_TRACKS, 'ar_rahman', currentHour, 18), [currentHour]);
  const dynamicModernEnglish = useMemo(() => getHourlyRotatedCatalog(MODERN_ENGLISH_POP_TRACKS, 'modern_english', currentHour, 18), [currentHour]);
  const dynamicModernSinhala = useMemo(() => getHourlyRotatedCatalog(MODERN_SINHALA_POP_TRACKS, 'modern_sinhala', currentHour, 18), [currentHour]);
  const dynamicSidSriram = useMemo(() => getHourlyRotatedCatalog(SID_SRIRAM_HITS_TRACKS, 'sid_sriram', currentHour, 18), [currentHour]);
  const dynamicEdSheeran = useMemo(() => getHourlyRotatedCatalog(ED_SHEERAN_HITS_TRACKS, 'ed_sheeran', currentHour, 18), [currentHour]);
  const dynamicTheWeeknd = useMemo(() => getHourlyRotatedCatalog(THE_WEEKND_HITS_TRACKS, 'the_weeknd', currentHour, 18), [currentHour]);
  const dynamicTamil90s = useMemo(() => getHourlyRotatedCatalog(TAMIL_80S_90S_TRACKS, 'tamil_80s_90s', currentHour, 18), [currentHour]);
  const dynamicEnglish90s = useMemo(() => getHourlyRotatedCatalog(ENGLISH_90S_00S_TRACKS, 'english_90s_00s', currentHour, 18), [currentHour]);
  const dynamicBillboard = useMemo(() => getHourlyRotatedCatalog(BILLBOARD_GLOBAL_HITS_TRACKS, 'billboard', currentHour, 18), [currentHour]);

  // Handle genre click
  const handleSelectGenre = (genre: GenreItem) => {
    let genreTracks = ALL_TRACKS.filter((t) => {
      if (genre.language !== 'all' && t.language !== genre.language) return false;
      const gName = (t.genre || '').toLowerCase();
      const targetG = genre.name.toLowerCase();
      return (
        gName.includes(targetG) ||
        targetG.includes(gName) ||
        (genre.id === 'genre-tamil-pop' && t.language === 'tamil') ||
        (genre.id === 'genre-sinhala-pop' && t.language === 'sinhala') ||
        (genre.id === 'genre-english-pop' && t.language === 'english')
      );
    });

    if (genreTracks.length < 15) {
      if (genre.language !== 'all') {
        genreTracks = ALL_TRACKS.filter((t) => t.language === genre.language);
      } else {
        genreTracks = ALL_TRACKS;
      }
    }

    setCatalogView({
      title: genre.name,
      subtitle: `${genre.description} • Verified catalog collection`,
      tracks: genreTracks,
    });
  };

  // Filter sections according to selected language
  const showTamil = selectedLanguage === 'all' || selectedLanguage === 'tamil';
  const showSinhala = selectedLanguage === 'all' || selectedLanguage === 'sinhala';
  const showEnglish = selectedLanguage === 'all' || selectedLanguage === 'english';
  const isRecentMode = selectedLanguage === 'recent';

  if (catalogView) {
    return (
      <CatalogView
        title={catalogView.title}
        subtitle={catalogView.subtitle}
        tracks={catalogView.tracks}
        onBack={() => setCatalogView(null)}
      />
    );
  }

  return (
    <div className="space-y-1 pb-16 pt-2">
      {/* ==================================================== */}
      {/* LIKED SONGS SECTION (CONDITIONAL)                    */}
      {/* ==================================================== */}
      {likedTracks.length > 0 && (
        <section id="liked-songs-home-section" className="mb-4">
          <div className="px-4 sm:px-8 mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
              Your Library
            </span>
            <span className="text-xs text-neutral-400 font-medium">
              Songs you've liked • Quick access to your favorites
            </span>
          </div>
          <SectionRow
            title="Liked Songs"
            subtitle={`Your personal collection of ${likedTracks.length} favorite track${likedTracks.length === 1 ? '' : 's'}`}
            tracks={likedTracks}
            onSeeAll={() => setCatalogView({
              title: 'Liked Songs',
              subtitle: 'Quick access to your personal favorites',
              tracks: likedTracks
            })}
          />
        </section>
      )}

      {/* ==================================================== */}
      {/* FEATURED: RECENT HITS CATEGORY (PROMINENT)           */}
      {/* ==================================================== */}
      <section className="pt-2" id="recent-hits-section">
        <div className="px-4 sm:px-8 mb-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Recent Hits
          </span>
          <span className="text-xs text-neutral-400 font-medium">
            🔥 Hourly Auto-Rotating Catalog • High Streams & Trends
          </span>
        </div>
        <SectionRow
          title={
            selectedLanguage === 'tamil'
              ? '🔥 Recent Hits • Tamil'
              : selectedLanguage === 'sinhala'
              ? '🔥 Recent Hits • Sinhala'
              : selectedLanguage === 'english'
              ? '🔥 Recent Hits • English'
              : '🔥 Recent Hits'
          }
          subtitle={
            selectedLanguage === 'tamil'
              ? 'Top trending Tamil chart-busters (Spark, Monalisa, Kissik, Katchi Sera) ranked by recent popularity & view counts'
              : selectedLanguage === 'sinhala'
              ? 'Most listened Sinhala hit singles (Liyathambara, Aathma Liyo) ranked by stream count & release recency'
              : selectedLanguage === 'english'
              ? 'Global viral English smash hits (APT., Taste, Die With A Smile, Espresso) trending right now'
              : 'Top trending Tamil, English & Sinhala chart-busters people are listening to right now (sorted by popularity, stream count & recency)'
          }
          tracks={trendingHits.length > 0 ? trendingHits : dynamicRecentTracks}
          onSeeAll={() => setCatalogView({
            title: '🔥 Recent Hits',
            subtitle: 'Songs people are listening to NOW • High Streams & Trends',
            tracks: trendingHits.length > 0 ? trendingHits : recentHitsPool
          })}
        />
      </section>

      {/* 1. Popular Tamil Singles */}
      {showTamil && !isRecentMode && (
        <SectionRow
          title="Popular Tamil Singles"
          subtitle="Top trending hit tracks ranked by streaming popularity & listener activity"
          tracks={dynamicTamilTracks}
          onSeeAll={() => setCatalogView({
            title: 'Popular Tamil Singles',
            subtitle: 'Top trending hit tracks ranked by streaming popularity & listener activity',
            tracks: deduplicateTracks([...ytTamilTracks, ...ALL_TRACKS.filter(t => t.language === 'tamil' && !ytTamilTracks.find(y => y.id === t.id))])
          })}
        />
      )}

      {/* 2. Popular Sinhala Singles */}
      {showSinhala && !isRecentMode && (
        <SectionRow
          title="Popular Sinhala Singles"
          subtitle="Top trending hit tracks ranked by streaming popularity & listener activity"
          tracks={dynamicSinhalaTracks}
          onSeeAll={() => setCatalogView({
            title: 'Popular Sinhala Singles',
            subtitle: 'Top trending hit tracks ranked by streaming popularity & listener activity',
            tracks: deduplicateTracks([...ytSinhalaTracks, ...ALL_TRACKS.filter(t => t.language === 'sinhala' && !ytSinhalaTracks.find(y => y.id === t.id))])
          })}
        />
      )}

      {/* 3. Popular English Singles */}
      {showEnglish && !isRecentMode && (
        <SectionRow
          title="Popular English Singles"
          subtitle="Top trending hit tracks ranked by streaming popularity & listener activity"
          tracks={dynamicEnglishTracks}
          onSeeAll={() => setCatalogView({
            title: 'Popular English Singles',
            subtitle: 'Top trending hit tracks ranked by streaming popularity & listener activity',
            tracks: deduplicateTracks([...ytEnglishTracks, ...ALL_TRACKS.filter(t => t.language === 'english' && !ytEnglishTracks.find(y => y.id === t.id))])
          })}
        />
      )}

      {/* 5. Popular Artists */}
      {!isRecentMode && (
        <PopularArtistsRow 
          artists={dynamicArtists} 
          onSelectArtist={onSelectArtist} 
          onSeeAll={() => setCatalogView({
            title: 'Popular Artists',
            subtitle: 'Top trending artists and legendary hit-makers',
            tracks: ALL_TRACKS.filter(t => dynamicArtists.some(a => t.artist.toLowerCase().includes(a.name.toLowerCase())))
          })}
        />
      )}

      {/* 6. Acoustic & Unplugged Melodies */}
      {!isRecentMode && (
        <SectionRow
          title="Acoustic & Unplugged Melodies"
          subtitle="Soulful unplugged hits, acoustic guitars & gentle vocal ballads"
          tracks={dynamicAcousticTracks}
          onSeeAll={() => setCatalogView({
            title: 'Acoustic & Unplugged Melodies',
            subtitle: 'Soulful unplugged hits, acoustic guitars & gentle vocal ballads',
            tracks: ACOUSTIC_MELODIES_TRACKS
          })}
        />
      )}

      {/* 7. Workout & High Energy Anthems */}
      {!isRecentMode && (
        <SectionRow
          title="Workout & Energy Anthems"
          subtitle="Adrenaline-pumping tracks & high-voltage hit singles"
          tracks={dynamicWorkoutTracks}
          onSeeAll={() => setCatalogView({
            title: 'Workout & Energy Anthems',
            subtitle: 'Adrenaline-pumping tracks & high-voltage hit singles',
            tracks: WORKOUT_ENERGY_TRACKS
          })}
        />
      )}

      {/* 8. Chill & Midnight Vibes */}
      {!isRecentMode && (
        <SectionRow
          title="Chill & Midnight Vibes"
          subtitle="Smooth synthwave, afrobeat beats & late-night relaxation singles"
          tracks={dynamicChillTracks}
          onSeeAll={() => setCatalogView({
            title: 'Chill & Midnight Vibes',
            subtitle: 'Smooth synthwave, afrobeat beats & late-night relaxation singles',
            tracks: CHILL_MIDNIGHT_TRACKS
          })}
        />
      )}

      {/* 9. Romantic & Love Melodies */}
      {!isRecentMode && (
        <SectionRow
          title="Romantic & Love Melodies"
          subtitle="Soulful love songs, heart-touching ballads & romantic hit singles"
          tracks={dynamicRomanticTracks}
          onSeeAll={() => setCatalogView({
            title: 'Romantic & Love Melodies',
            subtitle: 'Soulful love songs, heart-touching ballads & romantic hit singles',
            tracks: ROMANTIC_MELODIES_TRACKS
          })}
        />
      )}

      {/* 10. Best of Anirudh (Tamil Rockstar) */}
      {(selectedLanguage === 'all' || selectedLanguage === 'tamil') && !isRecentMode && (
        <SectionRow
          title="Best of Anirudh Ravichander"
          subtitle="The ultimate collection of high-voltage hits from the Rockstar"
          tracks={dynamicAnirudhTracks}
          onSeeAll={() => setCatalogView({
            title: 'Best of Anirudh Ravichander',
            subtitle: 'The ultimate collection of high-voltage hits from the Rockstar',
            tracks: ANIRUDH_HITS_TRACKS
          })}
        />
      )}

      {/* 11. Taylor Swift: The Eras */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="Taylor Swift: The Eras"
          subtitle="Explore the record-breaking catalog of global icon Taylor Swift"
          tracks={dynamicTaylorTracks}
          onSeeAll={() => setCatalogView({
            title: 'Taylor Swift: The Eras',
            subtitle: 'Explore the record-breaking catalog of global icon Taylor Swift',
            tracks: TAYLOR_SWIFT_TRACKS
          })}
        />
      )}

      {/* 11b. Sinhala Legends (Evergreen Classics) */}
      {(selectedLanguage === 'all' || selectedLanguage === 'sinhala') && !isRecentMode && (
        <SectionRow
          title="Sinhala Legends"
          subtitle="Evergreen classics from Jothipala, Milton, Amaradeva & more"
          tracks={dynamicSinhalaLegends}
          onSeeAll={() => setCatalogView({
            title: 'Sinhala Legends',
            subtitle: 'Evergreen classics from Jothipala, Milton, Amaradeva & more',
            tracks: SINHALA_LEGENDS_TRACKS
          })}
        />
      )}

      {/* 12. Retro & Golden Classics */}
      {!isRecentMode && (
        <SectionRow
          title="Retro & Golden Classics"
          subtitle="Timeless hits and legendary evergreen melodies from the golden era"
          tracks={dynamicRetroTracks}
          onSeeAll={() => setCatalogView({
            title: 'Retro & Golden Classics',
            subtitle: 'Timeless hits and legendary evergreen melodies from the golden era',
            tracks: RETRO_CLASSICS_TRACKS
          })}
        />
      )}

      {/* 13. Tamil Kuthu & Dance Hits */}
      {(selectedLanguage === 'all' || selectedLanguage === 'tamil') && !isRecentMode && (
        <SectionRow
          title="Tamil Kuthu & Dance Hits"
          subtitle="High-energy dance tracks & massive kuthu anthems"
          tracks={dynamicTamilKuthu}
          onSeeAll={() => setCatalogView({
            title: 'Tamil Kuthu & Dance Hits',
            subtitle: 'High-energy dance tracks & massive kuthu anthems',
            tracks: TAMIL_KUTHU_DANCE_TRACKS
          })}
        />
      )}

      {/* 14. A.R. Rahman Hits */}
      {(selectedLanguage === 'all' || selectedLanguage === 'tamil') && !isRecentMode && (
        <SectionRow
          title="A.R. Rahman: The Mozart of Madras"
          subtitle="Timeless masterpieces from the Oscar-winning maestro"
          tracks={dynamicARRahman}
          onSeeAll={() => setCatalogView({
            title: 'A.R. Rahman: The Mozart of Madras',
            subtitle: 'Timeless masterpieces from the Oscar-winning maestro',
            tracks: AR_RAHMAN_HITS_TRACKS
          })}
        />
      )}

      {/* 15. Sid Sriram Soulful Hits */}
      {(selectedLanguage === 'all' || selectedLanguage === 'tamil') && !isRecentMode && (
        <SectionRow
          title="Sid Sriram: Soulful Hits"
          subtitle="Melodious and emotional tracks from the voice of a generation"
          tracks={dynamicSidSriram}
          onSeeAll={() => setCatalogView({
            title: 'Sid Sriram: Soulful Hits',
            subtitle: 'Melodious and emotional tracks from the voice of a generation',
            tracks: SID_SRIRAM_HITS_TRACKS
          })}
        />
      )}

      {/* 16. Modern Sinhala Pop */}
      {(selectedLanguage === 'all' || selectedLanguage === 'sinhala') && !isRecentMode && (
        <SectionRow
          title="Modern Sinhala Pop"
          subtitle="Top trending hits from the modern era of Sri Lankan pop"
          tracks={dynamicModernSinhala}
          onSeeAll={() => setCatalogView({
            title: 'Modern Sinhala Pop',
            subtitle: 'Top trending hits from the modern era of Sri Lankan pop',
            tracks: MODERN_SINHALA_POP_TRACKS
          })}
        />
      )}

      {/* 17. Modern English Pop */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="Modern English Pop"
          subtitle="Current worldwide chart-toppers and trending pop hits"
          tracks={dynamicModernEnglish}
          onSeeAll={() => setCatalogView({
            title: 'Modern English Pop',
            subtitle: 'Current worldwide chart-toppers and trending pop hits',
            tracks: MODERN_ENGLISH_POP_TRACKS
          })}
        />
      )}

      {/* 18. Ed Sheeran Hits */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="Ed Sheeran: The Soloist"
          subtitle="The complete collection of acoustic and pop hits from Ed Sheeran"
          tracks={dynamicEdSheeran}
          onSeeAll={() => setCatalogView({
            title: 'Ed Sheeran: The Soloist',
            subtitle: 'The complete collection of acoustic and pop hits from Ed Sheeran',
            tracks: ED_SHEERAN_HITS_TRACKS
          })}
        />
      )}

      {/* 19. The Weeknd Hits */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="The Weeknd: Starboy Collection"
          subtitle="Synthwave and R&B masterpieces from the global superstar"
          tracks={dynamicTheWeeknd}
          onSeeAll={() => setCatalogView({
            title: 'The Weeknd: Starboy Collection',
            subtitle: 'Synthwave and R&B masterpieces from the global superstar',
            tracks: THE_WEEKND_HITS_TRACKS
          })}
        />
      )}

      {/* 20. 80s & 90s Tamil Evergreens */}
      {(selectedLanguage === 'all' || selectedLanguage === 'tamil') && !isRecentMode && (
        <SectionRow
          title="80s & 90s Tamil Evergreens"
          subtitle="Nostalgic hits from the golden age of Tamil cinema"
          tracks={dynamicTamil90s}
          onSeeAll={() => setCatalogView({
            title: '80s & 90s Tamil Evergreens',
            subtitle: 'Nostalgic hits from the golden age of Tamil cinema',
            tracks: TAMIL_80S_90S_TRACKS
          })}
        />
      )}

      {/* 21. 90s & 2000s English Pop */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="90s & 2000s English Pop Classics"
          subtitle="Legendary pop anthems that defined an era"
          tracks={dynamicEnglish90s}
          onSeeAll={() => setCatalogView({
            title: '90s & 2000s English Pop Classics',
            subtitle: 'Legendary pop anthems that defined an era',
            tracks: ENGLISH_90S_00S_TRACKS
          })}
        />
      )}

      {/* 22. Billboard Global Chartbusters */}
      {(selectedLanguage === 'all' || selectedLanguage === 'english') && !isRecentMode && (
        <SectionRow
          title="Billboard Global Chartbusters"
          subtitle="The most streamed and played tracks worldwide"
          tracks={dynamicBillboard}
          onSeeAll={() => setCatalogView({
            title: 'Billboard Global Chartbusters',
            subtitle: 'The most streamed and played tracks worldwide',
            tracks: BILLBOARD_GLOBAL_HITS_TRACKS
          })}
        />
      )}
    </div>
  );
};

