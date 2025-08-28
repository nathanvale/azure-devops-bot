import type { Logger } from '@orchestr8/logger'
import type { ResiliencePolicy } from '@orchestr8/resilience'

import { ProductionResilienceAdapter } from '@orchestr8/resilience'

import type { IAzureDevOpsClient } from '../packages/azure-devops-client/src/interfaces/client.js'
import type { UserProfile } from '../packages/azure-devops-client/src/types/user-profile.js'

import { ErrorClassifier } from '../utils/error-classification.js'
import { LoggerFactory } from '../utils/logger.js'

/**
 * Authentication error for specific auth failures
 */
export class AuthenticationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Result of authentication validation
 */
export interface AuthValidationResult {
  success: boolean
  error?: AuthenticationError
  profile?: UserProfile
}

/**
 * Authentication validation service using @orchestr8/resilience and @orchestr8/logger
 * Provides blocking authentication validation to prevent cascade failures
 */
export class AuthValidationService {
  private logger?: Logger
  private resilienceAdapter!: ProductionResilienceAdapter

  constructor(private client: IAzureDevOpsClient) {
    this.initializeServices()
  }

  /**
   * Initialize logger and resilience adapter
   */
  private initializeServices(): void {
    // Use centralized logger factory that respects quiet mode
    this.logger = LoggerFactory.createForComponent('authentication')

    // Initialize resilience adapter with telemetry
    this.resilienceAdapter = new ProductionResilienceAdapter({
      telemetry: this.createResilienceTelemetry() as any,
    })
  }

  /**
   * Validates PAT token using @orchestr8/resilience for proper error handling
   * This is a blocking operation that confirms authentication works
   *
   * Uses the lightweight /_apis/profile/profiles/me endpoint which:
   * - Requires minimal permissions
   * - Returns user context for logging
   * - Fast response time for pre-flight validation
   */
  async validateAuthentication(): Promise<AuthValidationResult> {
    const start = performance.now()

    // Ensure services are initialized
    if (!this.logger || !this.resilienceAdapter) {
      await this.initializeServices()
    }

    this.logger?.info('Starting authentication validation')

    try {
      const profile = await this.resilienceAdapter.applyPolicy(
        () => this.client.getCurrentUserProfile(),
        this.getAuthValidationPolicy(),
      )

      this.logger?.info('Authentication successful', {
        userId: profile.id,
        userEmail: profile.emailAddress,
        userDisplayName: profile.displayName,
        domain: profile.domain,
        duration: performance.now() - start,
      })

      return {
        success: true,
        profile,
      }
    } catch (error) {
      // Debug the error structure
      const errorObj = error as Record<string, unknown>
      const responseObj = errorObj.response as
        | Record<string, unknown>
        | undefined
      const causeObj = errorObj.cause as Record<string, unknown> | undefined

      console.log('AUTH DEBUG - Error structure:', {
        error: error,
        name: errorObj.name,
        message: errorObj.message,
        status: errorObj.status,
        statusCode: errorObj.statusCode,
        response: errorObj.response,
        responseStatus: responseObj?.status,
        cause: errorObj.cause,
        causesStatus: causeObj?.status,
      })

      const classified = ErrorClassifier.classify(error)

      console.log('AUTH DEBUG - Classified result:', classified)

      this.logger?.error('Authentication failed', {
        errorType: classified.type,
        errorCode: classified.code,
        retryable: classified.retryable,
        httpStatus: (error as Record<string, unknown>).status,
        duration: performance.now() - start,
        preventedCascadeFailure: true,
      })

      // For authentication validation, treat server errors as authentication failures
      // This ensures we fail fast rather than retry server issues during auth validation
      const authErrorCode =
        classified.code === 'SERVER_ERROR' ? 'AUTH_FAILED' : classified.code
      const authErrorMessage =
        classified.code === 'SERVER_ERROR'
          ? `Authentication failed: ${classified.message}. Check network connectivity and PAT token validity.`
          : classified.message

      return {
        success: false,
        error: new AuthenticationError(authErrorCode, authErrorMessage),
      }
    }
  }

