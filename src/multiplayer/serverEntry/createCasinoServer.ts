import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import helmet, { type HelmetOptions } from 'helmet';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { RoomAuthority } from '../roomAuthority';
import type { ClientMessage } from '../protocol/ClientMessage';
import { parseClientMessage } from '../protocol/parseClientMessage';
import { protocolVersion } from '../protocol/protocolVersion';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { ServerMessage } from '../protocol/ServerMessage';
import { createSessionState } from '../../state/session/createSessionState';
import { createDefaultServerDataStore } from '../../state/serverDataStore/createDefaultServerDataStore';
import { profileTokenAuth } from '../../state/serverDataStore/profileTokenAuth';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';
import type { CasinoServer } from './CasinoServer';
import type { CasinoServerOptions } from './CasinoServerOptions';
import type { Peer } from './Peer';

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
  const adminToken = options.adminToken ?? process.env.CASINO_ADMIN_TOKEN ?? '';
  const serverInstanceId = options.serverInstanceId ?? randomUUID();
  const peers = new Map<string, Peer>();
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
        response.writeHead(200, responseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' }));
        response.end(readFileSync(join(distRoot, 'index.html')));
        return;
      }

      response.writeHead(200, cacheHeaders(filePath));
      response.end(readFileSync(filePath));
    });
  });

  const broadcast = (message: ServerMessage | undefined, recipients?: readonly string[]): void => {
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
        broadcast({ version: protocolVersion, type: 'room-list', gameId, rooms: authority.listRoomSummaries(gameId) }, recipients);
      }
    }
  };

  const sendDataState = (peer: Peer): void => {
    const snapshot = dataStore.snapshot();
    send(peer, { version: protocolVersion, type: 'data-state', database: snapshot.database, profileState: snapshot.profileState, session: snapshot.session });
  };

  const sendProfileAccess = (peer: Peer): void => {
    send(peer, { version: protocolVersion, type: 'profile-access', ownedProfileIds: [...peer.ownedProfileIds] });
  };

  const sendAdminAccess = (peer: Peer): void => {
    send(peer, { version: protocolVersion, type: 'admin-access', authorized: peer.isAdmin });
  };

  const broadcastDataState = (): void => {
    for (const peer of peers.values()) {
      sendDataState(peer);
    }
  };

  const emitAuthorityResult = (peer: Peer, result: ReturnType<CasinoRoomAuthority['handle']>, options: { readonly forceDataState?: boolean } = {}): void => {
    if (result.error) {
      send(peer, { version: protocolVersion, type: 'error', code: 'rejected', message: result.error });
    }
    if (result.roomList) {
      send(peer, { version: protocolVersion, type: 'room-list', gameId: result.roomList.gameId, rooms: result.roomList.rooms });
    }
    if (result.direct) {
      send(peer, {
        version: protocolVersion,
        type: 'room-created',
        room: result.direct,
        invitePath: createInvitePath(result.direct.gameId, result.direct.roomId),
      });
    }
    for (const closure of result.roomClosures ?? []) {
      broadcast(
        { version: protocolVersion, type: 'room-closed', roomId: closure.roomId, gameId: closure.gameId, reason: closure.reason },
        closure.connectionIds,
      );
    }
    const broadcastRecipients = new Map((result.broadcastRecipients ?? []).map((entry) => [entry.roomId, entry.connectionIds]));
    for (const snapshot of result.broadcasts) {
      broadcast({ version: protocolVersion, type: 'room-state', room: snapshot }, broadcastRecipients.get(snapshot.roomId) ?? connectionIds(snapshot));
    }
    broadcastRoomLists(roomListGameIds(result));
    if (result.settlements.length > 0) {
      const room = result.broadcasts.at(-1);
      if (room) {
        broadcast(
          { version: protocolVersion, type: 'settlement', roomId: room.roomId, sessionId: room.sessionId, settlements: result.settlements },
          connectionIds(room),
        );
      }
    }
    if (options.forceDataState || result.broadcasts.length > 0 || result.settlements.length > 0 || (result.roomClosures?.length ?? 0) > 0) {
      broadcastDataState();
    }
  };

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
          peer.isAdmin = adminToken.length > 0 && profileTokenAuth.safeSecretEqual(adminToken, message.adminToken);
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
        case 'save-session':
          requireKnownProfiles(profileIdsInSession(message.session));
          requireOwnedProfiles(peer, profileIdsInSession(message.session));
          dataStore.saveSession(createSessionState(message.session.profileIds, message.session));
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
      send(peer, { version: protocolVersion, type: 'error', code: 'rejected', message: error instanceof Error ? error.message : 'Server data action failed.' });
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
    send(peer, { version: protocolVersion, type: 'profile-credentials', profileId: profile.id, profileToken });
    sendProfileAccess(peer);
  };

  const authorizeProfiles = (
    peer: Peer,
    profileTokens: readonly {
      readonly profileId: string;
      readonly profileToken: string;
    }[],
  ): void => {
    peer.ownedProfileIds.clear();
    for (const { profileId, profileToken } of profileTokens) {
      if (isProfileTokenValid(profileId, profileToken)) {
        peer.ownedProfileIds.add(profileId);
      }
    }
  };

  const requireOwnedProfile = (peer: Peer, profileId: string) => {
    const profile = requireProfile(profileId);
    if (!peer.ownedProfileIds.has(profileId)) {
      throw new Error('This browser is not authorized to use that profile.');
    }
    return profile;
  };

  const requireOwnedProfiles = (peer: Peer, profileIds: readonly string[]): void => {
    for (const profileId of profileIds) {
      requireOwnedProfile(peer, profileId);
    }
  };

  const requireAdmin = (peer: Peer): void => {
    if (!peer.isAdmin) {
      throw new Error('Admin controls are locked for this browser.');
    }
  };

  const isProfileTokenValid = (profileId: string, profileToken: string): boolean => {
    const expectedHash = dataStore.profileTokenHash(profileId);
    return Boolean(expectedHash) && profileTokenAuth.matches(profileId, profileToken, expectedHash ?? '');
  };

  const applyAdminBankroll = (profileId: string, action: 'add' | 'subtract' | 'reset', amount: number): void => {
    const profile = requireProfile(profileId);
    const delta =
      action === 'add'
        ? Math.max(0, Math.floor(amount))
        : action === 'subtract'
          ? -Math.min(profile.bankroll, Math.max(0, Math.floor(amount)))
          : 1000 - profile.bankroll;
    if (delta !== 0) {
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
      if (delta !== 0) {
        dataStore.recordTransaction(profile.id, { gameId: 'admin', type: 'reset', amount: delta, description: 'Admin reset all profiles', metadata: {} });
      }
    }
  };

  const requireProfile = (profileId: string) => {
    const profile = dataStore.snapshot().profileState.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error('Profile was not found.');
    }
    return profile;
  };

  const requireKnownProfiles = (profileIds: readonly string[]): void => {
    const knownIds = new Set(dataStore.snapshot().profileState.profiles.map((profile) => profile.id));
    if (profileIds.some((profileId) => !knownIds.has(profileId))) {
      throw new Error('Session includes an unknown server profile.');
    }
  };

  const profileIdsInSession = (session: Extract<ClientMessage, { type: 'save-session' }>['session']): readonly string[] => [
    ...new Set([...session.profileIds, ...Object.keys(session.gameSnapshots)]),
  ];

  const useServerProfile = (peer: Peer, message: ClientMessage): ClientMessage => {
    if (message.type !== 'create-room' && message.type !== 'join-room') {
      return message;
    }
    const profile = requireOwnedProfile(peer, message.profileId);
    return { ...message, profileName: profile.name, bankroll: profile.bankroll };
  };

  const handlePayload = (peer: Peer, payload: string): void => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(payload);
    } catch {
      send(peer, { version: protocolVersion, type: 'error', code: 'bad-json', message: 'Message was not valid JSON.' });
      return;
    }

    const parsed = parseClientMessage(parsedJson);
    if (!parsed.ok || !parsed.message) {
      send(peer, { version: protocolVersion, type: 'error', code: 'bad-message', message: parsed.error ?? 'Message was invalid.' });
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
        version: protocolVersion,
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
        broadcast(snapshot ? { version: protocolVersion, type: 'room-state', room: snapshot } : undefined, snapshot ? connectionIds(snapshot) : undefined);
        broadcastRoomLists(roomListGameIds(result));
        continue;
      }
      send(peer, { version: protocolVersion, type: 'heartbeat', sentAt: now });
    }
  }, heartbeatIntervalMs);
  server.on('close', () => {
    clearInterval(heartbeat);
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

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const peer: Peer = { id: randomUUID(), socket: websocket, ownedProfileIds: new Set(), lastPongAt: Date.now(), isAdmin: false };
      const clientServerInstanceId = requestUrl.searchParams.get('clientServerInstanceId');
      if (clientServerInstanceId && clientServerInstanceId !== serverInstanceId) {
        send(peer, {
          version: protocolVersion,
          type: 'reload-required',
          reason: 'server-restarted',
          message: 'The game server restarted. Reload the app to use the latest client.',
        });
        websocket.close();
        return;
      }

      peers.set(peer.id, peer);
      send(peer, { version: protocolVersion, type: 'server-hello', serverInstanceId });
      send(peer, { version: protocolVersion, type: 'error', code: 'connected', message: 'Connected to Casino Warehouse game server.' });
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
        broadcast(snapshot ? { version: protocolVersion, type: 'room-state', room: snapshot } : undefined, snapshot ? connectionIds(snapshot) : undefined);
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
    readonly players: readonly { readonly connectionId: string }[];
    readonly spectators: readonly { readonly connectionId: string }[];
  }): readonly string[] {
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

  function createInvitePath(gameId: string, roomId: string): string {
    const publicBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
    const query = `?game=${encodeURIComponent(gameId)}&room=${encodeURIComponent(roomId)}`;
    if (!publicBaseUrl) {
      return `/${query}`;
    }
    return `${publicBaseUrl}/${query}&server=${encodeURIComponent(publicBaseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws')}`;
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

  function staticPath(request: IncomingMessage, distRoot: string): string | undefined {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(distRoot, pathname);
    return filePath.startsWith(distRoot) ? filePath : undefined;
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
