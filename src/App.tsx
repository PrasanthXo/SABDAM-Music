import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SlideDrawer } from './components/SlideDrawer';
import { LoginModal } from './components/LoginModal';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { LibraryView } from './components/LibraryView';
import { MySongsView } from './components/MySongsView';
import { PlaylistsView } from './components/PlaylistsView';
import { FavoritesView } from './components/FavoritesView';
import { RecentlyPlayedView } from './components/RecentlyPlayedView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { MiniPlayer } from './components/MiniPlayer';
import { BottomNav } from './components/BottomNav';
import { FullPlayerModal } from './components/FullPlayerModal';
import { ArtistDetailModal } from './components/ArtistDetailModal';
import { AndroidProjectModal } from './components/AndroidProjectModal';
import { PublicPrivacyPage } from './components/PublicPrivacyPage';
import { PublicAccountDeletionPage } from './components/PublicAccountDeletionPage';
import { getTrackById } from './data/musicCatalog';
import { Language, NavTab, Artist } from './types';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('all');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { togglePlayPause, seekTo, currentTime, playTrack, isFullPlayerOpen, closeFullPlayer } = useMusic();


  // Parse deep-link query parameters when the player is accessed via link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    const tabParam = params.get('tab') as NavTab | null;
    const langParam = params.get('lang') as Language | null;

    if (
      tabParam &&
      [
        'home',
        'search',
        'library',
        'my-songs',
        'playlists',
        'favorites',
        'recently-played',
        'profile',
        'settings',
        'privacy',
        'delete-account',
      ].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    } else {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.includes('/privacy')) {
        setActiveTab('privacy');
      } else if (pathname.includes('/delete-account')) {
        setActiveTab('delete-account');
      }
    }
    if (langParam && ['all', 'tamil', 'sinhala', 'english', 'recent', '2026'].includes(langParam)) {
      setSelectedLanguage(langParam);
    }
    if (trackId) {
      const targetTrack = getTrackById(trackId);
      if (targetTrack) {
        playTrack(targetTrack);
      }
    }
  }, []); // Run only on initial mount

  // Keyboard controls for convenient desktop / laptop testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        seekTo(currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        seekTo(Math.max(0, currentTime - 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seekTo, currentTime]);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#121212] text-white">
      {/* Desktop Left Sidebar (Spotify style) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212] relative">
        {/* Sticky Header with Hamburger Menu and Time-Based Greeting */}
        <Header
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenProfile={() => setActiveTab('profile')}
          onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
          onSelectArtist={setSelectedArtist}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Scrollable View Area */}
        <div id="main-scroll-container" className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-32 md:pb-24">
          {activeTab === 'home' && (
            <HomeView
              selectedLanguage={selectedLanguage}
              onSelectArtist={setSelectedArtist}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              onSelectArtist={setSelectedArtist}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}

          {activeTab === 'library' && <LibraryView />}

          {activeTab === 'my-songs' && <MySongsView />}

          {activeTab === 'playlists' && <PlaylistsView />}

          {activeTab === 'favorites' && <FavoritesView />}

          {activeTab === 'recently-played' && <RecentlyPlayedView />}

          {activeTab === 'profile' && <ProfileView onNavigate={setActiveTab} />}

          {activeTab === 'settings' && (
            <SettingsView
              initialSection={settingsSection}
              onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'privacy' && (
            <PublicPrivacyPage onBack={() => setActiveTab('settings')} />
          )}

          {activeTab === 'delete-account' && (
            <PublicAccountDeletionPage onBack={() => setActiveTab('settings')} />
          )}
        </div>

        {/* Floating / Fixed Mini-Player */}
        {!isFullPlayerOpen && <MiniPlayer />}
        
        {/* Mobile Bottom Navigation Bar */}
        <BottomNav 
          activeTab={activeTab} 
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (isFullPlayerOpen) {
              closeFullPlayer();
            }
          }} 
        />
      </main>

      {/* Slide Navigation Drawer */}
      <SlideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsDrawerOpen(false);
        }}
        onSelectSettingsSection={(sec) => {
          setSettingsSection(sec);
          setIsDrawerOpen(false);
        }}
      />

      {/* Modals */}
      <LoginModal />
      <FullPlayerModal />
      <ArtistDetailModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />
      <AndroidProjectModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MusicProvider>
        <MainApp />
      </MusicProvider>
    </AuthProvider>
  );
}
