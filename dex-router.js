import {UniswapV2Monitor} from './swap-monitor/uniswapv2-monitor.js'
import {PancakeSwapV2Monitor} from './swap-monitor/pancakeswapv2-monitor.js'
import {QuickSwapMonitor} from './swap-monitor/quickswap-monitor.js'

import assert from 'assert';
import * as afx from './global.js'
import dotenv from 'dotenv'
dotenv.config()

const filterCriteria = {
    minEth: Number(process.env.MIN_BUY_ETH),
    minUsdt: Number(process.env.MIN_BUY_USDT),
    minUsdc: Number(process.env.MIN_BUY_USDC),
    minBnb: Number(process.env.MIN_BUY_BNB),
    minBusd: Number(process.env.MIN_BUY_BUSD),
    minMatic: Number(process.env.MIN_BUY_MATIC)
}

export let database
export let tokens = new Map()
export const tokenSwap = new Map()
export let web3Map = null

export const startMonitor = (web3, db, callback) => {

    database = db
    web3Map = web3

    assert(database)
    assert(web3Map)

    doEvent(callback)
}

const getTokenKey = (token) => {

    return `${token.address}_${token.chain}_${token.dex}`
}

const notifyToMain = (key, result, callback) => {

    const curToken = tokens.get(key)
    if (curToken) {
        callback(curToken.chatids, result)
    }
}

const doEvent = async (callback) => {

    const baseTokens = await database.getAllTokens()
    // flatten tokens from db
    let updatedTokens = new Map()
    for (const token of baseTokens) {
        let tokenKey = getTokenKey(token)

        let value = updatedTokens.get(tokenKey)
        if (!value) {

            value = {address: token.address, chain: token.chain, dex: token.dex, chatids:[token.chatid]}
            updatedTokens.set(tokenKey, value)

        } else {

            if (!value.chatids.find(opt => opt == token.chatid)) {

                value.chatids.push(token.chatid)
            }

        }
    }

    // calculate difference
    let removedTokens = new Map(tokens)
    let addedTokens = new Map()

    for (const [key, value] of updatedTokens) {

        if (tokens.get(key)) {
            removedTokens.delete(key)
        } else {

            addedTokens.set(key, value)
        }
    }


    tokens = updatedTokens

    // run monitor for newly added tokens
    for (const [key, token] of addedTokens) {

        const web3 = web3Map.get(token.chain)
        switch (token.dex) {

            case afx.UniswapV2: {
                console.log('Starting UniswapV2Monitor =>', key)

                let monitor = new UniswapV2Monitor(web3, token.address, filterCriteria, async (result) => {
                    
                    notifyToMain(key, result, callback)
                })

                monitor.start()
                tokenSwap.set(key, monitor)
                break
            }
            case afx.Pancakeswap: {
                console.log('Starting PancakeswapMonitor =>', key)

                let monitor = new PancakeSwapV2Monitor(web3, token.address, filterCriteria, async (result) => {
                    
                    notifyToMain(key, result, callback)
                })

                monitor.start()
                tokenSwap.set(key, monitor)
                break
            }
            case afx.QuickswapV2: {
                console.log('Starting QuickSwapMonitor =>', key)

                let monitor = new QuickSwapMonitor(web3, token.address, filterCriteria, async (result) => {
                    
                    notifyToMain(key, result, callback)
                })

                monitor.start()
                tokenSwap.set(key, monitor)
                break
            }

        }
    }

    // remove and stop monitor for removed tokens 
    for (const [key, token] of removedTokens) {

        let monitor = tokenSwap.get(key)
        if (monitor) {
            console.log('Stopping Monitor =>', key)
            monitor.stop()
            tokenSwap.delete(key)
        }
    }

    setTimeout(() => {
        doEvent(callback)
    }
    , 10000)
}
