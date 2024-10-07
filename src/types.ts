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
};

export interface AxiosClientInterceptors {
  request?: {
    onFulfilled?: (config: CustomConfig) => CustomConfig;
    onRejected?: (error: AxiosError) => AxiosError;
  };
  response?: {
    onFulfilled?: (response: AxiosResponse) => AxiosResponse;
    onRejected?: (error: AxiosError) => AxiosResponse | AxiosError;
  };
}

export interface AxiosClientContructor {
  axiosConfig?: CreateAxiosDefaults;
  interceptor?: AxiosClientInterceptors;
}
