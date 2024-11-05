
import { QUICKSWAP_FACTORY_ABI } from '../abi/quickswap-factory-abi.js';
import { QUICKSWAP_FACTORY_CONTACT_ADDRESS, WMATIC_ADDRESS, USDT_ADDRESS_ON_POLYGON, USDC_ADDRESS_ON_POLYGON } from './const.js';
import { QUICKSWAP_POOL_ABI } from '../abi/quickswap-pool-abi.js';
import * as utils from '../utils.js'

export class QuickSwapMonitor {

	constructor(web3, tokenAddress, criteria, callback) {

		this.running = false
		this.web3 = web3
		this.tokenAddress = tokenAddress
		this.tokenInfo = {}
		this.dexTitle = 'QuickSwap'
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

		this.factoryContract = new this.web3.eth.Contract(QUICKSWAP_FACTORY_ABI, QUICKSWAP_FACTORY_CONTACT_ADDRESS);

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

			let pairBaseNodes = [ WMATIC_ADDRESS, USDT_ADDRESS_ON_POLYGON, USDC_ADDRESS_ON_POLYGON ]
	
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

						const pairContract = new this.web3.eth.Contract(QUICKSWAP_POOL_ABI, pairAddress);

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
		const ethPriceInUsdt = await this.getMaticPrice()

		const baseTokenInfo = await utils.getTokenInfo(this.web3, baseTokenAddress)

		if (!baseTokenInfo) {
			return
		}
		//console.log('baseTokenInfo', baseTokenInfo)
		tokenBalance = tokenBalance / 10 ** Number(baseTokenInfo.decimal)
		 
		if (baseTokenInfo.symbol === 'WMATIC') {

			if (tokenBalance < parseFloat(this.criteria.minMatic)) {
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

		} else if (baseTokenInfo.symbol === 'USDC') {

			if (tokenBalance < parseFloat(this.criteria.minUsdc)) {
				return
			}

			usdPrice = tokenBalance
			if (ethPriceInUsdt !== 0 && ethPriceInUsdt)
				coinBalance = usdPrice / ethPriceInUsdt

		} else {
			// Only allow eth, usdt, usdc
			return
		}

		let coinTag = 'MATIC'

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
				TX: `https://polygonscan.com/tx/${event.transactionHash.toLowerCase()}`,
				Chart: `https://www.dextools.io/app/polygon/pair-explorer/${pairAddress}?utm_source=telegram&utm_medium=`,
				Buyer: `https://polygonscan.com/address/${to}`,
				SwapName: `QuickSwap`,
				Swap: `https://quickswap.exchange/#/swap?&outputCurrency=${this.tokenInfo.address}`,
			}
		}

		this.callback(result)
	}

	async getMaticPrice() {

		return new Promise( async (resolve, reject) => { 

			fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd')
			.then(response => response.json())
			.then(data => {
				const maticPrice = data['matic-network'].usd;
				resolve(Number(maticPrice))
			})
			.catch(error => resolve(0));
		})
	}

	async doTest() {

		//async processSwapEvent(web3, event, pairAddress, token0, token1, tokenTag, criteria, callback) {

		let event = {
			address: '0xF3eB2f17eAFBf35e92C965A954c6e7693187057D',
			blockNumber: 43376844,
			transactionHash: '0x22ea937b8dc97e3d8d179e6ef05ed9ddd358a4623e9c040221f836fbe67e64c0',
			transactionIndex: 4,
			blockHash: '0x576b88653f7cbd4113fe7e819f7912dcc9588b2c7203b4b641653b50550a6daf',
			logIndex: 39,
			removed: false,
			id: 'log_e562226d',
			returnValues: {
			  '0': '0x7B5D42d0363008CE90C2c8a7A94cE5B9B398426f',
			  '1': '489948942916369345',
			  '2': '0',
			  '3': '0',
			  '4': '8600331908026490881',
			  '5': '0x7B5D42d0363008CE90C2c8a7A94cE5B9B398426f',
			  sender: '0x7B5D42d0363008CE90C2c8a7A94cE5B9B398426f',
			  amount0In: '489948942916369345',
			  amount1In: '0',
			  amount0Out: '0',
			  amount1Out: '8600331908026490881',
			  to: '0x7B5D42d0363008CE90C2c8a7A94cE5B9B398426f'
			},
			event: 'Swap',
			signature: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
			raw: {
			  data: '0x00000000000000000000000000000000000000000000000006cca5f7bc9bbbc100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000775a844dc8606001',
			  topics: [
				'0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
				'0x0000000000000000000000007b5d42d0363008ce90c2c8a7a94ce5b9b398426f',
				'0x0000000000000000000000007b5d42d0363008ce90c2c8a7a94ce5b9b398426f'
			  ]
			}
		  }
		  

		const pairAddress = '0xF3eB2f17eAFBf35e92C965A954c6e7693187057D'
		const tokenTag = 'MATIC'
		const  criteria = { minMatic: '1', minUsdt: '1000', minBusd: '1000' }

		const token0 = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
		const token1 = '0xB5C064F955D8e7F38fE0460C556a72987494eE17' 

		this.processSwapEvent(this.web3, event, pairAddress, token0, token1, WMATIC_ADDRESS)
	}
}
