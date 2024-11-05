
import { STANDARD_TOKEN_ABI } from './abi/standard-token-abi.js';
import { ERC20_ABI } from './abi/ERC20_ABI.js'

export const isValidWalletAddress = (walletAddress) => {
    // The regex pattern to match a wallet address.
    const pattern = /^(0x){1}[0-9a-fA-F]{40}$/;
  
    // Test the passed-in wallet address against the regex pattern.
    return pattern.test(walletAddress);
}

export const getTokenBalanceFromWallet = async (web3, walletAddress, tokenAddress) => {

    let tokenContract = null;
    try {
        tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    } catch (error) {
        console.error('getTokenBalanceFromWallet', 'Error creating contract instance:', error);
    }

    if (!tokenContract) {
        return -1;
    }
    
    const balance = await tokenContract.methods.balanceOf(walletAddress).call();
    const decimals = await tokenContract.methods.decimals().call();
    const tokenBalance = balance / 10 ** Number(decimals);
    //console.log(`getTokenBalanceFromWallet(wallet = ${walletAddress} token = ${tokenAddress})`, "Token Balance:", tokenBalance);

    return tokenBalance;
}



export const isValidAddress = (address) => {
    // Check if it's 20 bytes
    if (address.length !== 42) {
      return false;
    }
  
    // Check that it starts with 0x
    if (address.slice(0,2) !== '0x') {
      return false;
    }
  
    // Check that each character is a valid hexadecimal digit
    for (let i = 2; i < address.length; i++) {
      let charCode = address.charCodeAt(i);
      if (!((charCode >= 48 && charCode <= 57) ||
            (charCode >= 65 && charCode <= 70) ||
            (charCode >= 97 && charCode <= 102))) {
        return false;
      }
    }
  
    // If all checks pass, it's a valid address
    return true;
  }

export const roundDecimal = (number, digits) => {
    return number.toLocaleString('en-US', {maximumFractionDigits: digits});
}

export const getTokenInfo = async (web3, tokenAddress) => {

  return new Promise( async (resolve, reject) => { 

    let tokenContract = new web3.eth.Contract(STANDARD_TOKEN_ABI, tokenAddress);
    var tokenPromises = [];

    tokenPromises.push(tokenContract.methods.name().call());
    tokenPromises.push(tokenContract.methods.symbol().call());
    tokenPromises.push(tokenContract.methods.decimals().call());
    tokenPromises.push(tokenContract.methods.totalSupply().call());

    Promise.all(tokenPromises).then(tokenInfo => {

      const result = {address: tokenAddress, name: tokenInfo[0], symbol: tokenInfo[1], decimal: parseInt(tokenInfo[2]), totalSupply: Number(tokenInfo[3])}
      resolve(result)

    }).catch(err => {

      resolve(null)
    })
  })
}

export const generateReferralLink = (bot_username, chatid) => {

  const result = `https://t.me/${bot_username}?start=${encodeURIComponent(btoa(chatid))}`
  // const result = `https://t.me/${bot_username}?x=${encodeURIComponent(btoa(chatid))}`
  return result
}

export const decodeReferralCode = (code) => {

  try {
    return atob(decodeURIComponent(code))
  } catch (err) {
    return ''
  }  
}