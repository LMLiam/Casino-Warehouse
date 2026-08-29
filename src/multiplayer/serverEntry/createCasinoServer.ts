import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { Duplex } from 'node:stream';
import helmet, { type HelmetOptions } from 'helmet';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import type { ConnectionId } from '../../schemas/casinoSchemas/ConnectionId';
import { authTokenSchema } from '../../schemas/casinoSchemas/authTokenSchema';
import { connectionIdSchema } from '../../schemas/casinoSchemas/connectionIdSchema';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import type { ProfileToken } from '../../schemas/casinoSchemas/ProfileToken';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { serverInstanceIdSchema } from '../../schemas/casinoSchemas/serverInstanceIdSchema';
import { RoomAuthority } from '../roomAuthority';
import type { ClientMessage } from '../protocol/ClientMessage';
import { parseClientMessage } from '../protocol/parseClientMessage';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { ServerMessage } from '../protocol/ServerMessage';
import { createSessionState } from '../../state/session/createSessionState';
import { createDefaultServerDataStore } from '../../state/serverDataStore/createDefaultServerDataStore';
import { profileTokenAuth } from '../../state/serverDataStore/profileTokenAuth';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';
import type { CasinoServer } from './CasinoServer';
import type { CasinoServerOptions } from './CasinoServerOptions';
import type { Peer } from './Peer';
import { WebSocketOriginPolicy } from './WebSocketOriginPolicy';

