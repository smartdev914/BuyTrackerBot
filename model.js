
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    chatid: String,
    username: String,
    bot_referral_link: String,
    referred_by: String,
    wallet: String,
  });
  
const sessionSchema = new mongoose.Schema({
  chatid: String,
  username: String,
  type: String,
  permit:Number,
  adminid: String,
  logo_img: String,
  logo_img_type: String,
  bullet_img: String,
  referral_link: String,
});

const tokenSchema = new mongoose.Schema({
  chatid: String,
  address: String,
  chain: Number,
  dex: Number,
});

const rewardSchema = new mongoose.Schema({
  chatid: String,
  referred_id: String,
  session_id: String,
  reward: Number,
  paid: Number
});
  
const adminSchema = new mongoose.Schema({
  name: {
      type: String,
      required: true
  },
  password: {
      type: String,
      required: true
  },
  email: {
    type: String,
    required: true
  },
  permission: {
    type: String,
    required: true
  },
  date: {
      type: Date,
      default: Date.now
  }
});

adminSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

adminSchema.set('toJSON', {
    virtuals: true
});

sessionSchema.virtual('id').get(function(){
    return this._id.toHexString();
});

sessionSchema.set('toJSON', {
    virtuals: true
});

userSchema.virtual('id').get(function(){
  return this._id.toHexString();
});

userSchema.set('toJSON', {
  virtuals: true
});

export const User = mongoose.model('users', userSchema);
export const Session = mongoose.model('sessions', sessionSchema);
export const Token = mongoose.model('tokens', tokenSchema);
export const Reward = mongoose.model('rewards', rewardSchema);
export const Admin = mongoose.model('admins', adminSchema);