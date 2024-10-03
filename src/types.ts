import { AxiosError, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from 'axios';

export type IListener = (value?: unknown) => void;
export type CustomConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export type RequestObserverOptions = {
  refreshHandler: () => Promise<string>;
  combineAbortSignals?: boolean;
};

export interface AxiosClientInterceptors {
  request?: (config: CustomConfig) => CustomConfig;
  response?: {
    onFulfilled?: (response: AxiosResponse) => AxiosResponse;
    onRejected?: (
      error:
        | AxiosResponse<any, any>
        | AxiosError<unknown, any>
        | {
            status: number;
            error: string;
          }
    ) => AxiosResponse | AxiosError;
  };
}

export interface AxiosClientContructor {
  axiosConfig?: CreateAxiosDefaults;
  interceptor?: AxiosClientInterceptors;
  statusCodes?: number[];
}
