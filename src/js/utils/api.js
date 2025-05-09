import axios from "axios";
import { cipher, decipher } from "./cipherLibrary";

const myCipher = cipher("transactionsalt");

// Create an instance of axios
const api = axios.create({
  baseURL: "https://bonkgames.io/api/api",
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

export const withdrawCredit = async (token, solanaWallet, amount) => {
  try {
    const response = await api.post(
      "/users/withdraw",
      {
        encrypted_solana_wallet: myCipher(solanaWallet),
        encrypted_del_credit: myCipher(amount.toString()),
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
    console.log("API.js - setCreditCount - Enviando petición al servidor:", {
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
    
    console.log("API.js - setCreditCount - Respuesta recibida:", {
      status: response.status,
      data: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error("API.js - setCreditCount - Error en petición:", {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data'
    });
    throw error;
  }
};

export const updateEarnCount = async (token, earn, addToExisting = true) => {
  try {
    // If we should add to existing earns, first get the current user info to get existing earns value
    let updatedEarn = earn;
    
    if (addToExisting) {
      try {
        // Get current user info to determine existing earns
        const userInfo = await getUserInfo(token);
        const existingEarns = userInfo.user && userInfo.user.earns ? parseFloat(userInfo.user.earns) : 0;
        
        // Add the new amount to existing earns
        updatedEarn = existingEarns + earn;
        
        console.log('API.js - updateEarnCount - Adding to existing earns:', {
          existingEarns,
          newEarns: earn,
          updatedTotal: updatedEarn
        });
      } catch (userInfoError) {
        console.error('API.js - updateEarnCount - Error fetching user info:', {
          message: userInfoError.message
        });
        // Continue with just the new value if we couldn't get existing earns
      }
    }
    
    console.log('API.js - updateEarnCount - Sending request to server:', {
      endpoint: '/users/updateEarnCount',
      earn: updatedEarn,
      addToExisting
    });
    
    const response = await api.patch(
      '/users/updateEarnCount',
      { earn: updatedEarn },
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


export default api;
