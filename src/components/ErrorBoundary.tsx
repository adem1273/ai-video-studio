import { Component, ReactNode, useState, useEffect } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: Error) {
    // Log error to console or error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo)
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Hata</p>
            <p className="text-xs mt-1">{this.state.error.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
