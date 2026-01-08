import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary component to catch rendering errors in the component tree.
 * Fixed inheritance issues and removed problematic manual props overrides that caused TS errors.
 * Theme adjusted to: White background, Black, Red, and Gray contents.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white text-black p-8 text-center">
            <div className="max-w-md">
                <i className="fas fa-bomb text-5xl text-red-700 mb-6"></i>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-black mb-2">¡Ups! Algo ha ido muy mal.</h1>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6">
                    La aplicación ha encontrado un error crítico y no puede continuar. Esto suele ser un problema temporal.
                </p>
                
                {this.state.error && (
                    <details className="mb-6 text-left bg-gray-50 border border-gray-100 p-3 rounded-lg text-xs">
                        <summary className="cursor-pointer font-bold uppercase tracking-tight text-gray-400">Detalles técnicos del error</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-gray-600">
                            <code>{this.state.error.toString()}</code>
                        </pre>
                    </details>
                )}
                
                <button
                    type="button"
                    onClick={this.handleReload}
                    className="px-8 py-3 bg-red-700 text-white font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-lg shadow-red-100 text-sm"
                >
                    <i className="fas fa-sync-alt mr-2"></i>
                    Recargar Sistema
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;