
import { PANCAKESWAP_V2_FACTORY_ABI } from '../abi/pancakeswapv2-factory-abi.js';
import { PANCAKESWAP_V2_FACTORY_CONTACT_ADDRESS, WBNB_ADDRESS, USDT_ADDRESS_ON_BSC, BUSD_ADDRESS_ON_BSC } from './const.js';

import { PANCAKESWAP_V2_POOL_ABI } from '../abi/pancakeswapv2-pool-abi.js';
import * as utils from '../utils.js'

export class PancakeSwapV2Monitor {

	constructor(web3, tokenAddress, criteria, callback) {

		this.running = false
		this.web3 = web3
		this.tokenAddress = tokenAddress
		this.tokenInfo = {}
		this.dexTitle = 'Pancakeswap V2'
		this.criteria = criteria
		this.callback = callback

		this.pairsResult = new Map()
	}

	async start() {

		if (!this.web3.utils.isAddress(this.tokenAddress)) {
			console.log(`[${this.dexTitle}] ${this.tokenAddress} is invalid address`);
			return
		}
		
		this.tokenInfo = await utils.getTokenInfo(this.web3, this.tokenAddress)
		if (!this.tokenInfo) {
			console.log(`[${this.dexTitle}] ${this.tokenAddress} is invalid contract address`);
			return
		}


		this.factoryContract = new this.web3.eth.Contract(PANCAKESWAP_V2_FACTORY_ABI, PANCAKESWAP_V2_FACTORY_CONTACT_ADDRESS);

		this.running = true

		this.doEvent()
	}

	stop() {

		this.running = false
		this.unsubscribe()
	}

	unsubscribe() {

		for (const [pairAddress, pairData] of this.pairsResult) {

			pairData.subscription.unsubscribe((error, success) => {
				if (error) {
					console.error(error)
				}
			})

			pairData.subscription = undefined
		}

		this.pairsResult.clear()
	}

	async doEvent() {

		// this.doTest()

		// if (this.running) {
		// 	setTimeout(() => {
		// 		this.doEvent()
		// 	}, 10000)
		// } 
		// return
		try {

			let pairBaseNodes = [ WBNB_ADDRESS, USDT_ADDRESS_ON_BSC, BUSD_ADDRESS_ON_BSC ]
	
			var pairsPromises = [];
			for (const node of pairBaseNodes) {
				pairsPromises.push(this.factoryContract.methods.getPair(this.tokenInfo.address, node).call());
			}
	
			const pairAddresses = await Promise.all(pairsPromises)
			
			for (let i = 0; i < pairAddresses.length; i++) {
				const pairAddress = pairAddresses[i]
				const pairBaseNode = pairBaseNodes[i]
	
				if (pairAddress !== "0x0000000000000000000000000000000000000000") {
	
					if (!this.pairsResult.get(pairAddress)) {
						let pairData = { address: pairAddress, subscription : null }

						this.pairsResult.set(pairAddress, pairData);

						const pairContract = new this.web3.eth.Contract(PANCAKESWAP_V2_POOL_ABI, pairAddress);

						pairData.subscription = pairContract.events.Swap({}, async (error, event) => {

							if (!error) {

								let tokenPromise = []
								tokenPromise[0] = pairContract.methods.token0().call()
								tokenPromise[1] = pairContract.methods.token1().call()

								Promise.all(tokenPromise).then(tokenNames => {

									this.processSwapEvent(event, pairAddress, 
										tokenNames[0], 
										tokenNames[1], 
										pairBaseNode);
								}).catch (error => {
									console.error(error);
								})
								
							} else {
								console.error(error);
							}
						});
					}
				}
			}
	
			//console.log("pairsResult ===> ", this.pairsResult);
			// console.log('\x1b[32m%s\x1b[0m', "[v2] Pool has been created " + poolAddress);
			// Catch PoolCreated event in Uniswap V2 Protocol

			if (this.running) {
				setTimeout(() => {
					this.doEvent()
				}, 20000)
			} 

		} catch (error) {
			console.error(error)
		}
	}

