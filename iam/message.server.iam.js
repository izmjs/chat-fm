const { validate } = require('@helpers/utils');

const ctrls = require('../controllers/message.server.controller');
const sendSchema = require('../schemas/message-send.server.schema');
const editSchema = require('../schemas/message-edit.server.schema');

/**
 * @type { IAM.default }
 */
module.exports = {
  prefix: '/chat-fm/messages',
  params: [{
    name: 'messageId',
    middleware: ctrls.getById,
  }],
  routes: [{
    path: '/',
    methods: {
      /**
       * @body
       * {
       *   "to": ["{{userId}}"],
       *   "text": "Message text"
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
       *   pm.environment.set("channelId", json.channel);
       * });
       */
      post: {
        iam: 'modules:chat-fm:messages:send',
        title: 'Send a message',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Send a message to specific user',
        middlewares: [
          validate(sendSchema),
          ctrls.createChannel,
          ctrls.send,
        ],
      },
    },
  }, {
    path: '/:messageId',
    methods: {
      /**
       * @body
       * {
       *   "text": "New message content"
       * }
       *
       * @test
       * pm.test("Status code is 200", () => {
       *   pm.response.to.have.status(200);
       *   const json = pm.response.json();
       *   pm.environment.set("messageId", json._id);
       * });
       */
      post: {
        iam: 'modules:chat-fm:messages:edit',
        title: 'Update message',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Update a specific message',
        middlewares: [
          ctrls.isMine,
          validate(editSchema),
          ctrls.update,
        ],
      },
      delete: {
        iam: 'modules:chat-fm:messages:remove',
        title: 'Remove message',
        groups: [],
        parents: ['modules:chat-fm'],
        description: 'Remove a specific message',
        middlewares: [
          ctrls.isMine,
          ctrls.remove,
        ],
      },
    },
  }],
};