export const createCasinoServer = (options: CasinoServerOptions = {}): CasinoServer => {
  const closeUnsupportedData = 1003;
  const maxClientMessageBytes = 64 * 1024;
  const permissionsPolicy = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()';
  const securityHeaderOptions = {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'none'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        // Pixi's no-eval runtime module keeps scripts self-only. The current UI writes inline style attributes and CSS custom properties, so styles keep unsafe-inline.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", 'blob:'],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: false,
    xFrameOptions: { action: 'deny' },
  } satisfies HelmetOptions;
  const securityHeaders = helmet(securityHeaderOptions);
  const distRoot = options.distRoot ?? process.env.CASINO_STATIC_ROOT ?? 'dist';
  const dataStore = options.dataStore ?? createDefaultServerDataStore();
  const authority = options.authority ?? new RoomAuthority(dataStore);
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 2_000;
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
  const configuredAdminToken = options.adminToken ?? process.env.CASINO_ADMIN_TOKEN ?? '';
  const parsedAdminToken = authTokenSchema.safeParse(configuredAdminToken);
  const adminToken = parsedAdminToken.success ? parsedAdminToken.data : undefined;
  const serverInstanceId = serverInstanceIdSchema.parse(options.serverInstanceId ?? randomUUID());
  const publicBaseUrl = (): string => {
    const configuredBaseUrl = typeof options.publicBaseUrl === 'function' ? options.publicBaseUrl() : options.publicBaseUrl;
    return (configuredBaseUrl ?? process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
  };
  const publicWebSocketUrl = (): string => {
    const configuredWebSocketUrl = typeof options.publicWebSocketUrl === 'function' ? options.publicWebSocketUrl() : options.publicWebSocketUrl;
    const configuredUrl = configuredWebSocketUrl ?? process.env.PUBLIC_WEBSOCKET_URL ?? '';
    if (configuredUrl) {
      return configuredUrl.replace(/\/$/, '');
    }
    const currentPublicBaseUrl = publicBaseUrl();
    return currentPublicBaseUrl ? webSocketUrl(currentPublicBaseUrl) : '';
  };
  const peers = new Map<ConnectionId, Peer>();
  const websocketServer = new WebSocketServer({
    clientTracking: false,
    maxPayload: maxClientMessageBytes,
    noServer: true,
    perMessageDeflate: false,
  });

  const server = createServer((request, response) => {
    applySecurityHeaders(request, response, () => {
      if (request.url === '/health') {
        response.writeHead(200, responseHeaders({ 'content-type': 'application/json' }));
        response.end(JSON.stringify({ ok: true, multiplayer: true }));
        return;
      }

      const filePath = staticPath(request, distRoot);
      if (!filePath || !existsSync(filePath)) {
        if (!shouldServeAppFallback(request, filePath)) {
          response.writeHead(404, responseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }));
          response.end('Not found');
          return;
        }

        serveIndex(response);
        return;
      }

      if (isIndexHtml(filePath)) {
        serveIndex(response);
        return;
      }

      response.writeHead(200, cacheHeaders(filePath));
      response.end(readFileSync(filePath));
    });
  });

  const broadcast = (message: ServerMessage | undefined, recipients?: readonly ConnectionId[]): void => {
    if (!message) {
      return;
    }
    const allowed = recipients ? new Set(recipients) : undefined;
    for (const peer of peers.values()) {
      if (allowed && !allowed.has(peer.id)) {
        continue;
      }
      send(peer, message);
    }
  };

  const broadcastRoomLists = (gameIds: Iterable<RoomGameId>): void => {
    const uniqueGameIds = new Set(gameIds);
    for (const gameId of uniqueGameIds) {
      const recipients = [...peers.values()].filter((candidate) => candidate.browsingGameId === gameId).map((candidate) => candidate.id);
      if (recipients.length > 0) {
        broadcast({ type: 'room-list', gameId, rooms: authority.listRoomSummaries(gameId) }, recipients);
      }
    }
  };

  const sendDataState = (peer: Peer): void => {
    const snapshot = dataStore.snapshot();
    send(peer, {
      type: 'data-state',
      database: snapshot.database,
      profileState: snapshot.profileState,
      session: snapshot.session,
    });
  };

  const sendProfileAccess = (peer: Peer): void => {
    send(peer, { type: 'profile-access', ownedProfileIds: [...peer.ownedProfileIds] });
  };

  const sendAdminAccess = (peer: Peer): void => {
    send(peer, { type: 'admin-access', authorized: peer.isAdmin });
  };

  const broadcastDataState = (): void => {
    for (const peer of peers.values()) {
      sendDataState(peer);
    }
  };

  const emitAuthorityResult = (peer: Peer, result: ReturnType<CasinoRoomAuthority['handle']>, options: { readonly forceDataState?: boolean } = {}): void => {
    if (result.error) {
      send(peer, { type: 'error', code: 'rejected', message: result.error });
    }
    if (result.roomList) {
      send(peer, { type: 'room-list', gameId: result.roomList.gameId, rooms: result.roomList.rooms });
    }
    if (result.direct) {
      send(peer, {
        type: 'room-created',
        room: result.direct,
        invitePath: createInvitePath(result.direct.gameId, result.direct.roomId),
      });
    }
    for (const closure of result.roomClosures ?? []) {
      broadcast({ type: 'room-closed', roomId: closure.roomId, gameId: closure.gameId, reason: closure.reason }, closure.connectionIds);
    }
    const broadcastRecipients = new Map((result.broadcastRecipients ?? []).map((entry) => [entry.roomId, entry.connectionIds]));
    for (const snapshot of result.broadcasts) {
      broadcast({ type: 'room-state', room: snapshot }, broadcastRecipients.get(snapshot.roomId) ?? connectionIds(snapshot));
    }
    broadcastRoomLists(roomListGameIds(result));
    if (result.settlements.length > 0) {
      const room = result.broadcasts.at(-1);
      if (room) {
        broadcast({ type: 'settlement', roomId: room.roomId, sessionId: room.sessionId, settlements: result.settlements }, connectionIds(room));
      }
    }
    if (options.forceDataState || result.broadcasts.length > 0 || result.settlements.length > 0 || (result.roomClosures?.length ?? 0) > 0) {
      broadcastDataState();
    }
  };
  authority.setAsyncResultHandler?.((result) => {
    const peer = peers.values().next().value;
    if (peer) {
      emitAuthorityResult(peer, result);
    }
  });

  const handleDataMessage = (peer: Peer, message: ReturnType<typeof parseClientMessage>['message']): boolean => {
    if (!message) {
      return false;
    }
    try {
      switch (message.type) {
        case 'heartbeat-ack':
          peer.lastPongAt = Date.now();
          return true;
        case 'authorize-profiles':
          authorizeProfiles(peer, message.profileTokens);
          sendProfileAccess(peer);
          return true;
        case 'authorize-admin':
          peer.isAdmin = adminToken !== undefined && profileTokenAuth.safeSecretEqual(adminToken, message.adminToken);
          sendAdminAccess(peer);
          return true;
        case 'request-data':
          sendDataState(peer);
          return true;
        case 'create-profile':
          createOwnedProfile(peer, message.profileName);
          broadcastDataState();
          return true;
        case 'rename-profile':
          requireOwnedProfile(peer, message.profileId);
          dataStore.renameProfile(message.profileId, message.profileName);
          emitAuthorityResult(peer, authority.reconcileProfiles('profile-renamed'), { forceDataState: true });
          return true;
        case 'delete-profile':
          requireOwnedProfile(peer, message.profileId);
          dataStore.deleteProfile(message.profileId);
          peer.ownedProfileIds.delete(message.profileId);
          sendProfileAccess(peer);
          emitAuthorityResult(peer, authority.removeProfile(message.profileId, 'profile-deleted'), { forceDataState: true });
          return true;
        case 'house-advance':
          acceptHouseAdvance(peer, message.profileId);
          emitAuthorityResult(peer, authority.reconcileProfiles('house-advance-accepted'), { forceDataState: true });
          return true;
        case 'save-session':
          requireProfile(message.session.profileId);
          requireOwnedProfile(peer, message.session.profileId);
          dataStore.saveSession(createSessionState(message.session.profileId, message.session));
          sendDataState(peer);
          return true;
        case 'admin-bankroll':
          requireAdmin(peer);
          applyAdminBankroll(message.profileId, message.action, message.amount ?? 0);
          emitAuthorityResult(peer, authority.reconcileProfiles('bankroll-updated'), { forceDataState: true });
          return true;
        case 'admin-reset-all':
          requireAdmin(peer);
          resetAllBankrolls();
          emitAuthorityResult(peer, authority.reconcileProfiles('bankroll-reset'), { forceDataState: true });
          return true;
        case 'clear-server-data':
          requireAdmin(peer);
          dataStore.clear();
          for (const candidate of peers.values()) {
            candidate.ownedProfileIds.clear();
            sendProfileAccess(candidate);
          }
          emitAuthorityResult(peer, authority.clearRooms('server-data-cleared'), { forceDataState: true });
          return true;
        default:
          return false;
      }
    } catch (error) {
      send(peer, {
        type: 'error',
        code: 'rejected',
        message: error instanceof Error ? error.message : 'Server data action failed.',
      });
      return true;
    }
  };

  const createOwnedProfile = (peer: Peer, profileName: string): void => {
    const snapshot = dataStore.createProfile(profileName, 1000);
    const profile = snapshot.profileState.profiles.at(-1);
    if (!profile) {
      throw new Error('Profile could not be created.');
    }
    const profileToken = profileTokenAuth.createToken();
    dataStore.setProfileTokenHash(profile.id, profileTokenAuth.hash(profile.id, profileToken));
    peer.ownedProfileIds.add(profile.id);
    send(peer, { type: 'profile-credentials', profileId: profile.id, profileToken });
    sendProfileAccess(peer);
  };

  const authorizeProfiles = (
    peer: Peer,
    profileTokens: readonly {
      readonly profileId: ProfileId;
      readonly profileToken: ProfileToken;
    }[],
  ): void => {
    peer.ownedProfileIds.clear();
    for (const { profileId, profileToken } of profileTokens) {
      if (isProfileTokenValid(profileId, profileToken)) {
        peer.ownedProfileIds.add(profileId);
      }
    }
  };

  const requireOwnedProfile = (peer: Peer, profileId: ProfileId) => {
    const profile = requireProfile(profileId);
    if (!peer.ownedProfileIds.has(profileId)) {
      throw new Error('This browser is not authorized to use that profile.');
    }
    return profile;
  };

  const requireAdmin = (peer: Peer): void => {
    if (!peer.isAdmin) {
      throw new Error('Admin controls are locked for this browser.');
    }
  };

  const isProfileTokenValid = (profileId: ProfileId, profileToken: ProfileToken): boolean => {
    const expectedHash = dataStore.profileTokenHash(profileId);
    return Boolean(expectedHash) && profileTokenAuth.matches(profileId, profileToken, expectedHash ?? '');
  };

  const applyAdminBankroll = (profileId: ProfileId, action: 'add' | 'subtract' | 'reset', amount: number): void => {
    const profile = requireProfile(profileId);
    const delta =
      action === 'add'
        ? Math.max(0, Math.floor(amount))
        : action === 'subtract'
          ? -Math.min(profile.bankroll, Math.max(0, Math.floor(amount)))
          : 1000 - profile.bankroll;
    const clearsHouseAdvance = action === 'reset' && (profile.houseAdvance.outstandingBalance > 0 || profile.houseAdvance.activeCount > 0);
    if (delta !== 0 || clearsHouseAdvance) {
      dataStore.recordTransaction(profileId, {
        gameId: 'admin',
        type: action === 'reset' ? 'reset' : 'admin_adjustment',
        amount: delta,
        description: `Admin bankroll ${action}`,
        metadata: {},
      });
    }
  };

  const resetAllBankrolls = (): void => {
    for (const profile of dataStore.snapshot().profileState.profiles) {
      const delta = 1000 - profile.bankroll;
      if (delta !== 0 || profile.houseAdvance.outstandingBalance > 0 || profile.houseAdvance.activeCount > 0) {
        dataStore.recordTransaction(profile.id, { gameId: 'admin', type: 'reset', amount: delta, description: 'Admin reset all profiles', metadata: {} });
      }
    }
  };

  const acceptHouseAdvance = (peer: Peer, profileId: ProfileId): void => {
    const profile = requireOwnedProfile(peer, profileId);
    const updated = dataStore.acceptHouseAdvance(profile.id);
    if (!updated) {
      if (profile.bankroll > 0) {
        throw new Error('House Advance is available only when this profile has no credits.');
      }
      if (profile.houseAdvance.activeCount >= 3 && profile.houseAdvance.outstandingBalance > 0) {
        throw new Error('House Advance is unavailable until the current balance is repaid.');
      }
      throw new Error('House Advance could not be accepted for this profile.');
    }
  };

  const requireProfile = (profileId: ProfileId) => {
    const profile = dataStore.snapshot().profileState.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error('Profile was not found.');
    }
    return profile;
  };

  const useServerProfile = (peer: Peer, message: ClientMessage): ClientMessage => {
    if (message.type !== 'create-room' && message.type !== 'join-room') {
      return message;
    }
    const profile = requireOwnedProfile(peer, message.profileId);
    return { ...message, profileName: profile.name, bankroll: profile.bankroll };
  };

  const handlePayload = (peer: Peer, payload: string): void => {
    let parsedJson: JsonValue;
    try {
      parsedJson = parseJsonText(payload);
    } catch {
      send(peer, { type: 'error', code: 'bad-json', message: 'Message was not valid JSON.' });
      return;
    }

    const parsed = parseClientMessage(parsedJson);
    if (!parsed.ok || !parsed.message) {
      send(peer, { type: 'error', code: 'bad-message', message: parsed.error ?? 'Message was invalid.' });
      return;
    }
    if (handleDataMessage(peer, parsed.message)) {
      return;
    }

    let serverOwnedMessage: ClientMessage;
    try {
      serverOwnedMessage = useServerProfile(peer, parsed.message);
    } catch (error) {
      send(peer, {
        type: 'error',
        code: 'rejected',
        message: error instanceof Error ? error.message : 'Server rejected the player action.',
      });
      return;
    }

    const result = authority.handle(peer.id, serverOwnedMessage);
    if (serverOwnedMessage.type === 'list-rooms') {
      peer.browsingGameId = serverOwnedMessage.gameId;
    }
    emitAuthorityResult(peer, result);
  };

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const peer of [...peers.values()]) {
      if (now - peer.lastPongAt > heartbeatTimeoutMs) {
        peer.socket.terminate();
        peers.delete(peer.id);
        const result = authority.disconnect(peer.id);
        const snapshot = result.broadcasts.at(-1);
        broadcast(snapshot ? { type: 'room-state', room: snapshot } : undefined, snapshot ? connectionIds(snapshot) : undefined);
        broadcastRoomLists(roomListGameIds(result));
        continue;
      }
      send(peer, { type: 'heartbeat', sentAt: now });
    }
  }, heartbeatIntervalMs);
  server.on('close', () => {
    clearInterval(heartbeat);
    authority.setAsyncResultHandler?.(undefined);
    authority.dispose?.();
    websocketServer.close();
  });
  websocketServer.on('wsClientError', (_error, socket) => {
    socket.destroy();
  });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    if (!WebSocketOriginPolicy.allows(request, publicBaseUrl())) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const peer: Peer = { id: connectionIdSchema.parse(randomUUID()), socket: websocket, ownedProfileIds: new Set(), lastPongAt: Date.now(), isAdmin: false };
      const clientServerInstanceId = serverInstanceIdSchema.safeParse(requestUrl.searchParams.get('clientServerInstanceId') ?? '');
      if (clientServerInstanceId.success && clientServerInstanceId.data !== serverInstanceId) {
        send(peer, {
          type: 'reload-required',
          reason: 'server-restarted',
          message: 'The game server restarted. Reload the app to use the latest client.',
        });
        websocket.close();
        return;
      }

      peers.set(peer.id, peer);
      send(peer, { type: 'server-hello', serverInstanceId });
      send(peer, { type: 'error', code: 'connected', message: 'Connected to Casino Warehouse game server.' });
      sendDataState(peer);

      websocket.on('message', (data, isBinary) => {
        if (isBinary || Array.isArray(data)) {
          websocket.close(closeUnsupportedData, 'Only text JSON messages are supported.');
          return;
        }
        handlePayload(peer, textPayload(data));
      });
      websocket.on('pong', () => {
        peer.lastPongAt = Date.now();
      });
      websocket.on('close', () => {
        peers.delete(peer.id);
        const result = authority.disconnect(peer.id);
        const snapshot = result.broadcasts.at(-1);
        broadcast(snapshot ? { type: 'room-state', room: snapshot } : undefined, snapshot ? connectionIds(snapshot) : undefined);
        broadcastRoomLists(roomListGameIds(result));
      });
      websocket.on('error', () => {
        /* v8 ignore next -- socket error timing is platform-dependent; close handling covers peer cleanup. */
        peers.delete(peer.id);
      });
    });
  });

  function send(peer: Peer, message: ServerMessage): void {
    if (peer.socket.readyState === WebSocket.OPEN) {
      peer.socket.send(JSON.stringify(message));
    }
  }

  function connectionIds(room: {
    readonly players: readonly { readonly connectionId: ConnectionId }[];
    readonly spectators: readonly { readonly connectionId: ConnectionId }[];
  }): readonly ConnectionId[] {
    return [...room.players.map((player) => player.connectionId), ...room.spectators.map((player) => player.connectionId)];
  }

  function roomListGameIds(result: {
    readonly direct?: { readonly gameId: RoomGameId };
    readonly broadcasts: readonly { readonly gameId: RoomGameId }[];
    readonly roomClosures?: readonly { readonly gameId: RoomGameId }[];
    readonly roomList?: { readonly gameId: RoomGameId };
  }): readonly RoomGameId[] {
    return [
      ...(result.roomList ? [result.roomList.gameId] : []),
      ...(result.direct ? [result.direct.gameId] : []),
      ...result.broadcasts.map((room) => room.gameId),
      ...(result.roomClosures ?? []).map((closure) => closure.gameId),
    ];
  }

  function createInvitePath(gameId: RoomGameId, roomId: RoomId): string {
    const query = `?game=${encodeURIComponent(gameId)}&room=${encodeURIComponent(roomId)}`;
    const currentPublicBaseUrl = publicBaseUrl();
    if (!currentPublicBaseUrl) {
      return `/${query}`;
    }
    return `${currentPublicBaseUrl}/${query}`;
  }

  function serveIndex(response: ServerResponse): void {
    response.writeHead(200, responseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' }));
    response.end(injectRuntimeConfig(readFileSync(join(distRoot, 'index.html'), 'utf8')));
  }

  function injectRuntimeConfig(html: string): string {
    const currentPublicWebSocketUrl = publicWebSocketUrl();
    if (!currentPublicWebSocketUrl) {
      return html;
    }
    const meta = `<meta name="casino-realtime-url" content="${escapeAttribute(currentPublicWebSocketUrl)}" />`;
    return html.includes('</head>') ? html.replace('</head>', `    ${meta}\n  </head>`) : `${meta}\n${html}`;
  }

  function escapeAttribute(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function webSocketUrl(baseUrl: string): string {
    return `${baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws`;
  }

  function textPayload(data: RawData): string {
    if (Array.isArray(data)) {
      return Buffer.concat(data).toString('utf8');
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(new Uint8Array(data)).toString('utf8');
    }
    return data.toString('utf8');
  }

  function rejectUpgrade(socket: Duplex, statusCode: number, reason: string): void {
    socket.end(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  function staticPath(request: IncomingMessage, distRoot: string): string | undefined {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(distRoot, pathname);
    return filePath.startsWith(distRoot) ? filePath : undefined;
  }

  function shouldServeAppFallback(request: IncomingMessage, filePath: string | undefined): boolean {
    return Boolean(filePath) && acceptsHtml(request) && !isFileLikeOrSuspiciousRequest(request);
  }

  function isIndexHtml(filePath: string): boolean {
    return normalize(filePath) === normalize(join(distRoot, 'index.html'));
  }

  function acceptsHtml(request: IncomingMessage): boolean {
    const acceptHeader = request.headers.accept;
    if (!acceptHeader) {
      return true;
    }

    return acceptHeader.split(',').some((entry) => {
      const [mediaType, ...parameters] = entry.split(';').map((part) => part.trim().toLowerCase());
      const qValue = parameters.find((parameter) => parameter.startsWith('q='));
      if (qValue && Number(qValue.slice(2)) === 0) {
        return false;
      }

      return mediaType === 'text/html' || mediaType === 'application/xhtml+xml' || mediaType === 'text/*' || mediaType === '*/*';
    });
  }

  function isFileLikeOrSuspiciousRequest(request: IncomingMessage): boolean {
    const decodedPathname = decodedPath(rawRequestPath(request));
    if (!decodedPathname || decodedPathname.includes('\\') || decodedPathname.includes('\0') || decodedPathname.split('/').includes('..')) {
      return true;
    }

    return decodedPathname.split('/').some((segment) => extname(segment) !== '');
  }

  function rawRequestPath(request: IncomingMessage): string {
    const rawUrl = request.url ?? '/';
    const pathEnd = rawUrl.search(/[?#]/);
    const path = pathEnd === -1 ? rawUrl : rawUrl.slice(0, pathEnd);
    return path || '/';
  }

  function decodedPath(pathname: string): string | undefined {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return undefined;
    }
  }

  function contentType(filePath: string): string {
    return (
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }[extname(filePath)] ?? 'application/octet-stream'
    );
  }

  function applySecurityHeaders(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    securityHeaders(request, response, (error) => {
      if (error) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: false, error: 'security_headers_failed' }));
        return;
      }
      next();
    });
  }

  function responseHeaders(headers: Record<string, string>): Record<string, string> {
    return { 'permissions-policy': permissionsPolicy, ...headers };
  }

  function cacheHeaders(filePath: string): Record<string, string> {
    const headers = { 'content-type': contentType(filePath) };
    if (extname(filePath) === '.html') {
      return responseHeaders({ ...headers, 'cache-control': 'no-store' });
    }
    return responseHeaders(headers);
  }

  return Object.assign(server, {
    closePeers: () => {
      for (const peer of peers.values()) {
        peer.socket.terminate();
      }
      peers.clear();
    },
  });
};
