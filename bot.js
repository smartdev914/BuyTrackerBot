import TelegramBot from 'node-telegram-bot-api'
import assert from 'assert';
import dotenv from 'dotenv'
dotenv.config()

import * as utils from './utils.js'
import * as afx from './global.js'

const token = process.env.BOT_TOKEN
export const bot = new TelegramBot(token, { polling: true })

export const myInfo = await bot.getMe();
export let database

export const sessions = new Map()
export const users = new Map()
export const stateMap = new Map()

export const MIN_COMUNITY_TOKEN_AMOUNT = process.env.MIN_COMUNITY_TOKEN_AMOUNT

const COMMAND_START = 'start'
const COMMAND_TEST = 'test'
const COMMAND_WALLET = 'test'
const OPTION_SELECT_GROUP = 0
const OPTION_MAIN_SETTING = 1
const OPTION_SELECT_CHAIN = 2
const OPTION_INPUT_TOKEN_ADDRESS = 3
const OPTION_SHOW_TOKEN_LIST = 4
const OPTION_DELETE_ALL_TOKEN = 5
const OPTION_DELETE_TOKEN = 6
const OPTION_SELECT_DEX = 7
const OPTION_INPUT_LOGO_IMAGE = 8
const OPTION_INPUT_BULLET_EMOJI = 9
const OPTION_INPUT_REFERRAL_LINK = 10
const OPTION_BOT_REFERRAL = 11

const OPTION_BOT_REFERRAL_REFERRAL = 12
const OPTION_BOT_REFERRAL_WITHDRAW = 13
const OPTION_BOT_REFERRAL_INFORMATION = 14
const OPTION_BOT_REFERRAL_SUPPORT = 15

const OPTION_CANCEL = -1
 
export const STATE_IDLE = 0
export const STATE_INPUT_POOL_ADDRESS = 1
export const STATE_INPUT_LOGO_IMAGE = 2
export const STATE_INPUT_BULLET_EMOJI = 3
export const STATE_INPUT_REFFERAL_LINK = 4
export const STATE_INPUT_WITHDRAWAL_WALLET = 5

const stateMap_set = (chatid, state, data = {}) => {
	stateMap.set(chatid, {state, data})
}

const stateMap_get = (chatid) => {
	return stateMap.get(chatid)
}

const stateMap_remove = (chatid) => {
	stateMap.delete(chatid)
}

const stateMap_clear = () => {
	stateMap.clear()
}

async function displayMenu(chatId, messageId, menu, isEdit = true) {

	const keyboard = {
	  inline_keyboard: menu.options.map(option => {
		return [{ text: option.label, callback_data: JSON.stringify({c : option.command, i: option.id}) }];
	  }),
	  resize_keyboard: true,
	  one_time_keyboard: true,
	  force_reply: true
	};
  
	if (isEdit) {
		await bot.editMessageText(menu.label, {chat_id: chatId, message_id: messageId, reply_markup: keyboard })
	} else {
		await bot.sendMessage(chatId, menu.label, {reply_markup: keyboard});
	}
}

async function displayPairs(chatId, messageId, menu) {

	const keyboard = {
	  inline_keyboard: menu.options.map(option => {
		if (option.address) {
			return [ { text: `✖️ ${option.address.toLowerCase()} [${option.chain}]`, callback_data: JSON.stringify({c : option.command, i: option.id}) } ];
		} else {
			return [{ text: option.label, callback_data: JSON.stringify({c : option.command, i: option.id}) }]
		}
	  }),
	  resize_keyboard: true,
	  one_time_keyboard: true,
	  force_reply: true
	};
  
	await bot.editMessageText(menu.label, {chat_id: chatId, message_id: messageId, reply_markup: keyboard })
}

const json_botSettings = (adminId) => {
	return {
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: 'Click here',
						callback_data: JSON.stringify({ i: adminId, c: OPTION_SELECT_GROUP }),
					},
				],
				[
					{
						text: 'Bot Referral Setting',
						callback_data: JSON.stringify({ i: adminId, c: OPTION_BOT_REFERRAL }),
					},
				],
			],
			resize_keyboard: true,
			one_time_keyboard: true,
			force_reply: true,
		}
	}
}

