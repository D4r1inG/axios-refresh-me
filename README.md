# Axios Refresh Me

## Introduction

**Axios Refresh Me** is an Axios wrapper designed to handle refresh tokens and retry requests seamlessly. It simplifies the process of managing token expiration and retrying failed requests, ensuring a smoother user experience.

## Installation

To install the package, use npm or yarn:

```sh
npm install axios-refresh-me
```

## Usage

**Axios Refresh Me** uses a request observer to monitor requests and trigger the refresh handler when necessary. If the request fails due to a specified status code, the request observer will cancel all pending requests and refresh the token. After successfully refreshing the token, the request observer will retry the failed requests and the canceled requests automatically.

See the example below for a basic implementation of **Axios Refresh Me**.

## Example

```ts
import { AxiosClient, registerRequestObserver } from 'axios-refresh-me';

// Function to get the current token
function getToken() {
  // Logic to get the current token
  return 'current-token';
}

// Function to get a new token
async function refreshToken() {
  // Logic to get a new token
  const newToken = await new Promise((resolve) => {
    setTimeout(() => {
      resolve('new-token');
    }, 1000);
  });

  //  Remember to update the token in your token storage
  updateToken(newToken);
}

// Register the request observer with custom options
registerRequestObserver({
  // Logic to get a new token
  refreshHandler: refreshToken,
  // Status codes to trigger the refresh handler, default is [401]
  statusCodes: [401],
  // Retry count for the requests after refreshing the token successfully, default is 1
  retryCount: 1,
  // The request observer uses abort signals to cancel the requests, set this option to true to combine the abort signals
  // from the request observer and default signal from the Axios request, default is false
  combineAbortSignals: false,
  // Function to determine if the request should be retried, will override the statusCodes option, default is undefined
  shouldRefresh: (error) => {
    // Logic to determine if the request should be retried
    return error.response?.status === 401;
  },
});

// Create an instance of AxiosClient
const { instance } = new AxiosClient({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  },
  interceptors: {
    request: {
      onFulfilled: (config) => {
        // Handle successful request
        return config;
      },
      onRejected: (error) => {
        // Handle error request
        return Promise.reject(error);
      },
    },
    response: {
      onFulfilled: (response) => {
        // Handle successful response
        return response;
      },
      onRejected: (error) => {
        // Handle error response
        return Promise.reject(error);
      },
    },
  },
});

// Example API call
// Retry if request failed with 401 status code
instance
  .get('/data')
  .then((response) => {
    console.log('Data:', response.data);
  })
  .catch((error) => {
    console.error('Error:', error);
  });


```

## Author

D4r1inG
