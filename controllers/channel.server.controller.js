const { model, Types } = require('mongoose');

const Channel = model('ChatChannel');
const Message = model('ChatMessage');
const { getDocKey } = require('../helpers/main.server.helper');

/**
 * List all channels
 * @controller List
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 */
exports.list = async function list(req, res, next) {
  const { $top: top, $skip: skip, $expand = '' } = req.query;
  const expands = $expand.split(',');
  const { user } = req;

  let query = Channel.userChannels(user);

  if (expands.includes('users.user')) {
    query = query.populate({ path: 'users.user', select: 'name' });
  }

  try {
    const result = await query.paginate({ top, skip });

    return res.json(result);
  } catch (e) {
    return next(e);
  }
};

/**
 * Create new channel
 * @controller Create
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.create = async function create(req, res, next) {
  const { body, user } = req;

  // Create the channel
  let c = new Channel({
    ...body,
    owner: user.id,
  });

  try {
    c = await c.save({ new: true });
    return res.json(c);
  } catch (e) {
    return next(e);
  }
};

/**
 * Get metadata of a specific channel
 * @controller Get one
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.one = async function one(req, res, next) {
  const { $expand = '' } = req.query;
  let { channel } = req;
  const allowedExpands = ['users.user', 'owner'];
  const expands = $expand.split(',').filter(
    (exp, index, arr) => exp
      && arr.indexOf(exp) === index
      && allowedExpands.indexOf(exp) >= 0,
  );

  if (expands.length === 0) {
    return res.json(channel);
  }

  const q = Channel.findById(channel.id);

  if (expands.includes('users.user')) {
    channel = q.populate({ path: 'users.user', select: 'name' });
  }

  if (expands.includes('owner')) {
    channel = q.populate({ path: 'owner', select: 'name' });
  }

  try {
    channel = await q.exec();
  } catch (e) {
    return next(e);
  }

  return res.json(channel);
};

/**
 * Edit metadata of a channel
 * @controller Edit one
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.edit = async function edit(req, res, next) {
  const { body, channel } = req;

  channel.set(body);

  try {
    const json = await channel.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next();
  }
};

/**
 * Remove a channel
 * @controller Remove one
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.remove = async function remove(req, res, next) {
  const { channel } = req;
  try {
    await channel.remove();
  } catch (e) {
    return next(e);
  }

  return res.status(204).end();
};

/**
 * Archive a channel
 * @controller Archive
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.archive = async function archive(req, res, next) {
  const { channel } = req;
  channel.set({ archived: true });
  try {
    const json = await channel.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next(e);
  }
};

/**
 * Unarchive a channel
 * @controller unarchive
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.unarchive = async function archive(req, res, next) {
  const { channel } = req;
  channel.set({ archived: false });
  try {
    const json = await channel.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next(e);
  }
};

/**
 * Invite users
 * @controller Invite
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.invite = async function invite(req, res, next) {
  const { body = [], channel } = req;
  const { users = [] } = channel;

  body.forEach(({ user, isAdmin }) => {
    const found = users.find(({ user: u }) => {
      const id = getDocKey(u);

      return id === user;
    });

    if (!found) {
      users.push({ user, isAdmin });
    } else {
      found.isAdmin = isAdmin;
    }
  });

  channel.markModified('users');

  try {
    const json = await channel.save({ new: true });
    return res.json(json);
  } catch (e) {
    return next(e);
  }
};

/**
 * List messages of a channel
 * @controller List Messages
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.messages = async function messages(req, res, next) {
  const { channel, query, user } = req;
  const { $top: top = 10, $skip: skip = 0 } = query;
  try {
    const list = await Message.find({
      channel,
    }).populate({
      path: 'sender',
      select: 'name',
    }).sort({
      created_at: -1,
    }).paginate({ top, skip });

    if (parseInt(skip, 10) === 0) {
      await channel.saw(user);
    }

    return res.json(list);
  } catch (e) {
    return next(e);
  }
};

/**
 * Leave a channel
 * @controller Leave channel
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.leave = async function leave(req, res, next) {
  const { user, channel } = req;
  const { owner, users } = channel;

  const oId = getDocKey(owner);
  const uId = getDocKey(user);

  if (!user || oId === uId) {
    return res.status(400).json({
      message: req.t('CHANNEL_CANNOT_LEAVE'),
    });
  }

  const list = users.filter(({ user: u }) => uId !== getDocKey(u));
  channel.set({ users: list });

  try {
    await channel.save();
    return res.status(204).end();
  } catch (e) {
    return next();
  }
};

/**
 * Mute a conversation
 * @controller Mute
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.mute = async function mute(req, res, next) {
  const { channel, user } = req;

  try {
    await channel.mute(user);
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
};

/**
 * List a preview of channels
 * @controller Preview Channels
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.listPreview = async function listPreview(req, res, next) {
  const { user } = req;
  const { $top: top = 10, $skip: skip } = req.query;

  let newTop = parseInt(top, 10);
  newTop = Number.isNaN(newTop) || newTop > 100 ? 100 : newTop;

  try {
    const list = await Channel
      .userChannels(user)
      .paginate({ top: newTop, skip });

    const list$ = list.value.map(async (one) => {
      try {
        const result = await one.getPreview(user);
        return result;
      } catch (e) {
        return {
          _id: one.id,
          name: this.name,
          message: 'Not available',
        };
      }
    });

    list.value = await Promise.all(list$);
    return res.json(list);
  } catch (e) {
    return next(e);
  }
};

/**
 * Check if the user can administrate the channel
 * @controller Is Admin
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.canAdmin = async function canAdmin(req, res, next) {
  const { user, channel } = req;

  if (!channel.isAdmin(user)) {
    return res.status(403).json({
      message: req.t('CHANNEL_CANNOT_ADMINISTRATE'),
    });
  }

  return next();
};

/**
 * Check if the user is the owner of the channel
 * @controller Is Owner
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.isOwner = async function isOwner(req, res, next) {
  const { user, channel } = req;
  const { owner } = channel;

  const uId = getDocKey(user);
  const oId = getDocKey(owner);

  if (!uId || uId !== oId) {
    return res.status(403).json({
      message: req.t('CHANNEL_UNAUTHORIZED_ACTION'),
    });
  }

  return next();
};

/**
 * Get channel by ID
 * @controller Get by ID
 * @param {IncommingMessage} req The request
 * @param {OutcommingMessage} res The response
 * @param {Function} next Go to the next middleware
 */
exports.getById = async function getById(req, res, next, id) {
  const { user } = req;

  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: req.t('CHANNEL_INVALID_ID'),
    });
  }

  let ch;

  try {
    ch = await Channel.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!ch || !ch.canAccess(user)) {
    return res.status(404).json({
      message: req.t('CHANNEL_NOT_FOUND'),
    });
  }

  req.channel = ch;
  return next();
};
