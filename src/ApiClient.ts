import axios, { AxiosResponse, AxiosError, GenericAbortSignal, AxiosInstance } from 'axios';
import {
  AxiosClientContructor,
  CustomConfig,
  IListener,
  RequestObserverOptions,
  AxiosClientInterceptors,
} from './types';

let requestObserverInstance: RequestObserver;
const BASE_OBSERVER_OPTIONS: RequestObserverOptions = {
  refreshHandler: () => Promise.resolve(''),
  combineAbortSignals: false,
  statusCodes: [401],
  retryCount: 1,
};
const BASE_AXIOS_CONTRUCTOR: AxiosClientContructor = {
  axiosConfig: {},
  interceptor: {
    request: {
      onFulfilled: (response) => response,
      onRejected: (error) => error,
    },
    response: {
      onFulfilled: (response) => response.data,
      onRejected: (error) => error,
    },
  },
};

const registerRequestObserver = (options: RequestObserverOptions) => {
  if (requestObserverInstance)
    console.error(
      'RequestObserver is already registered, register another one will overide the current one.'
    );

  requestObserverInstance = new RequestObserver(options);
};

class RequestObserver {
  private readonly suspendedQueue: Set<IListener>;
  private readonly baseOptions: RequestObserverOptions;
  private abortController: AbortController;
  private isSuspended: boolean;

  constructor(options: RequestObserverOptions) {
    this.suspendedQueue = new Set<IListener>();
    // Override default options with user options
    this.baseOptions = { ...BASE_OBSERVER_OPTIONS, ...options };
    this.abortController = new AbortController();
    this.isSuspended = false;
  }

  // Combine signal from component signal and observer signal into one
  private combineSignals = (axiosSignal?: GenericAbortSignal): AbortSignal => {
    const observerSignal = this.abortController.signal;
    if (!axiosSignal || !this?.baseOptions?.combineAbortSignals) return observerSignal;

    const combinedController = new AbortController();

    const abortHandler = () => combinedController.abort();

    observerSignal.onabort = abortHandler;
    axiosSignal.onabort = abortHandler;

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
  public baseRequestIntercept = async (config: CustomConfig) => {
    // Init retry count = 0 if not exist
    if (!config?._retryCount) config._retryCount = 0;
    if (config?._retryCount > 0 || this.isSuspended) await this.exchangeToken();

    config.signal = this.combineSignals(config.signal);
    return config;
  };

  public baseResponseIntercept = async (error: AxiosError, api: AxiosInstance) => {
    const config: CustomConfig = error?.config;
    const resError = error?.response;
    const isCancelNotFromUser = axios.isCancel(error) && this.isSuspended;

    if (config?._retryCount >= this.baseOptions.retryCount)
      return Promise.reject(
        `Observer refresh token success, but retrying still failed after ${config._retryCount} time(s).`
      );

    if (this.baseOptions.statusCodes?.includes(resError?.status) || isCancelNotFromUser) {
      config._retryCount += 1;

      return api(config);
    }

    return error;
  };
}

class AxiosClient {
  private readonly api: AxiosInstance;
  private readonly interceptor: AxiosClientInterceptors;

  constructor(config: AxiosClientContructor = BASE_AXIOS_CONTRUCTOR) {
    if (!requestObserverInstance)
      throw new Error(
        'RequestObserver is not registered!, please register it first with registerRequestObserver'
      );

    const { axiosConfig, interceptor } = config;
    this.interceptor = interceptor;

    this.api = axios.create({
      ...axiosConfig,
    });

    this.api.interceptors.request.use(this.onReqFullfilled, this.onReqRejected);
    this.api.interceptors.response.use(this.onResFullfilled, this.onResRejected);
  }

  private onReqFullfilled = async (axiosConfig: CustomConfig) => {
    const newConfig = await requestObserverInstance.baseRequestIntercept(axiosConfig);

    return this.interceptor?.request?.onFulfilled
      ? this.interceptor?.request?.onFulfilled(newConfig)
      : newConfig;
  };

  private onReqRejected = (error: AxiosError) => {
    return this.interceptor?.request?.onRejected
      ? this.interceptor?.request?.onRejected(error)
      : Promise.reject(error);
  };

  private onResFullfilled = (response: AxiosResponse) => {
    return this.interceptor?.response?.onFulfilled
      ? this.interceptor?.response?.onFulfilled(response)
      : response;
  };

  private onResRejected = async (error: AxiosError) => {
    const newError = await requestObserverInstance.baseResponseIntercept(error, this.api);

    return this.interceptor?.response?.onRejected
      ? this.interceptor.response.onRejected(newError as any)
      : newError;
  };

  get instance() {
    return this.api;
  }
}

export { AxiosClient, registerRequestObserver };
