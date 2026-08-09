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
  /** Max successful uses. Default 1 for start/stop, unlimited (-1) not used. */
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
    const maxUses = input.maxUses ?? 1;
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
      metadata: input.metadata,
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
    const now = Date.now();
    return Array.from(this.tokens.values())
      .filter((r) => includeRevoked || !r.revokedAt)
      .map((r) => ({ ...r }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Validate token for a purpose and consume one use on success.
   */
  public resolveAndConsume(token: string, purpose: 'start' | 'stop'): DeepLinkResolveResult {
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

    record.useCount += 1;
    record.lastUsedAt = new Date().toISOString();
    this.tokens.set(record.token, record);
    this.persist();
    return { ok: true, record: { ...record } };
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
      const parsed = JSON.parse(raw) as StoreFileShape;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tokens)) {
        throw new Error('Invalid deep-link store format');
      }
      this.tokens.clear();
      for (const record of parsed.tokens) {
        if (record?.token && record.stationId && Number.isInteger(record.connectorId)) {
          this.tokens.set(record.token, record);
        }
      }
    } catch (error) {
      console.error(`Failed to load deep-link token store from ${this.filePath}:`, error);
    }
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
