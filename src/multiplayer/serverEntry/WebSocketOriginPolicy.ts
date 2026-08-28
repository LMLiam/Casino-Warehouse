import type { IncomingMessage } from 'node:http';

export class WebSocketOriginPolicy {
  private static readonly maxIpv4Octet = 255;
  private static readonly privateClassAFirstOctet = 10;
  private static readonly privateClassBFirstOctet = 172;
  private static readonly privateClassBSecondOctetMin = 16;
  private static readonly privateClassBSecondOctetMax = 31;
  private static readonly privateClassCFirstOctet = 192;
  private static readonly privateClassCSecondOctet = 168;
  private static readonly linkLocalFirstOctet = 169;
  private static readonly linkLocalSecondOctet = 254;

  public static allows(request: IncomingMessage, publicBaseUrl: string): boolean {
    const origin = this.requestOrigin(request);
    if (!origin) {
      return false;
    }

    const publicOrigin = this.normalizedOrigin(publicBaseUrl);
    if (publicOrigin && origin === publicOrigin) {
      return true;
    }

    return this.allowsLocalDevelopmentOrigin(origin, request.headers.host);
  }

  private static requestOrigin(request: IncomingMessage): string | undefined {
    const header = request.headers.origin;
    if (!header || Array.isArray(header)) {
      return undefined;
    }
    return this.normalizedOrigin(header);
  }

  private static normalizedOrigin(value: string): string | undefined {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return undefined;
      }
      return url.origin;
    } catch {
      return undefined;
    }
  }

  private static allowsLocalDevelopmentOrigin(origin: string, requestHost: string | undefined): boolean {
    const originUrl = new URL(origin);
    const requestHostname = this.hostnameFromHost(requestHost);
    if (!requestHostname) {
      return false;
    }
    const originScope = this.localDevelopmentScope(originUrl.hostname);
    const requestScope = this.localDevelopmentScope(requestHostname);
    if (!originScope || !requestScope) {
      return false;
    }
    if (originScope === 'loopback' && requestScope === 'loopback') {
      return true;
    }
    return originUrl.hostname.toLowerCase() === requestHostname.toLowerCase();
  }

  private static hostnameFromHost(host: string | undefined): string | undefined {
    if (!host) {
      return undefined;
    }
    try {
      return new URL(`http://${host}`).hostname;
    } catch {
      return undefined;
    }
  }

  private static localDevelopmentScope(hostname: string): 'loopback' | 'private-network' | undefined {
    const normalized = hostname.toLowerCase();
    if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '[::1]' || normalized === '::1') {
      return 'loopback';
    }

    if (normalized.startsWith('127.')) {
      return 'loopback';
    }

    if (normalized === '0.0.0.0') {
      return 'private-network';
    }

    const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) {
      return undefined;
    }

    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > WebSocketOriginPolicy.maxIpv4Octet)) {
      return undefined;
    }

    const [first, second] = octets;
    if (first === undefined || second === undefined) {
      return undefined;
    }
    if (
      first === WebSocketOriginPolicy.privateClassAFirstOctet ||
      (first === WebSocketOriginPolicy.privateClassBFirstOctet &&
        second >= WebSocketOriginPolicy.privateClassBSecondOctetMin &&
        second <= WebSocketOriginPolicy.privateClassBSecondOctetMax) ||
      (first === WebSocketOriginPolicy.privateClassCFirstOctet && second === WebSocketOriginPolicy.privateClassCSecondOctet) ||
      (first === WebSocketOriginPolicy.linkLocalFirstOctet && second === WebSocketOriginPolicy.linkLocalSecondOctet)
    ) {
      return 'private-network';
    }
    return undefined;
  }
}
