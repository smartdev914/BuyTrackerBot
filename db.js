
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Types;

import { User, Session, Token, Reward } from './model.js';

export const init = () => {

  return new Promise(async (resolve, reject) => {

    mongoose.connect('mongodb://localhost:27017/geniebuytrackerbot')
      .then(() => {
        console.log('Connected to MongoDB...')
        resolve();
      })
      .catch(err => {
        console.error('Could not connect to MongoDB...', err)
        reject();
      });
  });
}

export async function selectUsers(params = {}) {

  return new Promise(async (resolve, reject) => {
    User.find(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function selectUser(params) {

  return new Promise(async (resolve, reject) => {
    User.findOne(params).then(async (user) => {
      resolve(user);
    });
  });
}

export async function countUsers(params) {

  return new Promise(async (resolve, reject) => {
    User.countDocuments(params).then(async (count) => {
      resolve(count);
    });
  });
}

export async function countReward(params) {

  return new Promise(async (resolve, reject) => {
    Reward.countDocuments(params).then(async (count) => {
      resolve(count);
    });
  });
}

export const updateUser = (params) => {

  return new Promise(async (resolve, reject) => {
    User.findOne({ chatid: params.chatid }).then(async (user) => {

      if (!user) {
        user = new User();
      } 

      user.chatid = params.chatid
      user.username = params.username
      user.bot_referral_link = params.bot_referral_link;
      user.referred_by = params.referred_by;
      user.wallet = params.wallet;

      await user.save();

      resolve(user);
    });
  });
}

export const updateSession = (params) => {

  return new Promise(async (resolve, reject) => {
    Session.findOne({ chatid: params.chatid }).then(async (session) => {

      if (!session) {
        session = new Session();
      } 

      session.chatid = params.chatid
      session.username = params.username
      session.type = params.type;
      session.adminid = params.adminid;
      session.logo_img = params.logo_img;
      session.logo_img_type = params.logo_img_type;
      session.bullet_img = params.bullet_img;
      session.referral_link = params.referral_link;
      //user.permit = (params.permit === 1 ? 1 : 0);

      await session.save();

      resolve(session);
    });
  });
}

export const removeSession = (params) => {
  return new Promise((resolve, reject) => {
    Session.deleteOne({ chatid: params.chatid }).then(() => {
        resolve(true);
    });
  });
}

export async function selectSessions(params = {}) {

  return new Promise(async (resolve, reject) => {
    Session.find(params).then(async (sessions) => {
      resolve(sessions);
    });
  });
}

export async function selectSession(params) {

  return new Promise(async (resolve, reject) => {
    Session.findOne(params).then(async (session) => {
      resolve(session);
    });
  });
}

export async function addToken(chatid, address, chain, dex) {

  return new Promise(async (resolve, reject) => {
    Token.findOne({chatid, address, chain}).then(async (token) => {

      if (!token) {
        token = new Token();
      }

      token.chatid = chatid;
      token.address = address.toLowerCase();
      token.chain = chain;
      token.dex = dex;

      await token.save();

      resolve(token);
    });
  });
}

export async function showAllTokens(chatid) {

  return new Promise(async (resolve, reject) => {
    Token.find({chatid}).then(async (tokens) => {
      resolve(tokens);
    });
  });
}

export async function getAllTokens() {

  return new Promise(async (resolve, reject) => {
    Token.find({}).then(async (tokens) => {

      resolve(tokens);
    });
  });
}

export async function removeToken(_id) {

  return new Promise(async (resolve, reject) => {
    Token.findByIdAndDelete(new ObjectId(_id)).then(async () => {
      resolve(true);
    });
  });
}

export async function removeTokenBySession(chatid) {

  return new Promise(async (resolve, reject) => {
    Token.deleteMany({chatid}).then(async (result) => {
      resolve(result);
    });
  });
}

export async function appendLogo(chatid, url, type) {

  return new Promise(async (resolve, reject) => {
    Session.findOne({chatid}).then(async (session) => {

      if (session) {
        session.logo_img = url
        session.logo_img_type = type

        await session.save();

        resolve(session);
      }

      resolve(null);
    });
  });
}

export async function getEarning(params) {

  const result = await Reward.aggregate([
    { $match: params },
    { $group: {_id: null, value: {$sum: "$reward"}} }
  ]).exec()

  if (result.length > 0)
    return Number(result[0].value)

  return 0
}

export async function payPendingReward(chatid) {

  try {
    const result = await Reward.updateMany({chatid:chatid}, {$set : {paid : 1}})

    return result
  } catch (error) {
    console.log(error)
  }

  return null
}

export const addReward = async (chatid, referred_id, session_id, reward) => {

  return new Promise(async (resolve, reject) => {
    Reward.findOne({chatid, referred_id, session_id}).then(async (item) => {

      if (!item) {
        item = new Reward();

        item.chatid = chatid
        item.referred_id = referred_id
        item.session_id = session_id

        item.reward = reward
        item.paid = 0

        await item.save();

        resolve(item);

      }

      resolve(null);
    });
  });
}


export async function removeReward(_id) {

  return new Promise(async (resolve, reject) => {
    Reward.findByIdAndDelete(new ObjectId(_id)).then(async () => {
      resolve(true);
    });
  });
}
