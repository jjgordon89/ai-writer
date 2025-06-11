import { useCallback, useEffect, useRef } from 'react';
import { AsyncErrorHandler, ErrorSanitizer } from '../utils/errorSanitization';

// Define interface to match the one in errorSanitization.ts
interface ErrorContext {
  component?: string | undefined;
  action?: string | undefined;
  userId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

interface UseAsyncErrorHandlerOptions {
  component?: string;
  onError?: (error: ReturnType<typeof ErrorSanitizer.sanitizeForUser>) => void;
  showToast?: boolean;
}

export function useAsyncErrorHandler(options: UseAsyncErrorHandlerOptions = {}) {
  const { component, onError, showToast = true } = options;
  const errorHandlerRef = useRef<AsyncErrorHandler>();

  useEffect(() => {
    errorHandlerRef.current = AsyncErrorHandler.getInstance();
  }, []);

  const reportError = useCallback((error: unknown, context?: Partial<ErrorContext>) => {
    const fullContext: ErrorContext = {
      ...(component && { component }),
      ...context
    };

    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, fullContext);
    
    // Call custom error handler if provided
    if (onError) {
      try {
        onError(sanitizedError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Show toast notification if enabled
    if (showToast) {
      // You could integrate with a toast library here
      console.error(`Error in ${component || 'component'}:`, sanitizedError.message);
    }

    // Report to global error handler
    errorHandlerRef.current?.reportError(error, fullContext);
  }, [component, onError, showToast]);

  const wrapAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> => {
    return asyncFn().catch(error => {
      reportError(error, context);
      // Don't re-throw - let the caller handle the error through reportError callback
      throw error;
    });
  }, [reportError]);

  const safeAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    fallback?: T,
    context?: Partial<ErrorContext>
  ): Promise<T | undefined> => {
    return asyncFn().catch(error => {
      reportError(error, context);
      return fallback;
    });
  }, [reportError]);

  const handleAsync = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T | null> => {
    return asyncFn().catch(error => {
      reportError(error, context);
      return null; // Don't re-throw, return null to indicate error
    });
  }, [reportError]);

  return {
    reportError,
    wrapAsync,
    safeAsync,
    handleAsync
  };
}