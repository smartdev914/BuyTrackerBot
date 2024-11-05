import Web3 from 'web3'
import * as bot from './bot.js'
import * as router from './dex-router.js'
import * as db from './db.js'
import * as afx from './global.js'
import * as server from './server.js'

import dotenv from 'dotenv'
dotenv.config()

const options = {
	reconnect: {
		auto: true,
		delay: 5000, // ms
		maxAttempts: 5,
		onTimeout: false
	}
};
   
export const web3_eth = new Web3(new Web3.providers.WebsocketProvider(process.env.ETHEREUM_RPC_URL, options))
export const web3_bsc = new Web3(new Web3.providers.WebsocketProvider(process.env.BSC_RPC_URL, options))
export const web3_polygon = new Web3(new Web3.providers.WebsocketProvider(process.env.POLYGON_RPC_URL, options))

const initialMapValues = [
	[afx.EthereumMainnet_ChainId, web3_eth],
	[afx.BinanceSmartChainMainnet_ChainId, web3_bsc],
	[afx.PolygonMainnet_ChainId, web3_polygon]
  ];

const web3Map = new Map(initialMapValues)

await db.init()
await bot.init(db)

router.startMonitor(web3Map, db, async (chatids, result) => {
	bot.notify(chatids, result)
})

server.start(web3Map, db, bot);