  /**
   * Creates resilience policy specifically for authentication validation
   * - No retries (fail fast for auth errors)
   * - 3-failure circuit breaker threshold
   * - 30-second timeout for auth validation
   */
  private getAuthValidationPolicy(): ResiliencePolicy {
    return {
      retry: {
        maxAttempts: 1, // No retries for authentication validation
        initialDelay: 0,
        maxDelay: 0,
        backoffStrategy: 'fixed',
        jitterStrategy: 'none',
        // No retries for authentication failures
      },
      circuitBreaker: {
        key: 'azure-devops-auth', // Dedicated circuit for auth operations
        failureThreshold: 3, // Trip after 3 failures as per spec
        recoveryTime: 300000, // 5 minutes recovery time
        sampleSize: 10, // Minimum sample size
        halfOpenPolicy: 'single-probe',
      },
      timeout: 30000, // 30 second timeout
    }
  }

  /**
   * Classifies authentication errors with specific error codes and user-friendly messages
   */
  private classifyAuthError(error: unknown): AuthenticationError {
    // Try multiple ways to access the status code - including statusCode from AzureDevOpsError
    const errorObj = error as Record<string, unknown>
    const responseObj = errorObj.response as Record<string, unknown> | undefined
    const causeObj = errorObj.cause as Record<string, unknown> | undefined

    const status =
      errorObj.status ||
      errorObj.statusCode ||
      responseObj?.status ||
      causeObj?.status

    if (status === 401) {
      return new AuthenticationError(
        'INVALID_TOKEN',
        'PAT token is invalid or expired. Please verify your AZURE_DEVOPS_PAT environment variable contains a valid Personal Access Token.',
      )
    }

    if (status === 403) {
      return new AuthenticationError(
        'INSUFFICIENT_PERMISSIONS',
        'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" permission in Azure DevOps.',
      )
    }

    // Check error message for status codes that might be embedded by resilience adapter
    const errorMessage = (error as Error).message || String(error)

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return new AuthenticationError(
        'INVALID_TOKEN',
        'PAT token is invalid or expired. Please verify your AZURE_DEVOPS_PAT environment variable contains a valid Personal Access Token.',
      )
    }

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return new AuthenticationError(
        'INSUFFICIENT_PERMISSIONS',
        'PAT token lacks required permissions. Please ensure the token has "Work Items (read)" permission in Azure DevOps.',
      )
    }

    return new AuthenticationError(
      'AUTH_FAILED',
      `Authentication failed: ${(error as Error).message}. Check network connectivity and PAT token validity.`,
    )
  }

  /**
   * Creates telemetry callbacks for resilience adapter integration
   */
  private createResilienceTelemetry() {
    return {
      logEvent: (
        type: string,
        context: Record<string, unknown>,
        metadata?: Record<string, unknown>,
      ) => {
        this.logger?.info(`Resilience event: ${type}`, { context, metadata })
      },

      createCircuitBreakerObserver: () => ({
        onStateChange: (
          key: string,
          state: 'closed' | 'open' | 'half-open',
        ) => {
          if (state === 'open') {
            this.logger?.error(
              'Auth circuit breaker opened - authentication failures detected',
              {
                circuitKey: key,
                action: 'blocking_further_attempts',
              },
            )
          } else if (state === 'closed') {
            this.logger?.info(
              'Auth circuit breaker closed - authentication recovered',
              {
                circuitKey: key,
              },
            )
          }
        },
      }),

      startTimer: (operation: string) => {
        const start = performance.now()
        return () => {
          const duration = performance.now() - start
          this.logger?.debug('Auth validation timing', {
            operation,
            durationMs: duration,
          })
          return duration
        }
      },

      getLogger: () => this.logger,
    }
  }
}
