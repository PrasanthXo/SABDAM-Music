// Session tracker to keep track of previously loaded and played songs across catalogs
const sessionLoadedTrackIds = new Set<string>();

export function markTrackAsLoaded(trackId: string) {
  if (trackId && typeof trackId === 'string') {
    sessionLoadedTrackIds.add(trackId);
  }
}

export function markTracksAsLoaded(trackIds: string[]) {
  if (Array.isArray(trackIds)) {
    trackIds.forEach((id) => {
      if (id && typeof id === 'string') {
        sessionLoadedTrackIds.add(id);
      }
    });
  }
}

export function getSessionLoadedTrackIds(): Set<string> {
  return sessionLoadedTrackIds;
}
