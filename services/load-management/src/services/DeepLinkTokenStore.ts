import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type DeepLinkPurpose = 'start' | 'stop' | 'both';

export interface DeepLinkTokenRecord {
  token: string;
  stationId: string;
  connectorId: number;
  purpose: DeepLinkPurpose;
  customerId?: string;
  locationId?: string;
  idTag?: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CreateDeepLinkTokenInput {
  stationId: string;
  connectorId: number;
  purpose?: DeepLinkPurpose;
  customerId?: string;
  locationId?: string;
  idTag?: string;
  /** Absolute expiry. Defaults to now + ttlSeconds. */
  expiresAt?: Date;
  /** TTL in seconds when expiresAt is omitted. Default 24h. */
  ttlSeconds?: number;
  /**
   * Max successful uses.
   * Default: 2 for purpose "both" (start+stop), otherwise 1.
   */
  maxUses?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type DeepLinkResolveErrorCode =
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'PURPOSE_MISMATCH';

export type DeepLinkResolveResult =
  | { ok: true; record: DeepLinkTokenRecord }
  | { ok: false; code: DeepLinkResolveErrorCode; message: string };

interface StoreFileShape {
  version: 1;
  tokens: DeepLinkTokenRecord[];
}


/**
 * Parse-don't-cast for deep-link metadata bags.
 * Keeps only plain string/number/boolean values; drops nested objects, arrays,
 * null/undefined, NaN/Infinity. Empty/corrupt bags become undefined.
 */
export function normalizeDeepLinkMetadata(
  value: unknown
): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!key) continue;
    if (typeof rawVal === 'string') {
      out[key] = rawVal;
      continue;
    }
    if (typeof rawVal === 'boolean') {
      out[key] = rawVal;
      continue;
    }
    if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
      out[key] = rawVal;
      continue;
    }
    // drop nested objects, arrays, null, undefined, NaN/Infinity, symbols, functions
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Durable deep-link token store (JSON file + atomic rewrite).
 * Tokens authorize remote start/stop for a concrete station/connector.
 */
export class DeepLinkTokenStore {
  private readonly filePath: string;
  private readonly tokens = new Map<string, DeepLinkTokenRecord>();

  constructor(filePath?: string) {
    this.filePath =
      filePath ||
      process.env.DEEP_LINK_STORE_PATH ||
      join(process.cwd(), 'data', 'deep-link-tokens.json');
    this.load();
  }

  public create(input: CreateDeepLinkTokenInput): DeepLinkTokenRecord {
    const stationId = input.stationId?.trim();
    if (!stationId) {
      throw new Error('stationId is required');
    }
    if (!Number.isInteger(input.connectorId) || input.connectorId < 0) {
      throw new Error('connectorId must be a non-negative integer');
    }

    const now = new Date();
    const ttlSeconds = input.ttlSeconds ?? 24 * 60 * 60;
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + ttlSeconds * 1000);
    if (expiresAt.getTime() <= now.getTime()) {
      throw new Error('expiresAt must be in the future');
    }

