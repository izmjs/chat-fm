const { Model } = require('mongoose');

exports.getDocKey = (doc) => {
  if (!doc) {
    return undefined;
  }

  if (doc instanceof Model) {
    return doc.id;
  }

  return doc.toString();
};
