import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type ApiAuthOptions = {
  /**
   * Expected API key. When empty/undefined and `required` is false,
   * the middleware allows the request (dev convenience) after a one-time warn.
   */
  apiKey?: string;
  /**
   * When true, missing/invalid credentials are always rejected.
   * Forced on when NODE_ENV=production or LM_API_AUTH_REQUIRED=1/true.
   */
  required?: boolean;
  /** Header names accepted for the raw key (in addition to Authorization Bearer). */
  headerNames?: string[];
  logger?: Pick<Console, 'warn' | 'error'>;
};

export type ApiAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

let warnedMissingKey = false;

function envFlagTrue(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Resolve whether admin API auth must be enforced from env.
 * Production always requires a configured key; LM_API_AUTH_REQUIRED forces it in other envs.
 */
export function isApiAuthRequiredFromEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV === 'production') return true;
  return envFlagTrue(env.LM_API_AUTH_REQUIRED);
}

/**
 * Resolve the configured load-management admin API key.
 * Prefers LM_API_KEY; LOAD_MANAGEMENT_API_KEY is an alias.
 */
export function resolveApiKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const key = (env.LM_API_KEY || env.LOAD_MANAGEMENT_API_KEY || '').trim();
  return key.length > 0 ? key : undefined;
}

/**
 * Extract a presented API key from common headers.
 * Supports: Authorization: Bearer <key>, x-api-key, x-lm-api-key.
 */
export function extractPresentedApiKey(
  req: Pick<Request, 'get' | 'headers'>,
  headerNames: string[] = ['x-api-key', 'x-lm-api-key']
): string | undefined {
  const auth = req.get?.('authorization') ?? req.headers?.authorization;
  if (typeof auth === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match?.[1]) {
      const bearer = match[1].trim();
      if (bearer.length > 0) return bearer;
    }
  }

  for (const name of headerNames) {
    const raw = req.get?.(name) ?? req.headers?.[name];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
      return raw[0].trim();
    }
  }

  return undefined;
}

/**
 * Constant-time string compare that does not short-circuit on length
 * in a way that leaks the expected key (pads via hash-length buffers).
 */
export function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Compare against self to keep work roughly constant, then fail.
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Express middleware guarding admin/mutating load-management routes.
 * Deep-link start/stop remain public — the deep-link token is the capability.
 */
export function createApiAuthMiddleware(options: ApiAuthOptions = {}): ApiAuthMiddleware {
  const expected = (options.apiKey ?? '').trim();
  const required =
    options.required ??
    (isApiAuthRequiredFromEnv() || expected.length > 0);
  const headerNames = options.headerNames ?? ['x-api-key', 'x-lm-api-key'];
  const log = options.logger ?? console;

  // Production / forced auth without a configured key is a hard misconfig.
  if (required && !expected) {
    log.error(
      '[load-management] Admin API auth required but LM_API_KEY is not set. ' +
        'Protected routes will respond 503 until configured.'
    );
  }

  if (!required && !expected && !warnedMissingKey) {
    warnedMissingKey = true;
    log.warn(
      '[load-management] LM_API_KEY unset — admin routes are open (dev only). ' +
        'Set LM_API_KEY or LM_API_AUTH_REQUIRED=1 before production.'
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!expected) {
      if (required) {
        res.status(503).json({
          success: false,
          code: 'AUTH_NOT_CONFIGURED',
          message:
            'Admin API authentication is required but LM_API_KEY is not configured',
        });
        return;
      }
      next();
      return;
    }

    const presented = extractPresentedApiKey(req, headerNames);
    if (!presented || !safeEqualString(presented, expected)) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message:
          'Missing or invalid API key. Provide Authorization: Bearer <LM_API_KEY> or x-api-key header.',
      });
      return;
    }

    next();
  };
}

/** Test helper: reset one-time warn flag between cases. */
export function resetApiAuthWarnStateForTests(): void {
  warnedMissingKey = false;
}
