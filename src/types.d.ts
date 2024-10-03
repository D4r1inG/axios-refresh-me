import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

type IListener = (value?: unknown) => void;
type CustomConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RequestObserverOptions = {
  refreshHandler: () => Promise<string>;
  combineAbortSignals?: boolean;
};

interface AxiosClientInterceptors {
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
          },
    ) => AxiosResponse | AxiosError;
  };
}

interface AxiosClientContructor {
  axiosConfig?: InternalAxiosRequestConfig;
  interceptor?: AxiosClientInterceptors;
  statusCodes?: number[];
}
