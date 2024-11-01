import { RequestObserver } from './ApiClient';

describe('RequestObserver', () => {
  let requestObserver: RequestObserver;

  beforeEach(() => {
    requestObserver = new RequestObserver({
      refreshHandler: jest.fn().mockResolvedValue('newToken'),
      combineAbortSignals: true,
      statusCodes: [401],
      retryCount: 1,
    });
  });

  test('combineSignals should combine signals when combineAbortSignals is true', () => {
    const axiosSignal = new AbortController().signal;
    const combinedSignal = requestObserver['combineSignals'](axiosSignal);
    expect(combinedSignal).toBeInstanceOf(AbortSignal);
  });

  test('combineSignals should return observer signal when combineAbortSignals is false', () => {
    requestObserver = new RequestObserver({
      refreshHandler: jest.fn().mockResolvedValue('newToken'),
      combineAbortSignals: false,
      statusCodes: [401],
      retryCount: 1,
    });
    const axiosSignal = new AbortController().signal;
    const combinedSignal = requestObserver['combineSignals'](axiosSignal);
    expect(combinedSignal).toBe(requestObserver['abortController'].signal);
  });

  test('subscribe should add a listener to the suspendedQueue', async () => {
    requestObserver['subscribe']();
    expect(requestObserver['suspendedQueue'].size).toBe(1);
  });

  test('notify should notify all listeners and clear the suspendedQueue', () => {
    const listener = jest.fn();
    requestObserver['suspendedQueue'].add(listener);
    requestObserver['notify']();
    expect(listener).toHaveBeenCalled();
    expect(requestObserver['suspendedQueue'].size).toBe(0);
  });

  test('exchangeToken should refresh token and notify listeners', async () => {
    const listener = jest.fn();
    requestObserver['suspendedQueue'].add(listener);
    await requestObserver['exchangeToken']();
    expect(listener).toHaveBeenCalled();
    expect(requestObserver['suspendedQueue'].size).toBe(0);
  });

  test('baseRequestIntercept should intercept request and combine signals', async () => {
    const config: any = { _retryCount: 0, signal: new AbortController().signal };
    const newConfig = await requestObserver.baseRequestIntercept(config);
    expect(newConfig.signal).toBeInstanceOf(AbortSignal);
  });
});
