import { useEffect, useState } from 'react';

type ErrorBoundaryProps = {
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined, errorInfo: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    // State güncellemek için yeniden render et
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    // Optional: props'tan callback çağrısı
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI göster
      const { fallback, onError } = this.props;
      return (
        <div className="error-boundary" style={
          padding: '20px';
          background: '#fef3c7';
          border: '1px solid #f5dce4';
          borderRadius: '8px';
          margin: '16px 0';
        }>
          {fallback || (
            <div>
              <h3 className="text-red-600 mb-2">Bir hata oluştu</h3>
              <p className="text-sm text-gray-600">
                {this.state.error?.message || 'Bilinmeyen hata'}
              </p>
              <button
                onClick={() => {
                  // Reset error state (for development)
                  // production'da bu genellikle gerekmez
                  window.location.reload();
                }}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
