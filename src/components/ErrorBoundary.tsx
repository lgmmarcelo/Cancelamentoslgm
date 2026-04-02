import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'Erro desconhecido';
      let isFirestoreError = false;
      let firestoreDetails = null;

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed && parsed.operationType && parsed.error) {
          isFirestoreError = true;
          firestoreDetails = parsed;
          errorMessage = parsed.error;
        }
      } catch (e) {
        // Not a JSON string, ignore
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-gray-600 mb-4 text-sm">
              Encontramos um erro inesperado. Nossa equipe já foi notificada.
            </p>
            
            <div className="bg-red-50 p-4 rounded-lg overflow-auto max-h-48 text-xs font-mono text-red-800 mb-6">
              {isFirestoreError && firestoreDetails?.error.includes("Missing or insufficient permissions") ? (
                <span>Você não tem permissão para acessar ou modificar este recurso.</span>
              ) : (
                errorMessage
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
