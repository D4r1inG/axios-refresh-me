# Axios Refresh Me

## Introduction

**Axios Refresh Me** is an Axios wrapper designed to handle refresh tokens and retry requests seamlessly. It simplifies the process of managing token expiration and retrying failed requests, ensuring a smoother user experience.

## Installation

To install the package, use npm or yarn:

```sh
npm install axios-refresh-me
```

## Example

```ts
import { AxiosClient, RequestObserver } from 'axios-refresh-me';

// Define your refresh token handler
const refreshHandler = async () => {
  // Logic to get a new token
  const newToken = await new Promise((resolve) => {
    setTimeout(() => resolve('new-token'), 5000);
  });

  return newToken;
};

// Create a RequestObserver instance
const observer = new RequestObserver({
  refreshHandler,
  combineAbortSignals: true,
});

// Create an AxiosClient instance
const apiClient = new AxiosClient(observer, {
  axiosConfig: {
    baseURL: 'https://api.example.com',
  },
  statusCodes: [401, 403],
});

// Use the AxiosClient instance to make requests
apiClient.instance
  .get('/protected-endpoint')
  .then((response) => {
    console.log('Data:', response.data);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
```

## Author

quannt