const json_selectGroupOption = async (admin) => {

	const groups = await database.selectSessions({adminid : admin})

	let json = [];
	for (const group of groups) {
		json.push({ label: group.username, command: OPTION_MAIN_SETTING, id: group.chatid })
	}

	json.push({ label: '✖️Cancel', command: OPTION_CANCEL, id: '' })

	return { label: '⬇️ Select a group you want to setup to', options: json };
}

export const json_mainSettingOption = (groupId, adminId) => {

	let json = [ 
		{ label: 'Add Token', command: OPTION_SELECT_CHAIN, id: groupId },
		{ label: 'Remove Token', command: OPTION_SHOW_TOKEN_LIST, id: groupId },
		{ label: 'Set Logo Image', command: OPTION_INPUT_LOGO_IMAGE, id: groupId },
		{ label: 'Set Bullet Emoji', command: OPTION_INPUT_BULLET_EMOJI, id: groupId },
		{ label: 'Set Buy Referral Link', command: OPTION_INPUT_REFERRAL_LINK, id: groupId },
		{ label: 'Back', command: OPTION_SELECT_GROUP, id : adminId },
	];

	return { label: '⬇️ Choose the options that you want to setup', options: json };
}

export const json_botReferralOption = (adminId) => {

	let json = [ 
		{ label: 'Referral Status', command: OPTION_BOT_REFERRAL_REFERRAL, id: adminId },
		{ label: 'Set your withdrawal wallet', command: OPTION_BOT_REFERRAL_WITHDRAW, id: adminId },
		{ label: 'Information', command: OPTION_BOT_REFERRAL_INFORMATION, id: adminId },
		{ label: 'Support', command: OPTION_BOT_REFERRAL_SUPPORT, id: adminId },
		{ label: '✖️Cancel', command: OPTION_CANCEL, id : '' },
	];

	return { label: '⬇️ Choose the options that you want to setup', options: json };
}

export const json_selectChainOption = (groupId) => {

	let json = [];
	for (const chain of afx.chainList) {
		json.push({ label: chain.title, command: OPTION_SELECT_DEX, id: `${groupId}:${chain.id}` })
	}

	json.push({ label: 'Back', command: OPTION_MAIN_SETTING, id: groupId })

	return { label: '⬇️ Please choose the chain to which you want to add the token in', options: json };
}

export const json_selectDexOption = (groupId, chainId) => {

	let json = [];

	const filteredList = afx.dexList.filter(opt => opt.chainId == chainId)

	for (const dex of filteredList) {
		json.push({ label: dex.title, command: OPTION_INPUT_TOKEN_ADDRESS, id: `${groupId}:${chainId}:${dex.id}` })
	}

	json.push({ label: 'Back', command: OPTION_SELECT_CHAIN, id: groupId })

	return { label: '⬇️ Please choose one of below DEXs', options: json };
}

const json_showPairsOption = async (groupId) => {

	const tokens = await database.showAllTokens(groupId)

	let json = [];
	for (const token of tokens) {
		let chain = afx.chainList.find(opt => opt.id == token.chain)
		if (!chain) {
			chain = { title: 'Unknown'}
		}

		json.push({ address: token.address, chain: chain.title, command: OPTION_DELETE_TOKEN, id: token._id.toString() })
	}

	json.push({ label: 'Remove All Tokens', command: OPTION_DELETE_ALL_TOKEN, id: groupId })
	json.push({ label: 'Back', command: OPTION_MAIN_SETTING, id: groupId })

	return { label: 'Click the button to remove the token you want', options: json };
}

const getWelcomeMessage = (isGroupChat) => {

	let suffixCmd = isGroupChat ? `@${myInfo.username}` : ''

	return `👋This is the official ${myInfo.first_name} bot deployed by Genie Bot Team.

🙂Owner can use /${COMMAND_START}${suffixCmd} message to show welcome message again.

The bot can track purchases of every token on multiple EVM-compatible blockchains!
⬇️ To setup this bot, click on the button below!`

}

export function sendMessage(chatid, message) {
	try {
		bot.sendMessage(chatid, message, { parse_mode: 'HTML', disable_web_page_preview : false })

		return true
	} catch (error) {
		console.error(error)
	}

	return false
}

export function sendAnimation(chatid, file_id, message) {
	
	bot.sendAnimation(chatid, file_id, { caption: message, parse_mode: 'HTML', disable_web_page_preview : false }).catch((err) => {
		console.log('\x1b[31m%s\x1b[0m', `sendAnimation Error: ${chatid} ${err.response.body.description}`);
	});
}

