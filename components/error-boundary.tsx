"use client"

import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: error.message }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[v0] Error boundary caught error:", error, errorInfo)
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || error.message,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-[#000033] text-white flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-900/20 border-2 border-red-500 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <div className="bg-black/50 p-4 rounded mb-4 overflow-auto max-h-60">
              <p className="text-sm font-mono text-red-300 mb-2">Error:</p>
              <p className="text-xs font-mono text-white break-all">{this.state.error?.message}</p>
              {this.state.errorInfo && (
                <>
                  <p className="text-sm font-mono text-red-300 mt-4 mb-2">Stack:</p>
                  <pre className="text-xs font-mono text-white whitespace-pre-wrap break-all">
                    {this.state.errorInfo}
                  </pre>
                </>
              )}
            </div>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
                window.location.href = "/"
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white"
            >
              Go to Home
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
