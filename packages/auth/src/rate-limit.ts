export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
}

export function checkRateLimit(
  attempts: { createdAt: Date }[],
  config: RateLimitConfig
): RateLimitResult {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);
  
  const recentAttempts = attempts.filter(a => a.createdAt >= windowStart);
  const remaining = Math.max(0, config.maxAttempts - recentAttempts.length);
  const allowed = recentAttempts.length < config.maxAttempts;
  
  const resetTime = new Date(windowStart.getTime() + config.windowMs);
  
  return { allowed, remaining, resetTime };
}

// Preset configs
export const RATE_LIMITS = {
  signup: { windowMs: 3600000, maxAttempts: 5 }, // 5 per hour
  login: { windowMs: 900000, maxAttempts: 10 }, // 10 per 15 min
  otpSend: { windowMs: 3600000, maxAttempts: 3 }, // 3 per hour
  passwordReset: { windowMs: 3600000, maxAttempts: 3 }, // 3 per hour
} as const;
