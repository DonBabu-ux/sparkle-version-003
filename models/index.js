// models/index.js - aggregates all model exports
const Message = require('./Message');
const GroupChat = require('./GroupChat');
const GroupMember = require('./GroupMember');
const User = require('./User');
const UserTab = require('./UserTab');
const Club = require('./Club');
const Confession = require('./Confession');
const EmailVerification = require('./EmailVerification');
const Group = require('./Group');
const LostFound = require('./LostFound');
const Marketplace = require('./Marketplace');
const MemoryMarketplace = require('./MemoryMarketplace');
const PasswordReset = require('./PasswordReset');
const Post = require('./Post');
const SkillMarket = require('./SkillMarket');

module.exports = {
  Message,
  GroupChat,
  GroupMember,
  User,
  UserTab,
  Club,
  Confession,
  EmailVerification,
  Group,
  LostFound,
  Marketplace,
  MemoryMarketplace,
  PasswordReset,
  Post,
  SkillMarket
};
