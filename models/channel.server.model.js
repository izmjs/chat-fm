/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const { resolve } = require('path');

// eslint-disable-next-line import/no-dynamic-require
const config = require(resolve('./config'));
const { getDocKey } = require('../helpers/main.server.helper');

const {
  model,
  Types,
  Schema,
} = mongoose;

const ChannelSchema = new Schema({
  name: {
    type: String,
    trim: true,
  },
  owner: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['private', 'internal', 'public', 'p2p'],
    default: 'private',
  },
  archived: {
    type: Boolean,
    default: false,
  },
  users: {
    type: [{
      user: {
        type: Types.ObjectId,
        required: true,
        ref: 'User',
      },
      isAdmin: Boolean,
      mute: Boolean,
      last_seen: Date,
    }],
  },
  last_msg: Date,
}, {
  timestamps: config.lib.mongoose.timestamps,
  collection: 'chat-channels',
});

/**
 * Check if a user is an admin
 */
ChannelSchema.methods.isAdmin = function userIsAdmin(u) {
  const oId = getDocKey(this.owner);
  const uId = getDocKey(u);

  if (!uId) {
    return false;
  }

  const { users = [] } = this;
  return uId === oId
    || users.filter(({ user, isAdmin }) => uId === getDocKey(user) && isAdmin);
};

/**
 * Touch a channel, and update the last message date
 */
ChannelSchema.methods.touch = function touch(isSave = true) {
  this.last_msg = new Date();
  if (!isSave) {
    return this;
  }
  return this.save();
};

/**
 * List user channels and return a query
 * @param { Object } user The user
 */
ChannelSchema.statics.userChannels = function userChannels(user) {
  const $or = [{
    type: 'public',
  }];
  const filter = {
    $and: [{
      archived: {
        $in: [false, null],
      },
    }, { $or }],
  };

  if (user) {
    $or.push({
      owner: user,
    }, {
      type: 'internal',
    }, {
      'users.user': user,
    }, {
      owner: user,
    });
  }

  return this.find(filter).sort('-last_msg');
};

/**
 * Find a user in the list of users
 */
ChannelSchema.methods.findUser = function findUser(user) {
  if (!user) {
    return false;
  }

  const { users, owner } = this;
  const uId = getDocKey(user);
  const oId = getDocKey(owner);

  let found = users.find(({ user: u }) => uId === getDocKey(u));

  if (!found && uId === oId) {
    found = {
      user: oId,
      isAdmin: true,
    };

    users.push(found);
    found = users[users.length - 1];
  }

  if (!found) {
    return false;
  }

  return found;
};

/**
 * Update the last_seen attribute
 * @param { Object } user The user
 */
ChannelSchema.methods.saw = function saw(user, isSave = true) {
  if (!user) {
    return false;
  }

  const found = this.findUser(user);

  if (!found) {
    return false;
  }

  found.last_seen = new Date();
  this.markModified('users');

  if (isSave === true) {
    return this.save({ new: true });
  }

  return this;
};

/**
 * Update the mute attribute
 * @param { Object } user The user
 */
ChannelSchema.methods.mute = function mute(user) {
  if (!user) {
    return false;
  }

  const found = this.findUser(user);

  if (!found) {
    return false;
  }

  found.mute = true;
  this.markModified('users');

  return this.save({ new: true });
};

/**
 * Check if the user can access to the channel
 * @param { Object } user The user
 */
ChannelSchema.methods.canAccess = function canAccess(user) {
  if (!user) {
    return this.type === 'public';
  }

  if (this.type === 'internal') {
    return true;
  }

  const oId = getDocKey(this.owner);
  const users = this.users.map(({ user: u }) => getDocKey(u));

  return [oId, ...users].includes(user.id);
};

/**
 * Get the preview of a specific channel
 */
ChannelSchema.methods.getPreview = async function getPreview(user) {
  const cUId = getDocKey(user);
  const { _id: id } = this;
  const ChatMessage = model('ChatMessage');
  let { name, muted = false } = this;
  let read = false;

  if (!name || user) {
    await this.populate({
      path: 'users.user',
      select: 'name',
    }).execPopulate();
  }

  let found = false;
  if (cUId) {
    found = this.findUser(cUId);

    if (found) {
      muted = found.mute;
    }
  }


  if (!name && !['public', 'internal'].includes(this.type)) {
    const users = this.users
      .filter((u) => {
        const uId = getDocKey(u.user);
        return uId !== cUId
          && u
          && u.user
          && u.user.name
          && u.user.name.first;
      })
      .slice(0, 3).map(u => u.user.name.first);

    const nbUsers = found ? this.users.length - 1 : this.users.length;
    name = users.join(' & ') + (
      users.length < nbUsers && users.length > 0
        ? '...'
        : ''
    );
  }

  const message = await ChatMessage
    .findOne({
      channel: this,
      type: 'message',
      removed: false,
    })
    .sort({ created_at: -1 })
    .select('sender text created_at')
    .populate({
      path: 'sender',
      select: 'name',
    });

  if (found) {
    muted = found.mute;
    read = !message || Boolean(
      found.last_seen
      && message.created_at < found.last_seen,
    );
  }

  return {
    _id: id,
    type: this.type,
    name: !name && ['public', 'internal'].includes(this.type)
      ? this.type
      : (name || 'Untitled'),
    read,
    muted,
    message,
  };
};

/**
 * Pre save event implementation
 */
ChannelSchema.pre('save', function preSave() {
  const modified = this.modifiedPaths();

  if (modified.length === 0) {
    return;
  }

  const { users } = this;
  this.increment();

  if (modified.includes('users')) {
    if (Array.isArray(users)) {
      this.users = users.filter(({ user }, index, arr) => {
        const uId = getDocKey(user);
        const i = arr.findIndex(({ user: u }) => (
          getDocKey(u) === uId
        ));
        return i === index;
      });
    }
  }
});

/**
 * Pre remove event implementation
 */
ChannelSchema.post('remove', function postRemove() {
  const ChatMessage = model('ChatMessage');
  ChatMessage.deleteMany({ channel: this }).catch(e => console.error(e));
});

module.exports = mongoose.model('ChatChannel', ChannelSchema);
