
export const EthereumMainnet_ChainId = 1
export const BinanceSmartChainMainnet_ChainId = 56
export const PolygonMainnet_ChainId = 137

export const UniswapV2 = 1
export const Pancakeswap = 2
export const QuickswapV2 = 3

export const chainList = [ 
	{ title : 'Ethereum', id : EthereumMainnet_ChainId },
	{ title : 'Binance Smart Chain', id : BinanceSmartChainMainnet_ChainId },
	{ title : 'Polygon', id : PolygonMainnet_ChainId },
]

export const dexList = [ 
	{ title : 'Uniswap V2', id : 1, chainId: EthereumMainnet_ChainId },
	{ title : 'Pancakeswap', id : 2, chainId: BinanceSmartChainMainnet_ChainId },
	{ title : 'Quickswap V2', id : 3, chainId: PolygonMainnet_ChainId },
]

export const error_log = (summary, error) => {
	console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error?.response}`);
	// console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error?.response?.body?.description}`);
}