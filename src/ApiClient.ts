import axios, { AxiosResponse, AxiosError, GenericAbortSignal, AxiosInstance } from 'axios';
import {
  AxiosClientContructor,
  CustomConfig,
  IListener,
  RequestObserverOptions,
  AxiosClientInterceptors,
} from './types';

const BASE_OBSERVER_OPTIONS: RequestObserverOptions = {
  refreshHandler: () => Promise.resolve(),
  combineAbortSignals: false,
  statusCodes: [401],
  retryCount: 1,
};

const BASE_AXIOS_CONSTRUCTOR: AxiosClientContructor = {
  interceptors: {
    request: {
      onFulfilled: (response) => response,
      onRejected: (error) => error,
    },
    response: {
      onFulfilled: (response) => response,
      onRejected: (error) => error,
    },
  },
};

export class RequestObserver {
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
      await this.baseOptions.refreshHandler();
      return this.notify();
    } catch (e) {
      console.error('Can not notify the suspended queue due to error in refreshHandler', e);
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
    const isCancelFromReqObserver = axios.isCancel(error) && this.isSuspended;

    const shouldRefresh = this.baseOptions.shouldRefresh
      ? this.baseOptions.shouldRefresh(error)
      : this.baseOptions.statusCodes?.includes(resError?.status);

    if (config?._retryCount >= this.baseOptions.retryCount)
      return Promise.reject(
        `Observer refresh token success, but retrying still failed after ${config._retryCount} time(s).`
      );

    if (shouldRefresh || isCancelFromReqObserver) {
      config._retryCount += 1;

      return api(config);
    }

    return error;
  };
}

class AxiosClient {
  private readonly api: AxiosInstance;
  private readonly mergedInterceptors: AxiosClientInterceptors;
  private readonly observer: RequestObserver;

  constructor(
    config: AxiosClientContructor,
    interceptors: AxiosClientInterceptors,
    observer: RequestObserver
  ) {
    this.observer = observer;
    const { interceptors: _interceptors, ...restConfig } = config || {};

    this.api = axios.create({
      ...restConfig,
    });

    this.mergedInterceptors = {
      ...interceptors,
      ...(_interceptors || {}),
    };

    this.api.interceptors.request.use(this.onReqFulfilled, this.onReqRejected);
    this.api.interceptors.response.use(this.onResFulfilled, this.onResRejected);
  }

  private onReqFulfilled = async (axiosConfig: CustomConfig) => {
    const newConfig = await this.observer.baseRequestIntercept(axiosConfig);

    return this.mergedInterceptors?.request?.onFulfilled
      ? this.mergedInterceptors?.request?.onFulfilled(newConfig)
      : newConfig;
  };

  private onReqRejected = (error: AxiosError) => {
    return this.mergedInterceptors?.request?.onRejected
      ? this.mergedInterceptors?.request?.onRejected(error)
      : Promise.reject(error);
  };

  private onResFulfilled = (response: AxiosResponse) => {
    return this.mergedInterceptors?.response?.onFulfilled
      ? this.mergedInterceptors?.response?.onFulfilled(response)
      : response;
  };

  private onResRejected = async (error: AxiosError) => {
    const newError = await this.observer.baseResponseIntercept(error, this.api);

    // Check if newError is AxiosError
    if (!axios.isAxiosError(newError)) return newError;

    return this.mergedInterceptors?.response?.onRejected
      ? this.mergedInterceptors.response.onRejected(newError as any)
      : newError;
  };

  get instance() {
    return this.api;
  }
}

class AxiosInstanceFactory {
  private static observer: RequestObserver;
  private static internalInterceptor: AxiosClientInterceptors = BASE_AXIOS_CONSTRUCTOR.interceptors;

  private constructor() {
    throw new Error('This class cannot be instantiated');
  }

  private static useInterceptorReq = (
    onFulfilled: (config: CustomConfig) => CustomConfig,
    onRejected?: (error: AxiosError) => any
  ) => {
    this.internalInterceptor.request.onFulfilled = onFulfilled;
    if (onRejected) {
      this.internalInterceptor.request.onRejected = onRejected;
    }
  };

  private static useInterceptorRes = (
    onFulfilled: (response: AxiosResponse) => AxiosResponse,
    onRejected?: (error: AxiosError) => any
  ) => {
    this.internalInterceptor.response.onFulfilled = onFulfilled;
    if (onRejected) {
      this.internalInterceptor.response.onRejected = onRejected;
    }
  };

  static interceptor = {
    request: {
      use: this.useInterceptorReq,
    },
    response: {
      use: this.useInterceptorRes,
    },
  };

  static use(config: RequestObserverOptions) {
    if (!this.observer) {
      this.observer = new RequestObserver(config);
    }
  }

  static getInstance(config: AxiosClientContructor) {
    if (!this.observer) {
      throw new Error('RequestObserver is not registered!');
    }

    return new AxiosClient(config, this.internalInterceptor, this.observer).instance;
  }
}

export default AxiosInstanceFactory;
