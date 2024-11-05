import express from "express";

import dotenv from 'dotenv'
dotenv.config()

import {Reward, User} from '../model.js'

export default (web3, database, bot) => {

    var router = express.Router();

    router.post('/users-data', (req, res) => {
        User.find({}).then(async users => {
            if (users) {

                let result = []
                for (const user of users) {

                    const referrals = await database.countUsers({referred_by : user.chatid})
                    const rewards = await database.countReward({chatid : user.chatid})
                    const earned1 = await database.getEarning({chatid : user.chatid })
                    const earned2 = await database.getEarning({chatid : user.chatid, paid: 0 })

                    const json = { chatid: user.chatid, username: user.username, bot_referral_link: user.bot_referral_link, referred_by: user.referred_by, wallet: user.wallet, 
                        count_referred : referrals, rewarded: rewards, earned: earned1, pending: earned2
                    }

                    result.push(json)
                }

                return res.status(200).send(result);
            }
        }); 
    });

    router.post('/users-get-pending', async (req, res) => {
        const earned2 = await database.getEarning({chatid : req.body.chatid, paid: 0 })
        
        return res.status(200).send({pending: earned2});
    });

    router.post('/user-pay', async (req, res) => {

        let count = 0, paid = 0

        const user = await User.findOne({chatid: req.body.chatid})

        if (user) {
            if (!user.wallet) {
                return res.status(200).send({ message: 'User does not have wallet', count, paid});  
            }
            const result = await database.payPendingReward(req.body.chatid)
            if (result) {
                count = result.modifiedCount
                paid = count * Number(process.env.BOT_REFERRAL_MONEY)

                return res.status(200).send({ message: `$${paid} Payment done.`, count, paid});
            }

            return res.status(200).send({ message: `Payment failed.`, count, paid});
        }

        return res.status(200).send({ message: 'Payment done.', count, paid});
    });
    
    router.post('/user-msg', async (req, res) => {
        
        const chatid = req.body.chatid
        const message = req.body.message

        console.log(`Admin Message has been sent to @${req.body.username} : ${message}`)

        if (chatid && message) {
            if (await bot.sendMessage(chatid, message)) {
                return res.status(200).json({ message: 'Message sent!'});
            }
        }

        return res.status(200).json({ message: 'Failed to send!'});
    });

    router.post('/users-delete', (req, res) => {
        User.deleteOne({ _id: req.body._id}).then(user => {
            if (user) {
                return res.status(200).json({message: 'Session deleted successfully. Refreshing data...', success: true})
            }
        });
    });

    return router;
}

