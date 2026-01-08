
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ApiKeyMissingError } from '../types';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  timestamp: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  public state: State = {
    hasError: false,
    timestamp: new Date().toISOString()
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error, 
      timestamp: new Date().toISOString() 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.group("🆘 CRITICAL SYSTEM ERROR");
    console.error("Error Object:", error);
    console.error("Component Stack:", errorInfo.componentStack);
    console.groupEnd();
  }

  private handleReset = () => {
    // Intentar limpiar posibles estados corruptos y recargar
    try {
        window.localStorage.removeItem('selectedAiEngine');
        window.localStorage.removeItem('activeAnalysisSessionId');
    } catch(e) {}
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      const isApiKeyError = this.state.error instanceof ApiKeyMissingError || 
                          (this.state.error?.message.toLowerCase().includes("api key"));

      return (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
            <div className="max-w-4xl w-full border border-gray-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] overflow-hidden flex flex-col bg-white">
                
                {/* Header de la Consola */}
                <div className="bg-red-700 p-8 text-white">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <i className="fas fa-terminal text-2xl"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Diagnostic Console</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">System Halt detected at {this.state.timestamp}</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 sm:p-12 space-y-8">
                    {/* Resumen del Error */}
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black text-black tracking-tighter leading-tight">
                            {isApiKeyError ? "CONEXIÓN CON IA INTERRUMPIDA" : "FALLO CRÍTICO DE APLICACIÓN"}
                        </h2>
                        
                        <div className={`p-6 rounded-2xl border-2 ${isApiKeyError ? 'bg-red-50 border-red-100 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-900'}`}>
                            <p className="font-bold text-lg mb-2">
                                <i className="fas fa-exclamation-triangle mr-2"></i>
                                {this.state.error?.name}: {this.state.error?.message}
                            </p>
                            {isApiKeyError && (
                                <p className="text-sm opacity-80 leading-relaxed font-medium">
                                    Este error ocurre porque el navegador no detecta la clave API necesaria para que Gemini funcione. 
                                    Asegúrate de que la variable de entorno <code className="bg-red-700 text-white px-1.5 py-0.5 rounded">API_KEY</code> esté correctamente configurada en el servidor de despliegue.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Reporte Técnico Detallado */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Technical Report</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Entorno de API</p>
                                <p className={`text-xs font-black uppercase ${process.env.API_KEY ? 'text-green-600' : 'text-red-700'}`}>
                                    {process.env.API_KEY ? "Detectado (Hidden)" : "Missing / Undefined"}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">User Agent</p>
                                <p className="text-xs font-medium text-gray-600 truncate">{navigator.userAgent}</p>
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-2xl p-6 text-gray-400 font-mono text-[10px] overflow-x-auto shadow-inner">
                            <p className="text-red-500 font-bold mb-4 uppercase tracking-widest">// Stack Trace</p>
                            <pre className="whitespace-pre-wrap leading-relaxed">
                                {this.state.error?.stack || "No stack trace available."}
                                {"\n\n"}
                                {this.state.errorInfo?.componentStack || ""}
                            </pre>
                        </div>
                    </div>

                    {/* Acciones de Recuperación */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="flex-1 bg-black hover:bg-red-700 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                        >
                            <i className="fas fa-redo-alt"></i>
                            Reintentar Conexión
                        </button>
                        <a
                            href="https://ai.google.dev/gemini-api/docs/api-key"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 border-2 border-gray-100 hover:border-red-700 text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                        >
                            <i className="fas fa-external-link-alt"></i>
                            Documentación API
                        </a>
                    </div>
                </div>

                <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">InversIA System Failure Recovery &bull; Tligent Protocol v2.5</p>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
