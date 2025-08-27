# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-26-authentication-retry-fixes/spec.md

> Created: 2025-08-26
> Version: 1.0.0

## Test Coverage

### Unit Tests

**AuthValidationService**
- Should validate successful PAT token authentication
- Should classify 401 errors as invalid token
- Should classify 403 errors as insufficient permissions
- Should handle network errors during validation
- Should return user profile data on successful validation

**ErrorClassifier**
- Should classify 401/403 as authentication errors (non-retryable)
- Should classify 429 as rate limit errors (retryable with delay)
- Should classify network errors (ECONNRESET, ETIMEDOUT, etc.) as retryable
- Should classify 5xx errors as server errors (retryable)
- Should classify 4xx errors (except 401/403/429) as validation errors (non-retryable)
- Should calculate rate limit delays from X-RateLimit-Reset headers
- Should handle missing rate limit headers with sensible defaults

**EnhancedCircuitBreaker**
- Should allow execution when circuit is CLOSED
- Should block execution when circuit is OPEN
- Should transition from CLOSED to OPEN after threshold failures
- Should transition from OPEN to HALF_OPEN after reset timeout
- Should have different thresholds for different error types (auth: 3, network: 12)
- Should reset failure count on successful operation
- Should maintain separate state per error type

**EnhancedRetryService**
- Should not retry authentication errors
- Should not retry validation errors
- Should retry network errors with exponential backoff
- Should retry server errors with linear backoff
- Should use rate limit delay from headers for rate limit errors
- Should respect maximum retry limits per error type
- Should record successes and failures with circuit breaker

### Integration Tests

**Authentication Flow**
- Should block sync operation when PAT token is invalid
- Should proceed with sync when PAT token is valid
- Should fail fast instead of processing hundreds of doomed requests
- Should provide structured error response for authentication failures

**Circuit Breaker Integration**
- Should trip circuit breaker after 3 consecutive authentication failures
- Should trip circuit breaker after 12 consecutive network failures
- Should allow operations to proceed when circuit is closed
- Should block operations when circuit is open
- Should attempt half-open operations after reset timeout

**Retry Logic Integration**
- Should complete operation on first success (no retries needed)
- Should retry network errors with proper backoff delays
- Should respect rate limit headers and delay appropriately
- Should exhaust retries and fail for persistent errors
- Should not retry non-retryable error types

**Sync Service Integration**
- Should validate authentication before starting any work item processing
- Should handle authentication failure gracefully without cascade failures
- Should process work items successfully when authentication is valid
- Should handle mixed error types during batch processing

### Mocking Requirements

**Azure DevOps API Responses**
- **Authentication Success**: Mock successful user profile response with valid user data
- **Authentication Failures**: Mock 401 (invalid token) and 403 (insufficient permissions) responses
- **Rate Limiting**: Mock 429 responses with X-RateLimit-Reset and Retry-After headers
- **Network Errors**: Mock network timeout, connection reset, and DNS failure scenarios
- **Server Errors**: Mock 500, 502, 503 responses for server error testing

**MSW Request Handlers**
```typescript
// Test mocking patterns for MSW
export const authHandlers = [
  // Successful authentication
  http.get('https://dev.azure.com/_apis/profile/profiles/me', () => {
    return HttpResponse.json({
      id: 'user-123',
      displayName: 'Test User',
      emailAddress: 'test@example.com',
      domain: 'example.com'
    });
  }),

  // Invalid token (401)
  http.get('https://dev.azure.com/_apis/profile/profiles/me', () => {
    return new HttpResponse(null, {
      status: 401,
      statusText: 'Unauthorized'
    });
  }),

  // Rate limiting (429)
  http.get('https://dev.azure.com/_apis/wit/*', () => {
    return new HttpResponse(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'X-RateLimit-Reset': String(Math.floor((Date.now() + 60000) / 1000)),
        'Retry-After': '60'
      }
    });
  }),

  // Network timeout simulation
  http.get('https://dev.azure.com/_apis/wit/*', () => {
    return HttpResponse.error();
  }),

  // Server error (503)
  http.get('https://dev.azure.com/_apis/wit/*', () => {
    return new HttpResponse(null, {
      status: 503,
      statusText: 'Service Unavailable'
    });
  })
];
```

**Time-based Test Helpers**
- **Clock Control**: Mock Date.now() for consistent circuit breaker timing tests
- **Delay Verification**: Verify retry delays match expected exponential/linear backoff
- **Timeout Simulation**: Test circuit breaker reset timeout behavior

**Error Simulation Utilities**
```typescript
// Test utilities for error simulation
export class ErrorSimulator {
  static createNetworkError(code: string = 'ECONNRESET'): Error {
    const error = new Error('Network error');
    (error as any).code = code;
    return error;
  }

  static createHttpError(status: number, headers: Record<string, string> = {}): Error {
    const error = new Error(`HTTP ${status}`);
    (error as any).status = status;
    (error as any).headers = headers;
    return error;
  }

  static createRateLimitError(resetTimeSeconds?: number): Error {
    const resetTime = resetTimeSeconds || Math.floor((Date.now() + 60000) / 1000);
    return this.createHttpError(429, {
      'X-RateLimit-Reset': String(resetTime),
      'Retry-After': '60'
    });
  }
}
```

### Test Scenarios

**Authentication Validation Scenarios**
- Valid PAT token returns user profile successfully
- Invalid PAT token (401) blocks sync with clear error message
- Insufficient permissions (403) blocks sync with permission error
- Network failure during auth validation retries appropriately
- Expired token during validation fails gracefully

**Circuit Breaker Scenarios**
- 3 consecutive authentication failures trip auth circuit breaker
- 12 consecutive network failures trip network circuit breaker
- Mixed error types maintain separate circuit states
- Circuit breaker resets after timeout and allows half-open attempts
- Successful operation after circuit trip resets failure count

**Retry Logic Scenarios**
- Authentication error: 0 retries, fails immediately
- Rate limit error: 3 retries with header-specified delays
- Network error: 3 retries with exponential backoff (1s, 2s, 4s)
- Server error: 2 retries with linear backoff (2s, 4s)
- Validation error: 0 retries, fails immediately

**End-to-End Sync Scenarios**
- Complete sync with valid authentication and no errors
- Auth failure blocks sync before any work item processing
- Rate limiting handled gracefully with appropriate delays
- Mixed error types during batch processing handled correctly
- Circuit breaker trips during sync prevent further cascade failures

**Error Message Quality Tests**
- Authentication errors include actionable guidance
- Rate limit errors include retry timing information
- Network errors distinguish between different failure types
- Structured error objects contain consistent fields
- Error logs include sufficient debugging context without sensitive data

### Performance Test Considerations

**Authentication Validation Performance**
- Pre-flight auth check should complete within 500ms
- Auth validation should not significantly impact sync start time
- Multiple consecutive auth validations should be efficient

**Retry Delay Verification**
- Exponential backoff delays should match mathematical expectations
- Rate limit delays should respect server-specified timing
- Maximum delays should not exceed configured limits

**Circuit Breaker Performance**
- Circuit state checks should complete in <1ms
- Circuit breaker memory usage should remain constant
- State transitions should be thread-safe (if applicable)

### Test Data Management

**Mock Data Sets**
- Valid user profile responses with various user configurations
- Invalid token responses with different 401/403 variations
- Rate limit responses with various header combinations
- Network error scenarios covering common failure modes
- Server error responses with different 5xx status codes

**Test Configuration**
- Configurable circuit breaker thresholds for testing edge cases
- Adjustable retry delays for faster test execution
- Mockable time functions for deterministic timing tests
- Isolated test environments to prevent cross-test interference