    const purpose: DeepLinkPurpose = input.purpose ?? 'both';
    // purpose "both" needs at least start+stop by default
    const maxUses = input.maxUses ?? (purpose === 'both' ? 2 : 1);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      throw new Error('maxUses must be an integer >= 1');
    }

    const record: DeepLinkTokenRecord = {
      token: this.generateToken(),
      stationId,
      connectorId: input.connectorId,
      purpose,
      customerId: input.customerId?.trim() || undefined,
      locationId: input.locationId?.trim() || undefined,
      idTag: input.idTag?.trim() || undefined,
      maxUses,
      useCount: 0,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: normalizeDeepLinkMetadata(input.metadata),
    };

    this.tokens.set(record.token, record);
    this.persist();
    return { ...record };
  }

  public get(token: string): DeepLinkTokenRecord | undefined {
    const record = this.tokens.get(token);
    return record ? { ...record } : undefined;
  }

  public list(includeRevoked = false): DeepLinkTokenRecord[] {
    return Array.from(this.tokens.values())
      .filter((r) => includeRevoked || !r.revokedAt)
      .map((r) => ({ ...r }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Validate token for a purpose without consuming a use.
   */
  public peek(token: string, purpose: 'start' | 'stop'): DeepLinkResolveResult {
    return this.validate(token, purpose);
  }

  /**
   * Validate token for a purpose and consume one use on success.
   */
  public resolveAndConsume(token: string, purpose: 'start' | 'stop'): DeepLinkResolveResult {
    const validated = this.validate(token, purpose);
    if (!validated.ok) {
      return validated;
    }

    const record = this.tokens.get(token);
    if (!record) {
      return { ok: false, code: 'NOT_FOUND', message: 'Deep-link token not found' };
    }

    record.useCount += 1;
    record.lastUsedAt = new Date().toISOString();
    this.tokens.set(record.token, record);
    this.persist();
    return { ok: true, record: { ...record } };
  }

  /**
   * Undo one consumption (e.g. remote command could not be delivered).
   */
  public releaseUse(token: string): boolean {
    const record = this.tokens.get(token);
    if (!record || record.useCount <= 0) {
      return false;
    }
    record.useCount -= 1;
    this.tokens.set(token, record);
    this.persist();
    return true;
  }

  public revoke(token: string): boolean {
    const record = this.tokens.get(token);
    if (!record || record.revokedAt) {
      return false;
    }
    record.revokedAt = new Date().toISOString();
    this.tokens.set(token, record);
    this.persist();
    return true;
  }

  /** Drop expired / fully used / revoked tokens older than retainMs. */
  public prune(retainMs = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - retainMs;
    let removed = 0;
    for (const [token, record] of this.tokens.entries()) {
      const expired = Date.parse(record.expiresAt) <= Date.now();
      const exhausted = record.useCount >= record.maxUses;
      const revoked = Boolean(record.revokedAt);
      const lastActivity = Date.parse(record.lastUsedAt || record.createdAt);
      if ((expired || exhausted || revoked) && lastActivity < cutoff) {
        this.tokens.delete(token);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.persist();
    }
    return removed;
  }

  private validate(token: string, purpose: 'start' | 'stop'): DeepLinkResolveResult {
    const record = this.tokens.get(token);
    if (!record) {
      return { ok: false, code: 'NOT_FOUND', message: 'Deep-link token not found' };
    }
    if (record.revokedAt) {
      return { ok: false, code: 'REVOKED', message: 'Deep-link token has been revoked' };
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      return { ok: false, code: 'EXPIRED', message: 'Deep-link token has expired' };
    }
    if (record.useCount >= record.maxUses) {
      return { ok: false, code: 'EXHAUSTED', message: 'Deep-link token has no remaining uses' };
    }
    if (record.purpose !== 'both' && record.purpose !== purpose) {
      return {
        ok: false,
        code: 'PURPOSE_MISMATCH',
        message: `Deep-link token is not valid for ${purpose}`,
      };
    }
    return { ok: true, record: { ...record } };
  }

  private generateToken(): string {
    // URL-safe, high-entropy token
    const raw = randomBytes(32).toString('base64url');
    // Optional short checksum prefix for log correlation without leaking full token
    const checksum = createHash('sha256').update(raw).digest('hex').slice(0, 6);
    return `dl_${checksum}_${raw}`;
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) {
        return;
      }
      const raw = readFileSync(this.filePath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Deep-link store is not valid JSON');
      }
      if (!this.isStoreFileShape(parsed)) {
        throw new Error('Invalid deep-link store format');
      }
      this.tokens.clear();
      for (const candidate of parsed.tokens) {
        const record = this.normalizeRecord(candidate);
        if (record) {
          this.tokens.set(record.token, record);
        }
      }
    } catch (error) {
      console.error(`Failed to load deep-link token store from ${this.filePath}:`, error);
    }
  }

  private isStoreFileShape(value: unknown): value is StoreFileShape {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const obj = value as { version?: unknown; tokens?: unknown };
    return obj.version === 1 && Array.isArray(obj.tokens);
  }

  /**
   * Parse/validate a persisted token record. Drops corrupt entries instead of casting.
   */
  private normalizeRecord(value: unknown): DeepLinkTokenRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const r = value as Record<string, unknown>;
    if (typeof r.token !== 'string' || !r.token.trim()) {
      return null;
    }
    if (typeof r.stationId !== 'string' || !r.stationId.trim()) {
      return null;
    }
    const connectorId = Number(r.connectorId);
    if (!Number.isInteger(connectorId) || connectorId < 0) {
      return null;
    }
    const purpose = r.purpose;
    if (purpose !== 'start' && purpose !== 'stop' && purpose !== 'both') {
      return null;
    }
    const maxUses = Number(r.maxUses);
    const useCount = Number(r.useCount);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      return null;
    }
    if (!Number.isInteger(useCount) || useCount < 0) {
      return null;
    }
    if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) {
      return null;
    }
    if (typeof r.expiresAt !== 'string' || Number.isNaN(Date.parse(r.expiresAt))) {
      return null;
    }

    const metadata = normalizeDeepLinkMetadata(r.metadata);

    const optionalString = (v: unknown): string | undefined => {
      if (typeof v !== 'string') return undefined;
      const t = v.trim();
      return t || undefined;
    };

    return {
      token: r.token,
      stationId: r.stationId.trim(),
      connectorId,
      purpose,
      customerId: optionalString(r.customerId),
      locationId: optionalString(r.locationId),
      idTag: optionalString(r.idTag),
      maxUses,
      useCount,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      lastUsedAt: optionalString(r.lastUsedAt),
      revokedAt: optionalString(r.revokedAt),
      metadata,
    };
  }

  private persist(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const payload: StoreFileShape = {
      version: 1,
      tokens: Array.from(this.tokens.values()),
    };
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmpPath, this.filePath);
  }
}
