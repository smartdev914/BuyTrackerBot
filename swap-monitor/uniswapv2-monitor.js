
import { UNISWAP_V2_FACTORY_ABI } from '../abi/uniswapv2-factory-abi.js';
import { UNISWAP_V2_FACTORY_CONTACT_ADDRESS, WETH_ADDRESS, USDT_ADDRESS_ON_ETH, USDC_ADDRESS_ON_ETH } from './const.js';
import { UNISWAP_V2_POOL_ABI } from '../abi/uniswapv2-pool-abi.js';
import * as utils from '../utils.js'


export class UniswapV2Monitor {

	constructor(web3, tokenAddress, criteria, callback) {

		this.running = false
		this.web3 = web3
		this.tokenAddress = tokenAddress
		this.tokenInfo = {}
		this.dexTitle = 'Uniswap V2'
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


		this.factoryContract = new this.web3.eth.Contract(UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_FACTORY_CONTACT_ADDRESS);

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

			let pairBaseNodes = [ WETH_ADDRESS, USDT_ADDRESS_ON_ETH, USDC_ADDRESS_ON_ETH ]
	
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

						const pairContract = new this.web3.eth.Contract(UNISWAP_V2_POOL_ABI, pairAddress);

						pairData.subscription = pairContract.events.Swap({}, async (error, event) => {

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
	
		//  console.log(event)

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
		const ethPriceInUsdt = await this.getEthPrice()

		const baseTokenInfo = await utils.getTokenInfo(this.web3, baseTokenAddress)
		//  console.log('baseTokenInfo', baseTokenInfo)
		tokenBalance = tokenBalance / 10 ** Number(baseTokenInfo.decimal)
		if (baseTokenInfo.symbol === 'WETH') {

			if (tokenBalance < parseFloat(this.criteria.minEth)) {
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

		let coinTag = 'ETH'

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
				TX: `https://etherscan.io/tx/${event.transactionHash.toLowerCase()}`,
				Chart: `https://www.dextools.io/app/ether/pair-explorer/${pairAddress}?utm_source=telegram&utm_medium=`,
				Buyer: `https://etherscan.io/address/${to}`,
				SwapName: `Uniswap`,
				Swap: `https://app.uniswap.org/#/swap?&chain=mainnet&use=v2&outputCurrency=${this.tokenInfo.address}`,
				Buy: `https://flooz.xyz/trade/${this.tokenInfo.address}?network=eth&refId=irU2lq`
			}
		 }

		 this.callback(result)
	}

	async getEthPrice() {

		return new Promise( async (resolve, reject) => { 

			fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
			.then(response => response.json())
			.then(data => {
				const ethPrice = data.ethereum.usd;
				resolve(Number(ethPrice))
			})
			.catch(error => resolve(0));
		})
	}

	async doTest() {

		let event = {
			removed: false,
			logIndex: 134,
			transactionIndex: 62,
			transactionHash: '0xd1c5f19afebdbc3d4a0dfcb5458b079ca0a427fcd2340dc9faa9dee39bef41b9',
			blockHash: '0x16beceffebc55659c52d11ad77bb0d3364435c6ff3b3366f35eed2a470750916',
			blockNumber: 17350087,
			address: '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f',
			id: 'log_83394295',
			returnValues: {
			  '0': '0x1111111254EEB25477B68fb85Ed929f73A960582',
			  '1': '0',
			  '2': '9912500000000000',
			  '3': '12015720970543015229490008',
			  '4': '0',
			  '5': '0x74de5d4FCbf63E00296fd95d33236B9794016631',
			  sender: '0x1111111254EEB25477B68fb85Ed929f73A960582',
			  amount0In: '0',
			  amount1In: '999912500000000000',
			  amount0Out: '1209915720970543015229490008',
			  amount1Out: '0',
			  to: '0x74de5d4FCbf63E00296fd95d33236B9794016631'
			},
			event: 'Swap',
			signature: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
			raw: {
			  data: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000023375dc156080000000000000000000000000000000000000000000009f06d89fcb2bd4e9d83580000000000000000000000000000000000000000000000000000000000000000',
			  topics: [
				'0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
				'0x0000000000000000000000001111111254eeb25477b68fb85ed929f73a960582',
				'0x00000000000000000000000074de5d4fcbf63e00296fd95d33236b9794016631'
			  ]
			}
		  }

		const pairAddress = '0xA43fe16908251ee70EF74718545e4FE6C5cCEc9f'
		const tokenTag = 'ETH'
		const  criteria = { minEth: '1', minUsdt: '1000', minUsdc: '1000' }

		const token0 = '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
		const token1 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' 

		this.processSwapEvent(this.web3, event, pairAddress, token0, token1, WETH_ADDRESS)
	}
}
