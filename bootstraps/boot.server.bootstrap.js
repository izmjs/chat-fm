// eslint-disable-next-line import/no-unresolved
const { addIamToRoles } = require('utils');

module.exports = async (config) => {
  const { addIamToUser } = config['chat-fm'];

  if (addIamToUser) {
    try {
      await addIamToRoles('modules:chat-fm', ['user']);
    } catch (e) {
      // Ignore and proceed
    }
  }
};