export function sendPhoto(chatid, file_id, message) {
	bot.sendPhoto(chatid, file_id, { caption: message, parse_mode: 'HTML', disable_web_page_preview : false }).catch((err) => {
		console.log('\x1b[31m%s\x1b[0m', `sendPhoto Error: ${chatid} ${err.response.body.description}`);
	});
}

export function sendOptionMessage(chatid, message, option) {
	
	bot.sendMessage(chatid, message, option).catch((err) => {
		console.log('\x1b[31m%s\x1b[0m', `sendOptionMessage Error: ${chatid} ${err.response.body.description}`);
	});
}

export function broadcast(message) {
	for (const session of sessions) {
		sendMessageToAuthorizedUser(session, message)
	}
}

export function sendLoginSuccessMessage(session) {

	if (session.type === 'private') {
		sendMessage(session.chatid, `You successfully logged in with your wallet`)
		console.log(`@${session.username} user has successfully logged in with the wallet ${session.wallet}`);
	} else if (session.type === 'group') {
		sendMessage(session.adminid, `@${session.username} group has been successfully logged in with your wallet`)
		console.log(`@${session.username} group has successfully logged in with the owner's wallet ${session.wallet}`);
	}
}

export function showSessionLog(session) {

	if (session.type === 'private') {
		console.log(`@${session.username} user session has been created.`)
	} else if (session.type === 'group') {
		console.log(`@${session.username} group session has been created.`)
	}
}

export function showUserLog(user) {

	console.log(`@${user.username} user info has been created.`)
}

export const createUser = (info) => {

	//chatid, username, type
	let user = {
		chatid: info.chatid,
		username: info.username,
		bot_referral_link: info.bot_referral_link,
		referred_by: info.referred_by,
		wallet: info.wallet
	}

	users.set(user.chatid, user)

	return user;
}

export const updateUser = async (info) => {
	let user = users.get(info.chatid);
	if (user) {
		user.chatid = info.chatid,
		user.username = info.username,
		user.bot_referral_link = info.bot_referral_link,
		user.referred_by = info.referred_by,
		user.wallet = info.wallet
	}
}

export const createSession = (user) => {

	//chatid, username, type
	let session = {
		chatid: user.chatid,
		username: user.username,
		type: user.type,
		adminid: user.adminid,
		logo_img: user.logo_img,
		logo_img_type: user.logo_img_type,
		bullet_img: user.bullet_img,
		referral_link: user.referral_link,
	}

	sessions.set(session.chatid, session)

	return session;
}

export const updateSession = async (user) => {
	let session = sessions.get(user.chatid);
	if (session) {
		session.chatid = user.chatid
		session.username = user.username
		session.type = user.type;
		session.adminid = user.adminid;
		session.logo_img = user.logo_img;
		session.logo_img_type = user.logo_img_type;
		session.bullet_img = user.bullet_img;
		session.referral_link= user.referral_link;
	}
}

export async function init(db) {
	database = db
	const sessionsFromDB = await database.selectSessions()

	for (const sess of sessionsFromDB) {
		let session = createSession(sess);
		showSessionLog(session)
	}

	const usersFromDB = await database.selectUsers()

	for (const user of usersFromDB) {
		let session = createUser(user);
		showUserLog(session)
	}
}

async function isPermit(session) {
	const user = await database.selectSession({chatid: session.chatid})
	return user.permit;
}

bot.on('message', async (message) => {

	// console.log(`========== message ==========`)
	// console.log(message)
	// console.log(`=============================`)

	const msgType = message?.chat?.type;

	if (msgType === 'private') {
		procMessage_private(message);

	} else if (msgType === 'group' || msgType === 'supergroup') {
		procMessage_group(message);
	} 
})

