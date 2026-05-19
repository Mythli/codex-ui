import React, { Component, ErrorInfo, ReactNode } from 'react';
import { EmptyState } from '../EmptyState/EmptyState';
import { Button } from '../Button/Button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A standard React Error Boundary that catches rendering crashes in its child component tree.
 * Displays a friendly fallback UI using the Learning UI design system instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught rendering error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <EmptyState
            icon="💥"
            title="Something went wrong"
            description={this.state.error?.message || "An unexpected error occurred while rendering this component."}
          >
            <Button onClick={this.handleReset} variant="secondary">
              Try Again
            </Button>
          </EmptyState>
        </div>
      );
    }

    return this.props.children;
  }
}
