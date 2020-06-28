const { addIamToRoles } = require('@helpers/utils');

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