	async processSwapEvent(event, pairAddress, token0, token1, baseTokenAddress) {

		if (!event.returnValues) {
			return;
		}
	
		// console.log(event)

		let sender = event.returnValues.sender
		let to = event.returnValues.to

		let amount0In = event.returnValues.amount0In
		let amount1In = event.returnValues.amount1In
		let amount0Out = event.returnValues.amount0Out
		let amount1Out = event.returnValues.amount1Out

		let tokenBalance = 0;
		let amountOut = 0
		// check out token is the one that we investigate
		if (amount0Out > 0 && token0.toLowerCase() === this.tokenInfo.address.toLowerCase()) {

			tokenBalance = amount1In
			amountOut = amount0Out

		} else if (amount1Out > 0 && token1.toLowerCase() === this.tokenInfo.address.toLowerCase()) {
			
			tokenBalance = amount0In
			amountOut = amount1Out

		} else {
			// Only allow buy swap
			return
		}
		
		amountOut /= 10 ** Number(this.tokenInfo.decimal)

		let usdPrice = 0
		let coinBalance = 0
		const ethPriceInUsdt = await this.getBnbPrice()

		const baseTokenInfo = await utils.getTokenInfo(this.web3, baseTokenAddress)
		if (!baseTokenInfo) {
			return
		}
		//console.log('baseTokenInfo', baseTokenInfo)
		tokenBalance = tokenBalance / 10 ** Number(baseTokenInfo.decimal)
		 
		if (baseTokenInfo.symbol === 'WBNB') {

			if (tokenBalance < parseFloat(this.criteria.minBnb)) {
				return
			}

			usdPrice = tokenBalance * ethPriceInUsdt
			coinBalance = tokenBalance

		} else if (baseTokenInfo.symbol === 'USDT') {

			if (tokenBalance < parseFloat(this.criteria.minUsdt)) {
				return
			}

			usdPrice = tokenBalance
			if (ethPriceInUsdt !== 0 && ethPriceInUsdt)
				coinBalance = usdPrice / ethPriceInUsdt

		} else if (baseTokenInfo.symbol === 'BUSD') {

			if (tokenBalance < parseFloat(this.criteria.minBusd)) {
				return
			}


			usdPrice = tokenBalance
			if (ethPriceInUsdt !== 0 && ethPriceInUsdt)
				coinBalance = usdPrice / ethPriceInUsdt

		} else {
			// Only allow eth, usdt, usdc
			return
		}

		let coinTag = 'BNB'

		let tokenPrice = amountOut ? usdPrice / amountOut : 0

		let tokenPriceInCoin = amountOut ? coinBalance / amountOut : 0

		let totalSupply = this.tokenInfo.totalSupply / 10 ** Number(this.tokenInfo.decimal)
		let marketCap = Number(totalSupply) * tokenPrice

		let tokenTag = baseTokenInfo.symbol

		let result = {
			balance: { tokenBalance, tokenTag, usdPrice, coinBalance, coinTag }, amountOut, tokenPrice, tokenPriceInCoin, 
			marketCap: marketCap,
			tokenInfo: this.tokenInfo,
			link: {
				TX: `https://bscscan.com/tx/${event.transactionHash.toLowerCase()}`,
				Chart: `https://www.dextools.io/app/bnb/pair-explorer/${pairAddress}?utm_source=telegram&utm_medium=`,
				Buyer: `https://bscscan.com/address/${to}`,
				SwapName: `PancakeSwap`,
				Swap: `https://pancakeswap.finance/#/swap?&chainId=56&outputCurrency=${this.tokenInfo.address}`,
				// Buy: `https://flooz.xyz/trade/${this.tokenInfo.address}?network=eth&refId=irU2lq`
			}
		}

		this.callback(result)
	}

	async getBnbPrice() {

		return new Promise( async (resolve, reject) => { 

			fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd')
			.then(response => response.json())
			.then(data => {
				const bnbPrice = data.binancecoin.usd;
				resolve(Number(bnbPrice))
			})
			.catch(error => resolve(0));
		})
	}

	async doTest() {

		//async processSwapEvent(web3, event, pairAddress, token0, token1, tokenTag, criteria, callback) {

		let event = {
			address: '0x0eD7e52944161450477ee417DE9Cd3a859b14fD0',
			blockNumber: 28684534,
			transactionHash: '0xd2372932f83a9ff109a2e47394d912273070fce4c549afa4da562040f1f43b2a',
			transactionIndex: 71,
			blockHash: '0x46640c9f1c82a9eccfc59cb061fc0a87d65cfc2a8e439df8bd85eb97a59e45b2',
			logIndex: 162,
			removed: false,
			id: 'log_820a6fb0',
			returnValues: {
			  '0': '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
			  '1': '0',
			  '2': '29114473397981312',
			  '3': '5375609058707107562',
			  '4': '0',
			  '5': '0xDa5c853c90b59C44275721A4ea3e725239c59F57',
			  sender: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
			  amount0In: '0',
			  amount1In: '9929114473397981312',
			  amount0Out: '5375609058707107562',
			  amount1Out: '0',
			  to: '0xDa5c853c90b59C44275721A4ea3e725239c59F57'
			},
			event: 'Swap',
			signature: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
			raw: {
			  data: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000676f7594b590800000000000000000000000000000000000000000000000004a99fff52b9beeea0000000000000000000000000000000000000000000000000000000000000000',
			  topics: [
				'0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
				'0x00000000000000000000000013f4ea83d0bd40e75c8222255bc855a974568dd4',
				'0x000000000000000000000000da5c853c90b59c44275721a4ea3e725239c59f57'
			  ]
			}
		  }

		const pairAddress = '0x0eD7e52944161450477ee417DE9Cd3a859b14fD0'
		const tokenTag = 'BNB'

		const token0 = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'
		const token1 = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' 

		this.processSwapEvent(this.web3, event, pairAddress, token0, token1, tokenTag, WBNB_ADDRESS)
	}
}
