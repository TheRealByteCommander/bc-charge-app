/**
 * BFF WebSocket proxy: browser → `/api/citrineos/hasura-ws` → Hasura `/v1/graphql`.
 *
 * Why: production nginx already upgrades `/api`, but the Node BFF had no WS handler,
 * so client `initHasuraSubscription` reconnect-spammed. Secrets stay server-side:
 * backend-mode clients send empty `connection_init` payloads; we inject
 * `x-hasura-admin-secret` before forwarding to Hasura.
 *
 * Protocol: legacy `graphql-ws` (subscriptions-transport-ws) — matches the browser client.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger.mjs';

export const HASURA_WS_PATH = '/api/citrineos/hasura-ws';
export const HASURA_WS_SUBPROTOCOL = 'graphql-ws';

/**
 * @param {string} httpUrl
 * @returns {string}
 */
export function httpUrlToWsUrl(httpUrl) {
  const raw = String(httpUrl ?? '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:') u.protocol = 'wss:';
    else if (u.protocol === 'http:') u.protocol = 'ws:';
    else if (u.protocol === 'ws:' || u.protocol === 'wss:') {
      /* already ws */
    } else {
      return '';
    }
    // Hasura GraphQL endpoint is both HTTP POST and WS upgrade target.
    if (!u.pathname || u.pathname === '/') {
      u.pathname = '/v1/graphql';
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function resolveHasuraWsUpstream(env = process.env) {
  const configured = (env.CITRINEOS_HASURA_URL ?? '').trim();
  if (!configured) return null;
  const ws = httpUrlToWsUrl(configured);
  return ws || null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function resolveHasuraAdminSecret(env = process.env) {
  const secret = (env.CITRINEOS_HASURA_ADMIN_SECRET ?? '').trim();
  return secret.length > 0 ? secret : undefined;
}

/**
 * Ensure connection_init carries the admin secret (server-side only).
 * Non-init frames and non-JSON are returned unchanged.
 *
 * @param {string | Buffer | ArrayBuffer | Buffer[]} data
 * @param {string | undefined} secret
 * @returns {{ forward: string | Buffer, mutated: boolean }}
 */
export function injectHasuraAdminSecretIntoClientFrame(data, secret) {
  if (!secret) {
    return { forward: typeof data === 'string' || Buffer.isBuffer(data) ? data : Buffer.from(String(data)), mutated: false };
  }

  let text;
  if (typeof data === 'string') text = data;
  else if (Buffer.isBuffer(data)) text = data.toString('utf8');
  else if (Array.isArray(data)) text = Buffer.concat(data).toString('utf8');
  else if (data instanceof ArrayBuffer) text = Buffer.from(data).toString('utf8');
  else text = String(data ?? '');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { forward: text, mutated: false };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { forward: text, mutated: false };
  }

  if (parsed.type !== 'connection_init') {
    return { forward: text, mutated: false };
  }

  const payload =
    parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
      ? { ...parsed.payload }
      : {};
  const headers =
    payload.headers && typeof payload.headers === 'object' && !Array.isArray(payload.headers)
      ? { ...payload.headers }
      : {};

  const existing =
    headers['x-hasura-admin-secret'] ??
    headers['X-Hasura-Admin-Secret'] ??
    headers['X-HASURA-ADMIN-SECRET'];

  if (typeof existing === 'string' && existing.length > 0) {
    return { forward: text, mutated: false };
  }

  headers['x-hasura-admin-secret'] = secret;
  payload.headers = headers;
  const next = { ...parsed, payload };
  return { forward: JSON.stringify(next), mutated: true };
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} [path]
 * @returns {boolean}
 */
export function isHasuraWsUpgradeRequest(req, path = HASURA_WS_PATH) {
  try {
    const host = req.headers.host || '127.0.0.1';
    const u = new URL(req.url || '/', `http://${host}`);
    return u.pathname === path;
  } catch {
    return false;
  }
}

/**
 * Attach upgrade handler to an http.Server created around the Express app.
 *
 * @param {import('http').Server} server
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   path?: string,
 *   logger?: { info?: Function, warn?: Function, error?: Function, debug?: Function },
 * }} [options]
 * @returns {{ wss: import('ws').WebSocketServer, path: string }}
 */
export function attachHasuraWsProxy(server, options = {}) {
  const env = options.env ?? process.env;
  const path = options.path ?? HASURA_WS_PATH;
  const log = options.logger ?? logger;
  const wss = new WebSocketServer({ noServer: true, handleProtocols: () => HASURA_WS_SUBPROTOCOL });

  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('stream').Duplex} socket
   * @param {Buffer} head
   */
  function onUpgrade(req, socket, head) {
    if (!isHasuraWsUpgradeRequest(req, path)) {
      return;
    }

    const upstreamUrl = resolveHasuraWsUpstream(env);
    if (!upstreamUrl) {
      log.warn?.('Hasura WS proxy: CITRINEOS_HASURA_URL not configured — rejecting upgrade');
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: 19\r\n\r\nHasura not configured');
      socket.destroy();
      return;
    }

    const secret = resolveHasuraAdminSecret(env);

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);

      /** @type {import('ws').WebSocket | null} */
      let upstream = null;
      let closed = false;
      /** @type {(string|Buffer)[]} */
      const pending = [];

      const closeBoth = (code = 1000, reason = 'closing') => {
        if (closed) return;
        closed = true;
        try {
          if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
            clientWs.close(code, reason);
          }
        } catch {
          /* ignore */
        }
        try {
          if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
            upstream.close(code, reason);
          }
        } catch {
          /* ignore */
        }
      };

      try {
        upstream = new WebSocket(upstreamUrl, HASURA_WS_SUBPROTOCOL, {
          headers: secret ? { 'x-hasura-admin-secret': secret } : undefined,
          handshakeTimeout: 8_000,
        });
      } catch (err) {
        log.error?.('Hasura WS proxy: failed to open upstream', {
          message: err instanceof Error ? err.message : String(err),
        });
        closeBoth(1011, 'upstream open failed');
        return;
      }

      upstream.on('open', () => {
        log.info?.('Hasura WS proxy: upstream connected', { path, upstreamUrl: upstreamUrl.replace(/\/\/.*@/, '//') });
        for (const frame of pending) {
          if (upstream?.readyState === WebSocket.OPEN) upstream.send(frame);
        }
        pending.length = 0;
      });

      upstream.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data, { binary: Boolean(isBinary) });
        }
      });

      upstream.on('error', (err) => {
        log.error?.('Hasura WS proxy: upstream error', {
          message: err instanceof Error ? err.message : String(err),
        });
        closeBoth(1011, 'upstream error');
      });

      upstream.on('close', (code, reason) => {
        const reasonText = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '');
        log.debug?.('Hasura WS proxy: upstream closed', { code, reason: reasonText });
        closeBoth(code || 1000, reasonText.slice(0, 120) || 'upstream closed');
      });

      clientWs.on('message', (data) => {
        const { forward, mutated } = injectHasuraAdminSecretIntoClientFrame(data, secret);
        if (mutated) {
          log.debug?.('Hasura WS proxy: injected admin secret into connection_init');
        }
        if (!upstream || upstream.readyState === WebSocket.CONNECTING) {
          pending.push(forward);
          return;
        }
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(forward);
        }
      });

      clientWs.on('error', (err) => {
        log.error?.('Hasura WS proxy: client error', {
          message: err instanceof Error ? err.message : String(err),
        });
        closeBoth(1011, 'client error');
      });

      clientWs.on('close', () => {
        closeBoth(1000, 'client closed');
      });
    });
  }

  server.on('upgrade', onUpgrade);
  log.info?.(`Hasura WS proxy attached at ${path}`);
  return { wss, path };
}
