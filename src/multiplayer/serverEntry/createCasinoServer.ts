import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData } from 'ws';
import { authTokenSchema } from '../../schemas/casinoSchemas/authTokenSchema';
import { connectionIdSchema } from '../../schemas/casinoSchemas/connectionIdSchema';
import { serverInstanceIdSchema } from '../../schemas/casinoSchemas/serverInstanceIdSchema';
import { createDefaultServerDataStore } from '../../state/serverDataStore/createDefaultServerDataStore';
import { RoomAuthority } from '../roomAuthority';
import type { CasinoServer } from './CasinoServer';
import type { CasinoServerOptions } from './CasinoServerOptions';
import { createCasinoHttpHandler } from './createCasinoHttpHandler';
import { CasinoServerMessageHandler } from './CasinoServerMessageHandler';
import { CasinoServerState } from './CasinoServerState';
import type { Peer } from './Peer';
import { WebSocketOriginPolicy } from './WebSocketOriginPolicy';

export const createCasinoServer = (options: CasinoServerOptions = {}): CasinoServer => {
  const closeUnsupportedData = 1003;
  const maxClientMessageBytes = 64 * 1024;
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
  const state = new CasinoServerState(authority, dataStore, publicBaseUrl);
  const messageHandler = new CasinoServerMessageHandler(state, authority, dataStore, adminToken);
  const websocketServer = new WebSocketServer({ clientTracking: false, maxPayload: maxClientMessageBytes, noServer: true, perMessageDeflate: false });
  const server = createServer(createCasinoHttpHandler(distRoot, publicWebSocketUrl));

  authority.setAsyncResultHandler?.((result) => {
    const peer = state.peers.values().next().value;
    if (peer) {
      state.emitAuthorityResult(peer, result);
    }
  });

  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const peer of [...state.peers.values()]) {
      if (now - peer.lastPongAt > heartbeatTimeoutMs) {
        peer.socket.terminate();
        state.peers.delete(peer.id);
        const result = authority.disconnect(peer.id);
        const snapshot = result.broadcasts.at(-1);
        state.broadcast(snapshot ? { type: 'room-state', room: snapshot } : undefined, snapshot ? state.connectionIds(snapshot) : undefined);
        state.broadcastRoomLists(state.roomListGameIds(result));
        continue;
      }
      state.send(peer, { type: 'heartbeat', sentAt: now });
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
        state.send(peer, {
          type: 'reload-required',
          reason: 'server-restarted',
          message: 'The game server restarted. Reload the app to use the latest client.',
        });
        websocket.close();
        return;
      }

      state.peers.set(peer.id, peer);
      state.send(peer, { type: 'server-hello', serverInstanceId });
      state.send(peer, { type: 'error', code: 'connected', message: 'Connected to Casino Warehouse game server.' });
      state.sendDataState(peer);

      websocket.on('message', (data, isBinary) => {
        if (isBinary || Array.isArray(data)) {
          websocket.close(closeUnsupportedData, 'Only text JSON messages are supported.');
          return;
        }
        messageHandler.handle(peer, textPayload(data));
      });
      websocket.on('pong', () => {
        peer.lastPongAt = Date.now();
      });
      websocket.on('close', () => {
        state.peers.delete(peer.id);
        const result = authority.disconnect(peer.id);
        const snapshot = result.broadcasts.at(-1);
        state.broadcast(snapshot ? { type: 'room-state', room: snapshot } : undefined, snapshot ? state.connectionIds(snapshot) : undefined);
        state.broadcastRoomLists(state.roomListGameIds(result));
      });
      websocket.on('error', () => {
        /* v8 ignore next -- socket error timing is platform-dependent; close handling covers peer cleanup. */
        state.peers.delete(peer.id);
      });
    });
  });

  return Object.assign(server, {
    closePeers: () => {
      for (const peer of state.peers.values()) {
        peer.socket.terminate();
      }
      state.peers.clear();
    },
  });

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
};