const executeCommand = async (chatid, messageId, callbackQueryId, option) => {

	const cmd = option.c;
	const id = option.i;

	//stateMap_clear();

	try {
		if (cmd === OPTION_SELECT_GROUP) {

			const adminId = id;
			assert(adminId)

			const editMsg = (adminId === chatid ? true : false)
			const menu = await json_selectGroupOption(adminId);

			try {
				await displayMenu(adminId, messageId, menu, editMsg)
			} catch (error) {

				const resp = error?.response;
				if (resp && resp.body?.error_code == 403) {
					sendMessage(chatid, `Please send /start message to the bot via private chat before attempting again.`)	
				}

				console.log(resp)
			}

			stateMap_remove(adminId)

		} else if (cmd === OPTION_CANCEL) {

			await bot.editMessageText(`✔️ Operation cancelled!
Do /start if you want to do something else.`, {chat_id: chatid, message_id: messageId })

			stateMap_remove(chatid)

		} else if (cmd === OPTION_MAIN_SETTING) {

			const groupId = id
			assert(groupId)

			stateMap_set(chatid, STATE_IDLE, {groupId})

			const menu = await json_mainSettingOption(groupId, chatid);
			await displayMenu(chatid, messageId, menu);

		} else if (cmd === OPTION_SELECT_CHAIN) {

			const groupId = id
			assert(groupId)

			const menu = await json_selectChainOption(groupId);
			await displayMenu(chatid, messageId, menu);

		} else if (cmd === OPTION_SELECT_DEX) {

			const parts = id.split(':')
			assert(parts.length == 2)
			const groupId = parts[0]
			const chainId = parseInt(parts[1])
			assert(groupId)
			assert(chainId > 0)

			const menu = await json_selectDexOption(groupId, chainId);
			await displayMenu(chatid, messageId, menu);

		} else if (cmd === OPTION_SHOW_TOKEN_LIST) {

			const groupId = id
			assert(groupId)

			const menu = await json_showPairsOption(groupId);
			await displayPairs(chatid, messageId, menu);

		} else if (cmd === OPTION_DELETE_ALL_TOKEN) {

			const groupId = id
			assert(groupId)

			const result = await database.removeTokenBySession(groupId)

			if (result.deletedCount > 0) {
				// sendMessage(chatid, `✅ All of pool addresses you added has been successfully removed.`)	
				await bot.answerCallbackQuery(callbackQueryId, { text: `Successfully removed` })

				let stateNode = stateMap_get(chatid)
				if (stateNode) {
					executeCommand(chatid, messageId, callbackQueryId, {c: OPTION_SHOW_TOKEN_LIST, i: stateNode.data.groupId })
				}
			}
		} else if (cmd === OPTION_DELETE_TOKEN) {

			const tokenId = id
			assert(tokenId)

			await database.removeToken(tokenId)
			//sendMessage(chatid, `✅ The pool addresses you selected has been successfully removed.`)
			await bot.answerCallbackQuery(callbackQueryId, { text: `Successfully removed` })

			let stateNode = stateMap_get(chatid)
			if (stateNode) {
				executeCommand(chatid, messageId, callbackQueryId, {c: OPTION_SHOW_TOKEN_LIST, i: stateNode.data.groupId })
			}

		} else if (cmd === OPTION_INPUT_TOKEN_ADDRESS) {

			const parts = id.split(':')
			assert(parts.length == 3)
			const groupId = parts[0]
			const chainId = parseInt(parts[1])
			const dexId = parseInt(parts[2])
			assert(groupId)
			assert(chainId > 0)
			assert(dexId > 0)
			
			const msg = `Kindly provide token address`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })

			stateMap_set(chatid, STATE_INPUT_POOL_ADDRESS, {groupId, chainId, dexId})

		} else if (cmd === OPTION_INPUT_LOGO_IMAGE) {

			const groupId = id
			assert(groupId)
			
			const msg = `Kindly attach a image file you want to set`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })

			stateMap_set(chatid, STATE_INPUT_LOGO_IMAGE, { groupId })

		} else if (cmd === OPTION_INPUT_BULLET_EMOJI) {

			const groupId = id
			assert(groupId)
			
			const msg = `Kindly input a emoji character you want to set`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })

			stateMap_set(chatid, STATE_INPUT_BULLET_EMOJI, { groupId })

		} else if (cmd === OPTION_INPUT_REFERRAL_LINK) {

			const groupId = id
			assert(groupId)
			
			const msg = `Kindly input a referral link you want to set`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })

			stateMap_set(chatid, STATE_INPUT_REFFERAL_LINK, { groupId })
		} else if (cmd === OPTION_BOT_REFERRAL) {

			const adminId = id
			assert(adminId)

			const editMsg = (adminId === chatid ? true : false)

			const menu = await json_botReferralOption(adminId);

			try {
				await displayMenu(adminId, messageId, menu, editMsg)
			} catch (error) {

				const resp = error?.response;
				if (resp && resp.body?.error_code == 403) {
					sendMessage(chatid, `Please send /start message to the bot via private chat before attempting again.`)	
				}

				console.log(resp)
			}

		} else if (cmd === OPTION_BOT_REFERRAL_REFERRAL) {

			const adminId = id
			assert(adminId)

			let user = users.get(chatid)
			if (!user) {
				return
			}

			const referrals = await database.countUsers({referred_by : chatid})
			const rewards = await database.countReward({chatid : chatid})
			const earned1 = await database.getEarning({chatid : chatid })
			const earned2 = await database.getEarning({chatid : chatid, paid: 0 })

			let walletMsg = user.wallet ? user.wallet : 'Not specified'

const message = `🎁 Your Referral Dashboard

👭 You have total : ${utils.roundDecimal(referrals, 0)} referrals (${utils.roundDecimal(rewards, 2)} times rewarded)
💸 Expected total earnings  : $ ${utils.roundDecimal(earned1, 2)}
 ($  ${utils.roundDecimal(earned2, 2)} Withdrawal is available every 15th and 30th of the month
Note: Payment is made on groups that achieve trading volume only

🔗 Your referral link : 
${user.bot_referral_link}

🔗 Your withdraw wallet : ${walletMsg}

Maximize your earnings potential by sharing your referral link!
You'll get $${process.env.BOT_REFERRAL_MONEY} for every invite our bot to another users.`
			sendMessage(chatid, message)
		} else if (cmd === OPTION_BOT_REFERRAL_WITHDRAW) {

			const adminId = id
			assert(adminId)
			
			const msg = `Kindly input your withdrawal wallet`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })

			stateMap_set(chatid, STATE_INPUT_WITHDRAWAL_WALLET, { adminId })
		} else if (cmd === OPTION_BOT_REFERRAL_INFORMATION) {

			const message = `Genie Bot. 
 
Is a profit model that offers two types of commission referrals.  
 
The first type is designed to enable telegram group owners to track their preferred tokens and can also benefit from their communities by earning commission via a unique referral link that can be obtained once you 
Connect your wallet to http://www.volleydex.com/ And paste the link into the bot when you click on the option: Set Buy Referral link. 
 
The Genie bot referral link earns 50% of the value of the trading fee made through your group. 
 
We also note that the number of members of society should not be less than 25 real people. 
 
Type II 
 
"Friends Referral Program" 
 
It is a software dedicated to all users so that you can invite a friend and earn 2 USDT by clicking on: 
Bot Referral Setting, 
It will show you a new referral link to share it with your friends. 
 
NOTE: 
 
Whenever the friendly community you invited is active, the bonus will be increased starting from $2 to $100 
 
NOTE: 
 
Whoever attempts to create fictitious societies will be excluded as the groups will be manually reviewed thoroughly. 
 
ALSO: 
The rewards are evaluated based on the activity of the groups.`

			sendMessage(chatid, message)
		}
	} catch (error) {
		afx.error_log('executeCommand', error);
		sendMessage(chatid, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		await bot.answerCallbackQuery(callbackQueryId, { text: `😢 Sorry, there was some errors on the command. Please try again later 😉` })
	}
}

