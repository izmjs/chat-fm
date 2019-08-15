/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const { resolve } = require('path');

// eslint-disable-next-line import/no-dynamic-require
const config = require(resolve('./config'));
const txtSymbol = Symbol.for('text');
const updatedAtSymbol = Symbol.for('updated_at');

const {
  Schema,
} = mongoose;

const MessageSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    set(v) {
      this[txtSymbol] = this.text;
      return v;
    },
  },
  type: {
    type: String,
    enum: ['message', 'info', 'warning', 'danger'],
    default: 'message',
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  channel: {
    type: Schema.Types.ObjectId,
    ref: 'ChatChannel',
  },
  removed: {
    type: Boolean,
    default: false,
  },
  versions: [{
    text: String,
    date: Date,
  }],
}, {
  timestamps: config.lib.mongoose.timestamps,
  collection: 'chat-messages',
});

MessageSchema.path('updated_at').set(function onUpdatedAtSet(v) {
  this[updatedAtSymbol] = this.updated_at;
  return v;
});

MessageSchema.pre('save', function preSave() {
  const modified = this.modifiedPaths();
  if (
    !this.isNew
    && modified.includes('text')
    && config['chat-fm'].versionning
  ) {
    const text = this[txtSymbol];
    const date = this[updatedAtSymbol] || this.updated_at;

    this.versions.unshift({ text, date });

    if (
      config['chat-fm'].nbMsgVersions >= 0
      && config['chat-fm'].nbMsgVersions <= this.versions.length
    ) {
      this.versions = this.versions.slice(0, config['chat-fm'].nbMsgVersions);
    }
  }
});

module.exports = mongoose.model('ChatMessage', MessageSchema);
