import { ALL_TRACKS } from './src/data/musicCatalog';
import { getRecentHitsTracks } from './src/utils/recentHits';

const recentTracks = getRecentHitsTracks(ALL_TRACKS, 'all');
console.log(`Found ${recentTracks.length} recent tracks:`);
recentTracks.forEach(t => console.log(`${t.title} - ${t.releaseDate}`));