bot.on('callback_query', async (callbackQuery) => {

	// console.log('========== callback query ==========')
	// console.log(callbackQuery)
	// console.log('====================================')

	const message = callbackQuery.message;

	const option = JSON.parse(callbackQuery.data);
	let chatid = message.chat.id.toString();

	const cmd = option.c;
	const id = option.i;

	executeCommand(chatid, message.message_id, callbackQuery.id, option)
});


const procMessage_private = async (msg) => {

	// console.log('========== message ==========')
	// console.log(msg)
	// console.log('====================================')

	const privateId = msg.chat?.id.toString()

	let stateNode = stateMap_get(privateId)
	if (stateNode) {
		if (stateNode.state === STATE_INPUT_POOL_ADDRESS) {
			if (!utils.isValidAddress(msg.text.trim())) {
				sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
				return
			}

			await database.addToken(stateNode.data.groupId, msg.text.trim(), stateNode.data.chainId, stateNode.data.dexId)
			sendMessage(privateId, `✅ Successfuly added`)

			stateMap_set(privateId, STATE_IDLE, {groupId : stateNode.data.groupId})
			return;
		} else if (stateNode.state === STATE_INPUT_LOGO_IMAGE) {
			if (msg.photo && msg.photo.length > 0) {

				let fileId = undefined
				let repCount = 2
				for (const node of msg.photo) {
					repCount--
					if (node.width === 320 || repCount <= 0) {
						fileId = node.file_id
						break
					}
				}

				if (!fileId) {
					fileId = msg.photo[0].file_id
				}

				const user = await database.appendLogo(stateNode.data.groupId, fileId, 'photo')
				if (user) {
					updateSession(user)
				}
				sendMessage(privateId, `✅ Successfuly attached (photo)`)
				stateMap_set(privateId, STATE_IDLE, {groupId : stateNode.data.groupId})
				return
			}

			if (msg.animation) {
				const fileId = msg.animation.file_id
				const user = await database.appendLogo(stateNode.data.groupId, fileId, 'animation')
				if (user) {
					updateSession(user)
				}
				sendMessage(privateId, `✅ Successfuly attached`)
				stateMap_set(privateId, STATE_IDLE, {groupId : stateNode.data.groupId})
				return
			}

			sendMessage(privateId, `🚫 Unrecorgnized file format`)

		} else if (stateNode.state === STATE_INPUT_BULLET_EMOJI) {
			if (msg.text.trim().length > 2) {
				sendMessage(privateId, `🚫 Sorry, the bullet emoji character must be only one character in length`)
				return
			}

			const session = sessions.get(stateNode.data.groupId)
			assert(session)

			session.bullet_img = msg.text.trim()

			database.updateSession(session)

			sendMessage(privateId, `✅ Successfuly replaced`)

			stateMap_set(privateId, STATE_IDLE, {groupId : stateNode.data.groupId})
			return;

		} else if (stateNode.state === STATE_INPUT_REFFERAL_LINK) {
			// if (msg.text.trim().length > 2) {
			// 	sendMessage(privateId, `🚫 Sorry, the referal link must be only one character in length`)
			// 	return
			// }

			const session = sessions.get(stateNode.data.groupId)
			assert(session)

			session.referral_link = msg.text.trim()

			database.updateSession(session)

			sendMessage(privateId, `✅ Referral link updated`)

			stateMap_set(privateId, STATE_IDLE, {groupId : stateNode.data.groupId})
			return;

		} else if (stateNode.state === STATE_INPUT_WITHDRAWAL_WALLET) {

			if (!utils.isValidAddress(msg.text.trim())) {
				sendMessage(privateId, `🚫 Sorry, the wallet you entered is invalid. Please input again`)
				return
			}

			const user = users.get(stateNode.data.adminId)
			assert(user)

			user.wallet = msg.text.trim()

			database.updateUser(user)

			sendMessage(privateId, `✅ Withdrawal wallet address updated`)

			stateMap_set(privateId, STATE_IDLE, {adminId : stateNode.data.adminId})
			return;
		}
	}

	if (!msg.text || !msg.entities) {
		return;
	}

	let command = msg.text;
	let params = []
	for (const entity of msg.entities) {
		if (entity.type === 'bot_command') {
			command = command.substring(entity.offset, entity.offset + entity.length);

			let param_text = msg.text.substring(entity.offset + entity.length + 1)
			params = param_text.split(' ')
			break;
		}
	}

	if (command.includes('@')) {
		const parts = command.split('@');

		if (parts.length !== 2) {
			return;
		}

		command = parts[0];
		if (parts[1] !== myInfo.username) {
			return;
		}
	}

	// command always start from slash
	command = command.slice(1);
	if (command === COMMAND_START) {

		let user = users.get(privateId)
		if (!user) {
			let userName = msg?.chat?.username

			let referred_by = null
			if (params.length == 1 && params[0].trim() !== '') {
				referred_by = utils.decodeReferralCode(params[0].trim())

				if (referred_by === privateId) {
					referred_by = null
				} else if (referred_by.length > 0) {
					sendMessage(privateId, `You are invited by ${referred_by}`)
				} else {
					referred_by = null
				}
			}

			registerUser(privateId, userName, referred_by)
		}

		sendOptionMessage(privateId, getWelcomeMessage(false), json_botSettings(privateId));

	} else if (command === COMMAND_TEST) {

		test()
	}
}

