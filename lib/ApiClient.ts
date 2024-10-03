/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
import axios, { AxiosResponse, AxiosInstance, AxiosError } from 'axios';
import RequestObserver from './RequestObserver';
import { AxiosClientContructor, CustomConfig } from './interfaces';

class AxiosClient {
  private readonly api: AxiosInstance;
  private readonly observer: RequestObserver;

  constructor(observer: RequestObserver, config: AxiosClientContructor = {}) {
    const { axiosConfig = {}, interceptor = {}, statusCodes = [401] } = config;
    this.observer = observer;

    this.api = axios.create({
      ...axiosConfig,
    });

    this.api.interceptors.request.use(
      async (axiosConfig) => {
        const newConfig = await this.handleBaseInterceptReq(axiosConfig);
        return interceptor?.request ? interceptor.request(newConfig) : newConfig;
      },
      (error) => Promise.reject(error),
    );
    this.api.interceptors.response.use(
      interceptor?.response?.onFulfilled || ((response: AxiosResponse) => response),
      async (error: AxiosError) => {
        const newError = await this.handleBaseInterceptResError(error, statusCodes);
        return interceptor?.response?.onRejected ? interceptor.response.onRejected(newError) : newError;
      },
    );
  }

  private handleBaseInterceptReq = async (config: CustomConfig) => {
    config.signal = await this.observer.getReqSignal(config);
    return config;
  };

  private handleBaseInterceptResError = async (
    error: AxiosError,
    statusCodes: AxiosClientContructor['statusCodes'],
  ) => {
    const config: CustomConfig = error?.config;
    const resError = error?.response;
    const isCancelNotFromUser = axios.isCancel(error) && this.observer.getSuspendedStatus();

    if (config?._retry) return Promise.reject('Observer refresh token success, but retrying still failed!');

    if (statusCodes?.includes(resError?.status) || isCancelNotFromUser) {
      config._retry = true;

      return this.api(config);
    }

    return error;
  };

  get instance() {
    return this.api;
  }
}

export default AxiosClient;
