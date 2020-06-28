const { validate } = require('@helpers/utils');

const ctrls = require('../controllers/channel.server.controller');
const msgCtrls = require('../controllers/message.server.controller');
const createSchema = require('../schemas/channel-create.server.schema');
const editSchema = require('../schemas/channel-edit.server.schema');
const inviteSchema = require('../schemas/channel-invite.server.schema');
const sendSchema = require('../schemas/channel-send.server.schema');

/**
* @type { IAM.default }
*/
module.exports = {
  prefix: '/chat-fm/channels',
  params: [{
    name: 'channelId',
    middleware: ctrls.getById,
  }],
  routes: [{
    path: '/',
    methods: {
      /**
       * @params
       * [{
       *   "key": "$top",
       *   "value": "10",
       *   "description": "Number of records to return"
       * }, {
       *   "key": "$skip",
       *   "value": "0",
       *   "description": "Number of records to skip"
       * }, {
       *   "key": "$expand",
       *   "value": "users.user",
       *   "description": "Expands a specific attribute. The only available option is 'users.user' which will return the name object of each user"
       * }]
       *
       * @test
       * pm.test("Status code is 200", () => {
       *   pm.response.to.have.status(200);
       *   const json = pm.response.json().value;
       *   if(!Array.isArray(json) || json.length === 0) {
       *     return;
       *   }
       *
       *   const fId = pm.variables.get("channelId");
       *
       *   if(!fId || !json.find(one => one.id === fId)) {
       *     pm.environment.set("channelId", json[0]._id);
       *   }
       * });
       */
      get: {
        iam: 'modules:chat-fm:channels:list',
        title: 'List channels',
        parents: ['modules:chat-fm'],
        groups: [],
        description: 'List user channels',
        middlewares: [
          ctrls.list,
        ],
      },
      /**
       * @body
       * {
       *   "name": "New channel",
       *   "users": [{
       *     "user": "{{userId}}",
       *     "isAdmin": true
       *   }],
       *   "type": "internal"
       * }
       */
      post: {
        iam: 'modules:chat-fm:channels:create',
        title: 'Create new channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Create new channel',
        middlewares: [
          validate(createSchema),
          ctrls.create,
        ],
      },
    },
  }, {
    path: '/preview',
    methods: {
      /**
       * @params
       * [{
       *   "key": "$top",
       *   "value": "10",
       *   "description": "Number of records to return. Should not exceed 100"
       * }, {
       *   "key": "$skip",
       *   "value": "0",
       *   "description": "Number of records to skip"
       * }]
       *
       * @test
       * pm.test("Status code is 200", () => {
       *   pm.response.to.have.status(200);
       *   const json = pm.response.json().value;
       *   if(!Array.isArray(json) || json.length === 0) {
       *     return;
       *   }
       *
       *   const fId = pm.variables.get("messageId");
       *
       *   if(!fId || !json.find(one => one.id === fId)) {
       *     pm.environment.set("messageId", json[0]._id);
       *   }
       * });
       */
      get: {
        iam: 'modules:chat-fm:channels:messages:preview',
        title: 'Preview the list of messages',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Preview the list of messages. It will return a calculated topic name and the last sent message',
        middlewares: [
          ctrls.listPreview,
        ],
      },
    },
  }, {
    path: '/:channelId',
    methods: {
      /**
       * @params
       * [{
       *   "key": "$expand",
       *   "value": "users.user,owner",
       *   "description": "Expands a specific attribute. Available options are: 'users.user' or 'owner'"
       * }]
       */
      get: {
        iam: 'modules:chat-fm:channels:one',
        title: 'Get metadata of channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Get metadata of a specific channel',
        middlewares: [
          ctrls.one,
        ],
      },
      /**
       * @body
       * {
       *   "name": "New channel name",
       *   "type": "public"
       * }
       */
      post: {
        iam: 'modules:chat-fm:channels:edit',
        title: 'Edit channel metadata',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Edit the metadata of a specific channel',
        middlewares: [
          validate(editSchema),
          ctrls.canAdmin,
          ctrls.edit,
        ],
      },
      /**
       * @body
       * {
       *   "name": "New channel name",
       *   "type": "public"
       * }
       */
      delete: {
        iam: 'modules:chat-fm:channels:delete',
        title: 'Remove channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Remove channel and all it\'s messages',
        middlewares: [
          ctrls.isOwner,
          ctrls.remove,
        ],
      },
    },
  }, {
    path: '/:channelId/archive',
    methods: {
      post: {
        iam: 'modules:chat-fm:channels:archive',
        title: 'Archive channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Archive channel',
        middlewares: [
          ctrls.canAdmin,
          ctrls.archive,
        ],
      },
    },
  }, {
    path: '/:channelId/unarchive',
    methods: {
      post: {
        iam: 'modules:chat-fm:channels:unarchive',
        title: 'Unarchive channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Unarchive channel',
        middlewares: [
          ctrls.canAdmin,
          ctrls.unarchive,
        ],
      },
    },
  }, {
    path: '/:channelId/invite',
    methods: {
      /**
       * @body
       * [{
       *   "user": "{{userId}}"
       * }]
       */
      post: {
        iam: 'modules:chat-fm:channels:invite',
        title: 'Invite users',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Invite users to specific channel',
        middlewares: [
          ctrls.canAdmin,
          validate(inviteSchema),
          ctrls.invite,
        ],
      },
    },
  }, {
    path: '/:channelId/leave',
    methods: {
      post: {
        iam: 'modules:chat-fm:channels:leave',
        title: 'Leave channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Leave specific channel',
        middlewares: [
          ctrls.leave,
        ],
      },
    },
  }, {
    path: '/:channelId/mute',
    methods: {
      post: {
        iam: 'modules:chat-fm:channels:mute',
        title: 'Mute a conversation',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Mute a specific channel',
        middlewares: [
          ctrls.mute,
        ],
      },
    },
  }, {
    path: '/:channelId/messages',
    methods: {
      /**
       * @params
       * [{
       *   "key": "$top",
       *   "value": "10",
       *   "description": "Number of records to return"
       * }, {
       *   "key": "$skip",
       *   "value": "0",
       *   "description": "Number of records to skip"
       * }]
       *
       * @test
       * pm.test("Status code is 200", () => {
       *   pm.response.to.have.status(200);
       *   const json = pm.response.json().value;
       *   if(!Array.isArray(json) || json.length === 0) {
       *     return;
       *   }
       *
       *   const fId = pm.variables.get("messageId");
       *
       *   if(!fId || !json.find(one => one.id === fId)) {
       *     pm.environment.set("messageId", json[0]._id);
       *   }
       * });
       */
      get: {
        iam: 'modules:chat-fm:channels:message:list',
        title: 'List messages of a channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'List messages of a specific channel',
        middlewares: [
          ctrls.messages,
        ],
      },
      /**
       * @body
       * {
       *   "text": "Message content"
       * }
       *
       * @params
       * [{
       *   "key": "$expand",
       *   "value": "sender",
       *   "description": "Expand attributes. Possible values: 'users' and 'sender'"
       * }]
       *
       * @test
       * pm.test("Status code is 200", () => {
       *   pm.response.to.have.status(200);
       *   const json = pm.response.json();
       *   pm.environment.set("messageId", json._id);
       * });
       */
      post: {
        iam: 'modules:chat-fm:channels:message:send',
        title: 'Send message to channel',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Send message to a specific channel',
        middlewares: [
          validate(sendSchema),
          msgCtrls.send,
        ],
      },
    },
  }],
};