export const registerUser = (privateId, userName, referred_by) => {

	if (!database) {
		return
	}

	const bot_referral_link = utils.generateReferralLink(myInfo.username, privateId)
	const user = createUser({chatid: privateId, username: userName, bot_referral_link: bot_referral_link, wallet: null})

	if (referred_by) {
		user.referred_by = referred_by
	}

	database.updateUser(user)
	showUserLog(user)
}

export const test = () => {

	const json1 = {
		message_id: 7480,
		from: {
		  id: 5925068254,
		  is_bot: false,
		  first_name: 'hellenistic',
		  username: 'hellenistic00',
		  language_code: 'en'
		},
		chat: {
		  id: -966782096,
		  title: 'testing',
		  type: 'group',
		  all_members_are_administrators: true
		},
		date: 1686211429,
		group_chat_created: true
	  }
	const json2 = {
		message_id: 7481,
		from: {
		  id: 5925068254,
		  is_bot: false,
		  first_name: 'hellenistic',
		  username: 'hellenistic00',
		  language_code: 'en'
		},
		chat: {
		  id: -981825415,
		  title: 'testing again',
		  type: 'group',
		  all_members_are_administrators: true
		},
		date: 1686211501,
		new_chat_participant: {
		  id: 6284917720,
		  is_bot: true,
		  first_name: 'GenieBuyTracker Bot',
		  username: 'GenieBuyTracker_bot'
		},
		new_chat_member: {
		  id: 6284917720,
		  is_bot: true,
		  first_name: 'GenieBuyTracker Bot',
		  username: 'GenieBuyTracker_bot'
		},
		new_chat_members: [
		  {
			id: 6284917720,
			is_bot: true,
			first_name: 'GenieBuyTracker Bot',
			username: 'GenieBuyTracker_bot'
		  }
		]
	  }

	  procMessage_group(json2)
}
export const procMessage_group = async (msg) => {

	console.log(`========== message ==========`)
	console.log(msg)
	console.log(`=============================`)

	const pub_chatid = msg?.chat?.id.toString();
	const from_chatid = msg?.from?.id.toString();

	if (msg.new_chat_title) {
		// Changed the Group title
		session = sessions.get(pub_chatid)
		if (session) {
			session.username = msg.new_chat_title
			await database.updateSession(session)

			console.log(`Group title '${session.username}' has been changed to '${msg.new_chat_title}'`)

		}

		return
	}

	if (msg.left_chat_participant) {
		// This bot has been kicked out

		if (msg.left_chat_participant.id.toString() === myInfo.id.toString()) {
			session = sessions.get(pub_chatid)
			if (session) {
				await database.removeSession(session);

				console.log(`The bot has been kicked out from the group @'${session.username}`)

				sessions.delete(session.chatid);
			}
		}

		return
	}

	let groupName = msg?.chat?.title;
	let fromUserName = msg?.from?.username;

	if (!from_chatid || !groupName) {
		return;
	}

	let chatMember = null;
	try {
		chatMember = await bot.getChatMember(pub_chatid, from_chatid);
	} catch (err) {
		console.error(err);
		return;
	}

	let isOwner = (chatMember.status === 'creator');

	let isBotLeftFromGroup = (msg.left_chat_member && msg.left_chat_member.id === bot.options.id) || (msg.banned_chat_member && msg.banned_chat_member.id === bot.options.id);
	
	let session = sessions.get(pub_chatid)

	if (isBotLeftFromGroup && session) {

		await database.removeSession(session);
		sessions.delete(session.chatid);

        sendMessage(pub_chatid, 'Bot has been left the group chat');
		return;

	} else if (!session) {

		if (!groupName) {
			console.log(`Rejected anonymous group incoming connection. chatid = ${pub_chatid}`);
			return;
		}

		session = createSession({chatid: pub_chatid, username: groupName, type: 'group', bullet_img: '🟢'});
		session.permit = 1;
		session.adminid = from_chatid;

		await database.updateSession(session)
		
	} else {

		if (session.adminid !== from_chatid) {
			session.adminid = from_chatid;
			await database.updateSession(session)
		}
	}

	session.permit = 1; //await isPermit(session) ? 1 : 0;

	if (session.permit !== 1) {
		sendMessage(from_chatid, `😇Sorry, but @${session.username} group does not have permission to use alphBot. If this group would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thank you for your understanding.`);
		return;
	}

    if (!isOwner) {
		sendMessage(from_chatid, 'Only group owner can control the bot.');
		return;  
	}

	let isGroupCreatedOrBotAdded = (msg?.group_chat_created || msg?.supergroup_chat_created || msg?.new_chat_member?.id === myInfo.id );
	if (isGroupCreatedOrBotAdded) {

		sendOptionMessage(pub_chatid, getWelcomeMessage(true), json_botSettings(from_chatid));

		let user = users.get(from_chatid)
		if (!user) {
			user = registerUser(from_chatid, fromUserName, null)
		}

		if (!user) {
			return
		}

		if (user.referred_by && user.referred_by != from_chatid) {

			let reward = Number(process.env.BOT_REFERRAL_MONEY)

			const item = database.addReward(user.referred_by, from_chatid, pub_chatid, reward)
			if (item) {
				console.log(user.referred_by, "user rewarded", reward, "due to", from_chatid, "invited the bot in his group")
			}
		}
			
		return;
	}

	if (!msg.text || !msg.entities) {
		return;
	}

	let command = msg.text;
	for (const entity of msg.entities) {
		if (entity.type === 'bot_command') {
			command = command.substring(entity.offset, entity.offset + entity.length);
			break;
		}
	}

	if (!command.includes('@')) {
		return;
	}

	const parts = command.split('@');

	if (parts.length !== 2) {
		return;
	}

	command = parts[0];
	if (parts[1] !== myInfo.username) {
		return;
	}

	// command always start from slash
	command = command.slice(1);
	if (command === COMMAND_START) {
		sendOptionMessage(pub_chatid, getWelcomeMessage(true), json_botSettings(from_chatid));
	}
}

