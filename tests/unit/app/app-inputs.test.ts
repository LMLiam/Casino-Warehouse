import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteServerUrl } from '../../../src/app/input/appInputs/inviteServerUrl';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('app input readers', () => {
  it('accepts only ws and wss invite server URLs', () => {
    setLocation('?server=wss%3A%2F%2Fcasino.example%2Fws', 'https:', 'casino.example');

    expect(inviteServerUrl()).toEqual({ invalid: false, url: 'wss://casino.example/ws' });

    setLocation('?ws=ws%3A%2F%2Fcasino.example%2Fws', 'http:', 'casino.example');

    expect(inviteServerUrl()).toEqual({ invalid: false, url: 'ws://casino.example/ws' });
  });

  it('flags malformed and unsupported invite server URLs', () => {
    setLocation('?server=not-a-url');

    expect(inviteServerUrl()).toEqual({ invalid: true, url: undefined });

    setLocation('?ws=https%3A%2F%2Fcasino.example%2Fws');

    expect(inviteServerUrl()).toEqual({ invalid: true, url: undefined });

    setLocation('?server=wss%3A%2F%2Fcasino.example%2Fws%23fragment', 'https:', 'casino.example');

    expect(inviteServerUrl()).toEqual({ invalid: true, url: undefined });

    setLocation('?server=wss%3A%2F%2Fother.example%2Fws', 'https:', 'casino.example');

    expect(inviteServerUrl()).toEqual({ invalid: true, url: undefined });

    setLocation('?room=ROOM42');

    expect(inviteServerUrl()).toEqual({ invalid: false, url: undefined });
  });
});

const setLocation = (search: string, protocol = 'https:', host = 'casino.example'): void => {
  vi.stubGlobal('window', { location: { host, protocol, search } });
};
