import { AxiosError, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from 'axios';

export type IListener = (value?: unknown) => void;
export type CustomConfig = InternalAxiosRequestConfig & {
  _retryCount?: number;
};

export type RequestObserverOptions = {
  refreshHandler: () => Promise<string>;
  combineAbortSignals?: boolean;
  statusCodes?: number[];
  retryCount?: number;
  shouldRefresh?: (error: AxiosError) => boolean;
};

export interface AxiosClientInterceptors {
  request?: {
    onFulfilled?: (config: CustomConfig) => CustomConfig;
    onRejected?: (error: AxiosError) => any | void;
  };
  response?: {
    onFulfilled?: (response: AxiosResponse) => AxiosResponse;
    onRejected?: (error: AxiosError) => any | void;
  };
}

export interface AxiosClientContructor {
  axiosConfig?: CreateAxiosDefaults;
  interceptors?: AxiosClientInterceptors;
}
