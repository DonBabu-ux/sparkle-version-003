import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="premium-card max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-xl shadow-rose-100 animate-bounce">
              ⚠️
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 mb-2">Cosmic Interference</h1>
              <p className="text-slate-500 font-medium">A solar flare interrupted your connection to the Sparkle network. Let's try recalibrating.</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full py-4 shadow-xl shadow-indigo-100"
            >
              Recalibrate Signal
            </button>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">Error Code: SPK-{Math.random().toString(36).substr(2, 5).toUpperCase()}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