export const notify = (chatids, result) => {

//{ balance: { coinBalance, coinTag, usdPrice }, tokenInfo: this.tokenInfo }name, symbol, decimal
// console.log('notify', chatids)

	chatids.forEach(chatid => {

		const session = sessions.get(chatid)
		if (!session) {
			return
		}

		const bc = session.bullet_img
		var bullet_msg = ''
		if (bc !== undefined && bc.length > 0) {
			
			let count = parseInt(Number(result.balance.usdPrice) / Number(process.env.USD_PER_BULLET))

			if (count > 100) {
				count = 100
			}
			
			for (let i = 1; i <= count; i++) {
				bullet_msg += bc
			}

			if (count > 0)
				bullet_msg += '\n' 
		}

		let referral_link = '#'
		if (session.referral_link)
			referral_link = session.referral_link
 
		const message = `⚡ Genie Buy!
Spent: $${utils.roundDecimal(result.balance.usdPrice, 2)} (${utils.roundDecimal(result.balance.coinBalance, 10)} ${result.balance.coinTag})
Got: ${utils.roundDecimal(result.amountOut, 5)} ${result.tokenInfo.symbol}
Price: ${utils.roundDecimal(result.tokenPrice, 10)} (${utils.roundDecimal(result.tokenPriceInCoin, 10)} ${result.balance.coinTag})
MCap: $${utils.roundDecimal(result.marketCap, 3)}

<a href="${result.link.TX}">TX</a> | <a href="${referral_link}">Buy</a>
`

/* <a href="${result.link.TX}">TX</a> | <a href="${result.link.Chart}${myInfo.username}">Chart</a> | <a href="${result.link.Swap}">${result.link.SwapName}</a> | <a href="${result.link.Buyer}">Buyer</a>
<a href="https://t.me/${myInfo.username}">TG</a> | <a href="${process.env.OFFICIAL_URL}">Web</a> | <a href="${process.env.OFFICIAL_TWITER}">Twitter</a> | <a href="${process.env.OFFICIAL_DISCORD}">Discord</a> */
		const eachMessage = `${bullet_msg}${message}`

		if (session.logo_img) {
			if (session.logo_img_type === 'animation') {

				sendAnimation(chatid, session.logo_img, eachMessage)
 
			} else if (session.logo_img_type === 'photo') {

				sendPhoto(chatid, session.logo_img, eachMessage) 
			}
		}
		else {
			sendMessage(chatid, eachMessage)
		}

	});

	console.log(result);
}