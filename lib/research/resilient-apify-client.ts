/**
 * Resilient Apify Client
 * 
 * A wrapper around the Apify API with:
 * - Automatic retries with exponential backoff
 * - Graceful error handling for billing/memory limits
 * - Circuit breaker pattern for repeated failures
 * - Fallback strategies when Apify is unavailable
 */

import { ApifyClient } from 'apify-client';

// Error types we can handle gracefully
export enum ApifyErrorType {
  MEMORY_LIMIT = 'actor-memory-limit-exceeded',
  BILLING_LIMIT = 'billing-limit-exceeded',
  RATE_LIMIT = 'rate-limit-exceeded',
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not-found',
  UNKNOWN = 'unknown',
}

export interface ApifyError {
  type: ApifyErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
  suggestedAction?: string;
}

export interface ActorRunOptions {
  maxRetries?: number;
}

export interface ActorRunResult<T = any> {
  success: boolean;
  data?: T;
  error?: ApifyError;
  attempts: number;
  durationMs: number;
  usedFallback: boolean;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// Actor configurations with memory requirements
const ACTOR_CONFIG: Record<string, { minMemory: number; defaultMemory: number }> = {
  'apify/google-search-scraper': { minMemory: 256, defaultMemory: 512 },
  'apify/rag-web-browser': { minMemory: 512, defaultMemory: 1024 },
  'apify/instagram-scraper': { minMemory: 512, defaultMemory: 1024 },
  'default': { minMemory: 128, defaultMemory: 256 },
};

class ResilientApifyClient {
  private client: ApifyClient | null = null;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const token = process.env.APIFY_API_TOKEN;
    if (token) {
      this.client = new ApifyClient({
        token,
        maxRetries: 2,
        minDelayBetweenRetriesMillis: 1000,
        timeoutSecs: 120,
      });
    }
  }

  isConfigured(): boolean {
    return !!process.env.APIFY_API_TOKEN;
  }

