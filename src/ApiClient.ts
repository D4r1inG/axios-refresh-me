import axios, { AxiosResponse, AxiosInstance, AxiosError, GenericAbortSignal } from 'axios';
import { AxiosClientContructor, CustomConfig, IListener, RequestObserverOptions } from './types';

let requestObserverInstance: RequestObserver;
const BASE_OBSERVER_OPTIONS: RequestObserverOptions = {
  refreshHandler: () => Promise.resolve(''),
  combineAbortSignals: false,
  statusCodes: [401],
};

const registerRequestObserver = (options: RequestObserverOptions) => {
  if (!requestObserverInstance) requestObserverInstance = new RequestObserver(options);
  return requestObserverInstance;
};

class RequestObserver {
  private readonly suspendedQueue: Set<IListener>;
  private readonly baseOptions: RequestObserverOptions;
  private abortController: AbortController;
  private isSuspended: boolean = false;

  constructor(options: RequestObserverOptions) {
    this.suspendedQueue = new Set<IListener>();
    this.baseOptions = { ...BASE_OBSERVER_OPTIONS, ...options };
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
  private getReqSignal = async ({ _retry, signal }: CustomConfig): Promise<AbortSignal> => {
    if (_retry || this.isSuspended) await this.exchangeToken();
    return this.combineSignals(signal);
  };

  public baseReqIntercept = async (config: CustomConfig) => {
    config.signal = await this.getReqSignal(config);
    return config;
  };

  public baseResIntercept = async (error: AxiosError, api: AxiosInstance) => {
    const config: CustomConfig = error?.config;
    const resError = error?.response;
    const isCancelNotFromUser = axios.isCancel(error) && this.isSuspended;

    if (config?._retry) return Promise.reject('Observer refresh token success, but retrying still failed!');

    if (this.baseOptions.statusCodes?.includes(resError?.status) || isCancelNotFromUser) {
      config._retry = true;

      return api(config);
    }

    return error;
  };
}

class AxiosClient {
  private readonly api: AxiosInstance;
  private readonly observer: RequestObserver;

  constructor(config: AxiosClientContructor = {}) {
    if (!requestObserverInstance) throw new Error('RequestObserver is not registered!');

    this.observer = requestObserverInstance;
    const { axiosConfig = {}, interceptor = {} } = config;

    this.api = axios.create({
      ...axiosConfig,
    });

    this.api.interceptors.request.use(
      async (axiosConfig) => {
        const newConfig = await this.observer.baseReqIntercept(axiosConfig);
        return interceptor?.request ? interceptor.request(newConfig) : newConfig;
      },
      (error) => Promise.reject(error)
    );
    this.api.interceptors.response.use(
      interceptor?.response?.onFulfilled || ((response: AxiosResponse) => response),
      async (error: AxiosError) => {
        const newError = await this.observer.baseResIntercept(error, this.api);
        return interceptor?.response?.onRejected ? interceptor.response.onRejected(newError) : newError;
      }
    );
  }

  get instance() {
    return this.api;
  }
}

export { AxiosClient, registerRequestObserver };
