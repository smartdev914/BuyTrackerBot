import express from "express";

import * as database from '../db.js'
import * as utils from '../utils.js'
import * as bot from '../bot.js'
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import dotenv from 'dotenv'
dotenv.config()

import {User, Session, Reward} from '../model.js'

export default (web3, database, bot) => {
    var router = express.Router();

    router.post('/dashboard-data', async (req, res) => {

        let result = {}

        try {

            result.sessionCount = await Session.countDocuments({})
            result.userCount = await User.countDocuments({})
            result.totalEarning = await database.getEarning({})
            result.pending = await database.getEarning({paid: 0})
            result.rewardCount = await Reward.countDocuments({})
            result.referralCount = await database.countUsers({referred_by : {$ne: null}})

        } catch (err) {

            result.sessionCount = 0
            result.userCount = 0
            result.totalEarning = 0
            result.pending = 0
            result.rewardCount = 0
            result.referralCount = 0
        }

        return res.status(200).json(result)
    });

    return router;
}