  /**
   * Check if the circuit breaker should prevent requests
   */
  private shouldBlockRequest(): boolean {
    if (!this.circuitBreaker.isOpen) return false;
    
    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
    if (timeSinceLastFailure > this.CIRCUIT_BREAKER_RESET_MS) {
      // Reset circuit breaker after cooldown
      this.circuitBreaker = { failures: 0, lastFailure: 0, isOpen: false };
      return false;
    }
    
    return true;
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(error: ApifyError): void {
    if (error.type === ApifyErrorType.MEMORY_LIMIT || 
        error.type === ApifyErrorType.BILLING_LIMIT) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreaker.isOpen = true;
        console.warn('[Apify] Circuit breaker OPEN - too many failures');
      }
    }
  }

  /**
   * Parse Apify API errors into structured format
   */
  private parseError(error: any): ApifyError {
    const message = error?.message || error?.error?.message || String(error);
    const statusCode = error?.statusCode || error?.status;
    
    // Memory limit exceeded (402)
    if (message.includes('memory-limit-exceeded') || 
        message.includes('exceed the memory limit') ||
        statusCode === 402) {
      return {
        type: ApifyErrorType.MEMORY_LIMIT,
        message: 'Apify memory limit exceeded. Consider upgrading your plan.',
        statusCode: 402,
        retryable: false,
        suggestedAction: 'Try with lower memory settings or wait for limits to reset',
      };
    }
    
    // Billing/subscription limit
    if (message.includes('billing') || message.includes('subscription')) {
      return {
        type: ApifyErrorType.BILLING_LIMIT,
        message: 'Apify billing limit reached',
        statusCode,
        retryable: false,
        suggestedAction: 'Check your Apify subscription at console.apify.com/billing',
      };
    }
    
    // Rate limiting
    if (statusCode === 429 || message.includes('rate limit')) {
      return {
        type: ApifyErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        statusCode: 429,
        retryable: true,
        suggestedAction: 'Wait and retry',
      };
    }
    
    // Timeout
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return {
        type: ApifyErrorType.TIMEOUT,
        message: 'Request timed out',
        retryable: true,
        suggestedAction: 'Retry with longer timeout',
      };
    }
    
    return {
      type: ApifyErrorType.UNKNOWN,
      message,
      statusCode,
      retryable: statusCode ? statusCode >= 500 : false,
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private getBackoffDelay(attempt: number, baseMs: number = 1000): number {
    const jitter = Math.random() * 500;
    return Math.min(baseMs * Math.pow(2, attempt) + jitter, 30000);
  }

  /**
   * Get memory configuration for an actor
   */
  private getMemoryConfig(actorId: string, useMinimal: boolean): number {
    const config = ACTOR_CONFIG[actorId] || ACTOR_CONFIG['default'];
    return useMinimal ? config.minMemory : config.defaultMemory;
  }

  /**
   * Run an actor with resilient error handling
   */
  async runActor<T = any>(
    actorId: string,
    input: Record<string, any>,
    options: ActorRunOptions = {}
  ): Promise<ActorRunResult<T>> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? 2;
    let attempts = 0;
    let lastError: ApifyError | undefined;

    // Check circuit breaker
    if (this.shouldBlockRequest()) {
      return {
        success: false,
        error: {
          type: ApifyErrorType.MEMORY_LIMIT,
          message: 'Apify temporarily unavailable (circuit breaker open)',
          retryable: false,
          suggestedAction: 'Wait for cooldown period or check Apify billing',
        },
        attempts: 0,
        durationMs: Date.now() - startTime,
        usedFallback: false,
      };
    }

    if (!this.client) {
      return {
        success: false,
        error: {
          type: ApifyErrorType.UNKNOWN,
          message: 'Apify client not configured',
          retryable: false,
        },
        attempts: 0,
        durationMs: Date.now() - startTime,
        usedFallback: false,
      };
    }

    // Convert actor ID format (username/actor to username~actor)
    const normalizedActorId = actorId.replace('/', '~');

    while (attempts < maxRetries) {
      attempts++;
      
      try {
        console.log(`[Apify] Running ${actorId} (attempt ${attempts}/${maxRetries})`);
        
        // Call actor with just the input - the apify-client handles timeout/memory internally
        const run = await this.client.actor(normalizedActorId).call(input);

        if (!run) {
          throw new Error('No run result returned');
        }

        // Check run status
        if (run.status !== 'SUCCEEDED') {
          throw new Error(`Actor run failed with status: ${run.status}`);
        }

        // Get dataset items
        const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

        console.log(`[Apify] ${actorId} completed successfully with ${items?.length || 0} items`);

        return {
          success: true,
          data: items as T,
          attempts,
          durationMs: Date.now() - startTime,
          usedFallback: false,
        };

      } catch (error: any) {
        lastError = this.parseError(error);
        console.warn(`[Apify] ${actorId} failed (attempt ${attempts}):`, lastError.message);

        this.recordFailure(lastError);

        // Non-retryable errors - don't retry
        if (!lastError.retryable) {
          break;
        }

        // Wait before retrying with exponential backoff
        if (attempts < maxRetries) {
          const delay = this.getBackoffDelay(attempts);
          console.log(`[Apify] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      durationMs: Date.now() - startTime,
      usedFallback: false,
    };
  }

  /**
   * Get the status of the circuit breaker
   */
  getCircuitBreakerStatus(): { isOpen: boolean; failures: number; resetIn?: number } {
    const status: { isOpen: boolean; failures: number; resetIn?: number } = {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
    };

    if (this.circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
      status.resetIn = Math.max(0, this.CIRCUIT_BREAKER_RESET_MS - timeSinceLastFailure);
    }

    return status;
  }

  /**
   * Manually reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = { failures: 0, lastFailure: 0, isOpen: false };
    console.log('[Apify] Circuit breaker manually reset');
  }
}

// Singleton instance
let clientInstance: ResilientApifyClient | null = null;

export function getResilientApifyClient(): ResilientApifyClient {
  if (!clientInstance) {
    clientInstance = new ResilientApifyClient();
  }
  return clientInstance;
}

export { ResilientApifyClient };
