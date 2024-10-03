import { GenericAbortSignal } from 'axios';
import { CustomConfig, IListener, RequestObserverOptions } from './types';

class RequestObserver {
  private readonly suspendedQueue: Set<IListener>;
  private readonly baseOptions: RequestObserverOptions;
  private abortController: AbortController;
  private isSuspended: boolean = false;

  constructor(options: RequestObserverOptions) {
    this.suspendedQueue = new Set<IListener>();
    this.baseOptions = options;
    this.abortController = new AbortController();
  }

  // Combine signal from component signal and observer signal into one
  private combineSignals = (aixosSignal?: GenericAbortSignal): AbortSignal => {
    const observerSignal = this.abortController.signal;
    if (!aixosSignal || !this?.baseOptions?.combineAbortSignals) return observerSignal;

    const combinedController = new AbortController();

    const abortHandler = () => combinedController.abort();

    observerSignal.onabort = abortHandler;
    aixosSignal.onabort = abortHandler;

    return combinedController.signal;
  };

  private subscribe = () => new Promise((resolve) => this.suspendedQueue.add(resolve));

  // Notify all listeners that the token has been updated and clear the suspendedQueue
  private notify = () => {
    this.abortController = new AbortController();

    this.suspendedQueue.forEach((l) => l());
    this.suspendedQueue.clear();

    this.isSuspended = false;
  };

  // Exchange the refresh token for a new access token, cancel all pending requests and then notify all listeners
  // the canceled one will be re-executed with the new token when the token is updated
  private exchangeToken = async () => {
    if (this.isSuspended) return this.subscribe();

    this.isSuspended = true;
    this.abortController.abort();

    try {
      const token = await this.baseOptions.refreshHandler();
      if (token) return this.notify();
    } catch (e) {
      console.error(e);
    }
  };

  // If the request is marked as retry, it will refresh the token
  // If the observer is suspended, it will subscribe to the suspendQueue
  // If the request has an existed signal, it will combine with the observer signal
  // Finally return the signal to axios interceptor request,
  public getReqSignal = async ({ _retry, signal }: CustomConfig): Promise<AbortSignal> => {
    if (_retry || this.isSuspended) await this.exchangeToken();
    return this.combineSignals(signal);
  };

  public getSuspendedStatus = () => this.isSuspended;
}

export default RequestObserver;
