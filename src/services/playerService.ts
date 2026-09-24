// src/services/playerService.ts

export class PlayerService {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  
  public activeAudio: HTMLAudioElement;
  public standbyAudio: HTMLAudioElement;

  public get preloadAudio(): HTMLAudioElement {
    return this.standbyAudio;
  }
  public set preloadAudio(el: HTMLAudioElement) {
    this.standbyAudio = el;
  }

  private nextPrepared: boolean = false;
  private getNextTrackCallback: (() => { title: string; artist: string; audioUrl?: string } | null) = () => null;
  private onNextTrackCallback: (() => void) | null = null;
  private onUpdateMediaSessionCallback: (() => void) | null = null;
  private existingNormalNextTrackFallback: () => Promise<void> = async () => {};

  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    
    this.audioA.preload = "auto";
    this.audioB.preload = "auto";
    
    this.activeAudio = this.audioA;
    this.standbyAudio = this.audioB;

    this.setupDiagnostics(this.audioA, "activeAudio");
    this.setupDiagnostics(this.standbyAudio, "standbyAudio");

    // Timeupdate for progress tracking
    this.activeAudio.addEventListener("timeupdate", () => {
      if (!Number.isFinite(this.activeAudio.duration)) return;
      const progress = this.activeAudio.currentTime / this.activeAudio.duration;
      if (progress >= 0.20 && !this.nextPrepared) {
        this.nextPrepared = true;
        this.prepareNextSong();
      }
    });

    // Attach ended handler
    this.audioA.addEventListener("ended", () => this.switchToPreparedSong());
    this.audioB.addEventListener("ended", () => this.switchToPreparedSong());
  }

  private setupDiagnostics(audio: HTMLAudioElement, name: string) {
    audio.addEventListener("canplay", () => console.log(`[SABDHAM] ${name} NEXT SONG READY`));
    audio.addEventListener("canplaythrough", () => console.log(`[SABDHAM] ${name} NEXT SONG BUFFERED`));

    ["ended", "pause", "play", "playing", "waiting", "stalled", "error", "canplay"].forEach(event => {
      audio.addEventListener(event, () => {
        console.log(`[${name}] ${event}`, {
          currentTime: audio.currentTime,
          duration: audio.duration,
          readyState: audio.readyState,
          buffered: audio.buffered.length
        });
      });
    });
  }

  setCallbacks(
    getNext: () => { title: string; artist: string; audioUrl?: string } | null,
    onNext: () => void,
    onUpdateMedia: () => void,
    fallback: () => Promise<void>
  ) {
    this.getNextTrackCallback = getNext;
    this.onNextTrackCallback = onNext;
    this.onUpdateMediaSessionCallback = onUpdateMedia;
    this.existingNormalNextTrackFallback = fallback;
  }

  async prepareNextSong() {
    const nextSong = this.getNextTrackCallback();
    if (!nextSong) return;

    try {
      const queryParams = new URLSearchParams({
        title: nextSong.title,
        artist: nextSong.artist
      });
      
      const response = await fetch(`/api/stream/resolve?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Next-song resolve failed: ${response.status}`);
      const data = await response.json();

      this.standbyAudio.src = data.url;
      this.standbyAudio.preload = "auto";
      this.standbyAudio.load();

      console.log("[SABDHAM] Next song preload started", nextSong.title);
    } catch (error) {
      console.error("[SABDHAM] Failed to prepare next song", error);
      this.nextPrepared = false;
    }
  }

  async switchToPreparedSong() {
    console.log("[SABDHAM] Current track ended");
    try {
      await this.standbyAudio.play();

      const oldActive = this.activeAudio;
      this.activeAudio = this.standbyAudio;
      this.standbyAudio = oldActive;

      // Ensure the NEW active audio has the timeupdate listener
      // (The listeners were already attached to both, so this is okay)
      
      this.standbyAudio.pause();
      this.standbyAudio.removeAttribute("src");
      this.standbyAudio.load();

      this.nextPrepared = false;

      if (this.onNextTrackCallback) this.onNextTrackCallback();
      if (this.onUpdateMediaSessionCallback) this.onUpdateMediaSessionCallback();

      console.log("[SABDHAM] AUTO NEXT SUCCESS");
    } catch (error) {
      console.error("[SABDHAM] AUTO NEXT FAILED", error);
      await this.existingNormalNextTrackFallback();
    }
  }
}

export const playerService = new PlayerService();

