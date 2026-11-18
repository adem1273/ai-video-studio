import React from 'react';

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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      const fallbackUI = (
        <div>
          <h3 className='text-red-600 mb-2'>Bir hata oluştu</h3>
          <p className='text-sm text-gray-600'>
            {this.state.error?.message || 'Bilinmeyen hata'}
          </p>
          <button onClick={() => window.location.reload()} className='mt-2 px-4 py-2 bg-blue-500 text-white rounded'>
            Tekrar Dene
          </button>
        </div>
      );
      return (
        <div style={{padding: '20px', background: '#fef3c7', border: '1px solid #f5dce4', borderRadius: '8px', margin: '16px 0' }}>
          {fallback || fallbackUI}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
