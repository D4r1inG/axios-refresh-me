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
import { AxiosClient, registerRequestObserver } from 'axios-refresh-me';

// Register the request observer with custom options
registerRequestObserver({
  refreshHandler: async () => {
    // Logic to get a new token
    const newToken = await getNewToken();
    return newToken;
  },
  statusCodes: [401], // Status codes to trigger the refresh handler
});

// Create an instance of AxiosClient
const { instance } = new AxiosClient({
  axiosConfig: {
    baseURL: 'https://api.example.com',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  },
  interceptor: {
    request: (config) => {
      // Modify request config if needed
      return config;
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

// Function to get the current token
function getToken() {
  // Logic to get the current token
  return 'current-token';
}

// Function to get a new token
async function getNewToken() {
  // Logic to get a new token
  return 'new-token';
}
```

## Author

D4r1inG
