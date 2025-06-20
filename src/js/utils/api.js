import axios from "axios";
import { cipher, decipher } from "./cipherLibrary";

const myCipher = cipher("transactionsalt");

// Create an instance of axios
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
/*
  NOTE: intercept any error responses from the api
 and check if the token is no longer valid.
 ie. Token has expired or user is no longer
 authenticated.
 logout the user if the token has expired
*/

api.interceptors.response.use(
  (res) => {
    if ([200, 201, 204].includes(res.status)) {
      return Promise.resolve(res);
    }
    return Promise.reject(res);
  },
  (err) => {
    return Promise.reject(err);
  }
);

export const createOrGetWallet = async (walletAddress) => {
  try {
    const response = await api.post("/users/signup", {
      nft_address: walletAddress,
      name: `User-${walletAddress.substring(0, 6)}`,
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      // Wallet exists, try to login instead
      const loginResponse = await api.post("/users/login", {
        nft_address: walletAddress,
      });
      return loginResponse.data;
    }
    throw error;
  }
};

export const updateCredit = async (token, amount, tx_hash) => {
  try {
    const response = await api.post(
      "/users/deposit",
      {
        encrypted_add_credit: myCipher(amount.toString()),
        encrypted_timestamp: myCipher(Date.now().toString()),
        encrypted_transaction_hash: myCipher(tx_hash),
      },
      {
        headers: { "x-auth-token": token },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const withdrawCredit = async (token, solanaWallet, amount = null) => {
  try {
    console.log('API.js - withdrawCredit - Iniciando retiro de créditos:', {
      retirarTodo: amount === null,
      amount: amount
    });
    
    const requestData = {
      encrypted_solana_wallet: myCipher(solanaWallet),
    };
    
    // Si se proporciona una cantidad específica, cifrarla y enviarla
    // Si no, no enviar el parámetro para que el backend retire todos los créditos
    if (amount !== null) {
      requestData.encrypted_del_credit = myCipher(amount.toString());
    } else {
      requestData.encrypted_del_credit = 'all';
    }
    
    const response = await api.post(
      "/users/withdraw",
      requestData,
      {
        headers: { "x-auth-token": token },
      }
    );
    
    console.log('API.js - withdrawCredit - Respuesta:', {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error('API.js - withdrawCredit - Error:', {
      message: error.message,
      response: error.response ? { status: error.response.status, data: error.response.data } : null
    });
    throw error;
  }
};

export const withdrawBonk = async (token, solanaWallet, amount = null) => {
  try {
    console.log('API.js - withdrawBonk - Initilizing bonk withdrawal:', {
      retirarTodo: amount === null,
      amount: amount
    });
    
    const requestData = {
      encrypted_solana_wallet: myCipher(solanaWallet),
    };
    
    // If a specific amount is provided, encrypt it and send it
    // If not, do not send the parameter to withdraw all bonks
    if (amount !== null) {
      requestData.encrypted_del_bonk = myCipher(amount.toString());
    } else {
      requestData.encrypted_del_bonk = 'all';
    }
    
    const response = await api.post(
      "/users/withdrawBonk",
      requestData,
      {
        headers: { "x-auth-token": token },
      }
    );
    
    console.log('API.js - withdrawBonk - Response:', {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error('API.js - withdrawBonk - Error:', {
      message: error.message,
      response: error.response ? { status: error.response.status, data: error.response.data } : null
    });
    throw error;
  }
};

export const getUserInfo = async (token) => {
  try {
    const response = await api.get("/users", {
      headers: { "x-auth-token": token },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const setCreditCount = async (token, credit_count) => {
  try {
    console.log("API.js - setCreditCount - Sending request to server:", {
      endpoint: "/users/updateCreditCount",
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 10) + '...' : null,
      credit_count
    });
    
    const response = await api.patch(
      "/users/updateCreditCount",
      { credit_count },
      { headers: { "x-auth-token": token } }
    );
    
    console.log("API.js - setCreditCount - Response received:", {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error("API.js - setCreditCount - Error in request:", {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data'
    });
    throw error;
  }
};

export const updateEarnCount = async (token, earn) => {
  try {
    console.log('API.js - updateEarnCount - Sending request to server:', {
      endpoint: '/users/updateEarnCount',
      earn
    });
    const response = await api.patch(
      '/users/updateEarnCount',
      { earn },
      { headers: { 'x-auth-token': token } }
    );
    console.log('API.js - updateEarnCount - Response:', {
      status: response.status,
      data: response.data
    });
    return response.data;
  } catch (error) {
    console.error('API.js - updateEarnCount - Error:', {
      message: error.message,
      response: error.response ? { status: error.response.status, data: error.response.data } : null
    });
    throw error;
  }
};

/**
 * Updates the maximum kills of the user in the backend only if the new value is higher
 * @param {string} token - User authentication token
 * @param {number} kills - Number of kills to update
 * @returns {Promise<Object>} - Server response with the result and whether it was a new record
 */
export const updateMaxKills = async (token, kills) => {
  try {
    console.log('API.js - updateMaxKills - Processing kills update:', {
      kills
    });
    
    // Use axios for the request
    const response = await api.patch(
      '/users/updateMaxKills',
      { kills },
      { 
        headers: { 'x-auth-token': token }
      }
    );
    console.log('API.js - updateMaxKills - Response received:', {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error('API.js - updateMaxKills - Error:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data'
    });
    throw error;
  }
};

export default api;
