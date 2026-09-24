import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Sabdham Error Boundary] Caught error:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.unregister());
        });
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#121212] text-zinc-100 p-6 select-none">
          <div className="max-w-md w-full bg-[#181818] border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-5">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Playback Interface Restart Needed</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Sabdham encountered a temporary loading hitch. Refreshing will clear obsolete cached assets and restore active streaming.
            </p>
            {this.state.error && (
              <pre className="w-full text-left text-xs bg-black/60 p-3 rounded-lg text-zinc-400 mb-6 font-mono overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="flex items-center space-x-2 bg-[#1db954] hover:bg-[#1ed760] text-black font-semibold text-sm px-6 py-3 rounded-full transition-transform active:scale-95 shadow-lg shadow-[#1db954]/20 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Sabdham Player</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
