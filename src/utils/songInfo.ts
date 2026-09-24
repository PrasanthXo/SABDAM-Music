import { Track } from '../types';

export interface EnhancedSongInfo {
  movie: string;
  musicDirector: string;
  singers: string;
  actors: string;
}

export function getEnhancedTrackInfo(track: Track): EnhancedSongInfo {
  const movie = track.movie || track.album || 'Single';
  const singers = track.singers || track.artist;
  let musicDirector = track.musicDirector;
  let actors = track.actors;

  const tLower = `${track.title} ${track.artist} ${movie} ${track.genre || ''}`.toLowerCase();

  if (!musicDirector) {
    if (tLower.includes('pathala') || tLower.includes('vikram')) {
      musicDirector = 'Anirudh Ravichander';
    } else if (tLower.includes('hukum') || tLower.includes('jailer') || tLower.includes('rathamaarey') || tLower.includes('kaavaalaa')) {
      musicDirector = 'Anirudh Ravichander';
    } else if (tLower.includes('badass') || tLower.includes('leo')) {
      musicDirector = 'Anirudh Ravichander';
    } else if (tLower.includes('arabic kuthu') || tLower.includes('beast')) {
      musicDirector = 'Anirudh Ravichander';
    } else if (tLower.includes('vaathi coming') || tLower.includes('master') || tLower.includes('kutti story')) {
      musicDirector = 'Anirudh Ravichander';
    } else if (tLower.includes('appadi podu') || tLower.includes('ghilli')) {
      musicDirector = 'Vidyasagar';
    } else if (tLower.includes('kissik') || tLower.includes('pushpa 2')) {
      musicDirector = 'Devi Sri Prasad';
    } else if (tLower.includes('katchi sera') || tLower.includes('kstchi sera') || tLower.includes('katchi')) {
      musicDirector = 'Sai Abhyankkar';
    } else if (tLower.includes('kanja poovu') || tLower.includes('viruman')) {
      musicDirector = 'Yuvan Shankar Raja';
    } else if (tLower.includes('ponni nadhi') || tLower.includes('ponniyin selvan') || tLower.includes('chinna') || tLower.includes('pudhu') || tLower.includes('roja')) {
      musicDirector = 'A. R. Rahman';
    } else if (track.language === 'tamil') {
      musicDirector = 'Anirudh Ravichander / A. R. Rahman';
    } else if (track.language === 'sinhala') {
      musicDirector = 'Sanuka Wickramasinghe / Rohana Weerasinghe';
    } else {
      musicDirector = track.artist;
    }
  }

  if (!actors) {
    if (tLower.includes('pathala') || tLower.includes('vikram')) {
      actors = 'Kamal Haasan, Vijay Sethupathi, Fahadh Faasil';
    } else if (tLower.includes('jailer') || tLower.includes('hukum') || tLower.includes('rathamaarey')) {
      actors = 'Rajinikanth, Mohanlal, Shiva Rajkumar, Tamannaah';
    } else if (tLower.includes('leo') || tLower.includes('badass')) {
      actors = 'Vijay, Trisha, Sanjay Dutt, Arjun Sarja';
    } else if (tLower.includes('beast') || tLower.includes('arabic kuthu')) {
      actors = 'Vijay, Pooja Hegde, Selvaraghavan';
    } else if (tLower.includes('master') || tLower.includes('vaathi coming') || tLower.includes('kutti story')) {
      actors = 'Vijay, Vijay Sethupathi, Malavika Mohanan';
    } else if (tLower.includes('ghilli') || tLower.includes('appadi podu')) {
      actors = 'Vijay, Trisha, Prakash Raj';
    } else if (tLower.includes('pushpa 2') || tLower.includes('kissik')) {
      actors = 'Allu Arjun, Rashmika Mandanna, Sreeleela';
    } else if (tLower.includes('viruman') || tLower.includes('kanja poovu')) {
      actors = 'Karthi, Aditi Shankar, Prakash Raj';
    } else if (tLower.includes('ponniyin selvan') || tLower.includes('ponni nadhi')) {
      actors = 'Vikram, Aishwarya Rai, Jayam Ravi, Karthi, Trisha';
    } else if (tLower.includes('roja') || tLower.includes('chinna')) {
      actors = 'Arvind Swamy, Madhoo';
    } else if (track.language === 'tamil') {
      actors = 'Kollywood Cinema Stars';
    } else if (track.language === 'sinhala') {
      actors = 'Sri Lankan Cinema Stars';
    } else {
      actors = track.artist;
    }
  }

  return {
    movie,
    musicDirector,
    singers,
    actors,
  };
}
