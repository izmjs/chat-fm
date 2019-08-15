const SCOPE = 'chat-fm';

module.exports = (config) => {
  const { env } = config.utils;

  return {
    'chat-fm': {
      addIamToUser: env.get('ADD_IAM_TO_USER', SCOPE),
      removeMessages: env.get('REMOVE_MESSAGES', SCOPE),
      versionning: env.get('ENABLE_VERSIONNING', SCOPE),
      nbMsgVersions: env.get('NB_MESSAGE_VERSIONS', SCOPE),
    },
  };
};
