// eslint-disable-next-line import/no-unresolved
const { getIO } = require('utils');
const { model, Types } = require('mongoose');
const { resolve } = require('path');

const { getDocKey } = require('../helpers/main.server.helper');

// eslint-disable-next-line import/no-dynamic-require
const { 'chat-fm': chatFm } = require(resolve('config'));

const ChatChannel = model('ChatChannel');
const ChatMessage = model('ChatMessage');

/**
 * Create channel
 * @controller Create Channel
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.createChannel = async function createChannel(req, res, next) {
  const { user, body } = req;
  let channel;

  const cUserId = getDocKey(user);

  // remove dupplicated users && the owner
  body.to = body.to.filter(
    (u, index, arr) => Boolean(u)
      && u !== cUserId
      && arr.indexOf(u) === index,
  );

  if (!body.to.length) {
    return res.status(400).json({
      message: req.t('EMPTY_RECIPIENTS'),
    });
  }

  if (!user && body.to.length > 1) {
    return res.status(400).json({
      message: req.t('UNAUTHORIZED_GUEST_MULTIPLE_RECEIVERS'),
    });
  }

  try {
    if (user && body.to.length === 1) {
      channel = await ChatChannel.findOne({
        type: 'p2p',
        owner: { $in: [body.to[0], cUserId] },
        'users.user': { $in: [body.to[0], cUserId] },
        $where: 'this.users.length <= 2 && this.users.length >= 1',
      });
    } else if (user) {
      channel = await ChatChannel.findOne({
        $and: [{
          type: 'private',
          owner: user,
          users: {
            $elemMatch: {
              user: { $in: body.to },
            },
          },
        }, {
          users: {
            $size: body.to.length,
          },
        }],
      });
    } else {
      channel = new ChatChannel({
        owner: body.to[0],
        type: 'private',
        users: [],
      });
      channel = await channel.save({ new: true });
    }
  } catch (e) {
    return next(e);
  }

  if (!channel) {
    try {
      channel = new ChatChannel({
        type: body.to.length === 1 ? 'p2p' : 'private',
        owner: user,
        users: body.to.map(u => ({ user: u, isAdmin: false })),
      });

      channel = await channel.save({ new: true });
    } catch (e) {
      return next(e);
    }
  }

  req.channel = channel;
  return next();
};

/**
 * Send a message to a specific user
 * @controller Send message
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.send = async function send(req, res, next) {
  const {
    user,
    body,
    query,
    channel,
  } = req;
  let { $expand = '' } = query;
  const io = getIO();

  $expand = $expand.split(',');

  let msg = new ChatMessage({
    channel,
    text: body.text,
    sender: user,
  });

  try {
    msg = await msg.save({ new: true });
  } catch (e) {
    return next(e);
  }

  let q = ChatMessage.findById(msg.id);
  if ($expand.includes('sender')) {
    q = q.populate({
      path: 'sender',
      select: 'name',
    });
  }

  if ($expand.includes('users')) {
    q = q.populate({
      path: 'channel',
      select: 'name users',
      populate: {
        path: 'users.user',
        select: 'name',
      },
    });
  }

  try {
    msg = await q.exec();
  } catch (e) {
    return next(e);
  }

  // Notify users
  if (['public', 'internal'].includes(channel.type)) {
    io.to(`chat-fm:${channel.type}`).emit('chat-fm:message', msg);
  } else {
    const list = channel.users
      .filter(({ muted = false }) => !muted)
      .map(({ user: theUser }) => getDocKey(theUser));

    if (channel.owner) {
      list.push(getDocKey(channel.owner));
    }

    list
      .filter((uId, index) => list.indexOf(uId) === index)
      .forEach((uId) => {
        io.to(`chat-fm:users:${uId}`).emit('chat-fm:message', msg);
      });
  }

  // Touch the channel
  channel.touch(false);
  channel.saw(user, false);
  channel.save().catch(console.error);

  return res.json(msg);
};

/**
 * Check if the message is mine
 * @controller Is Mine
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.isMine = async function isMine(req, res, next) {
  const { user, message } = req;
  const { sender } = message;
  const uId = getDocKey(user);
  const sId = getDocKey(sender);

  if (sId !== uId) {
    return res.status(403).json({
      message: req.t('NOT_MINE'),
    });
  }

  return next();
};

/**
 * Update a message
 * @controller Update one
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.update = async function update(req, res, next) {
  const { message, body } = req;
  message.set(body);

  try {
    const json = await message.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next(e);
  }
};

/**
 * Remove a message
 * @controller Remove one
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.remove = async function remove(req, res, next) {
  const { message } = req;
  if (chatFm.removeMessages) {
    try {
      await message.remove();
      return res.status(204).end();
    } catch (e) {
      return next(e);
    }
  }

  message.set({
    text: '',
    removed: true,
  });

  try {
    const json = await message.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next(e);
  }
};

/**
 * Get message by ID
 * @controller Get by id
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.getById = async function getById(req, res, next, id) {
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: req.t('CHANNEL_INVALID_ID'),
    });
  }

  let msg;

  try {
    msg = await ChatMessage.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!msg) {
    return res.status(404).json({
      message: req.t('MESSAGE_NOT_FOUND'),
    });
  }

  req.message = msg;
  return next();
};
