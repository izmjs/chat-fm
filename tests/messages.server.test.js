/* eslint-disable import/no-dynamic-require */
const request = require('supertest');
const { resolve } = require('path');
const { model, connection } = require('mongoose');
const { expect } = require('chai');
// const io = require('socket.io-client');
const {
  it,
  before,
  describe,
  afterEach,
} = require('mocha');

const User = model('User');
const Channel = model('ChatChannel');

const { createUser } = require(resolve('helpers/utils'));

const express = require(resolve('./config/lib/express'));
const { prefix } = require(resolve('config'));

let httpServer;
const c1 = {
  username: 'username1',
  password: 'jsI$Aw3$0m3',
};
const c2 = {
  username: 'username2',
  password: 'jsI$Aw3$0m3',
};
let agent;
// let socket;

/**
 * Sections tests
 */
describe('tests for module "chat-fm"', () => {
  before(async () => {
    // Get application
    httpServer = await express.init(connection.db);
    // const { port } = httpServer.listen().address();
    agent = request.agent(httpServer);
    // socket = io.connect(`http://localhost:${port}`, {
    //   'reconnection delay': 0,
    //   'reopen delay': 0,
    //   'force new connection': true,
    //   transports: ['websocket'],
    // });
    // socket.on('connect', () => {
    //   console.log('socket connected');
    // });
  });

  describe('Send message', () => {
    it('I am not allowed to send a message if I do not have the IAM "modules:chat-fm:messages:send"', async () => {
      await createUser(c1);
      const u2 = await createUser(c2, []);
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u2.id], text: 'message content' })
        .expect(403);
    });

    it('I am allowed to call the API if I have the IAM "modules:chat-fm:messages:send"', async () => {
      await createUser(c1, [
        'users:auth:signin',
        'modules:chat-fm:messages:send',
      ]);
      const u2 = await createUser(c2, [], 'role-test1');
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u2.id], text: 'message content' })
        .expect(200);
    });

    it('I can not send a message to myself', async () => {
      const u = await createUser(c1, [
        'users:auth:signin',
        'modules:chat-fm:messages:send',
      ]);
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u.id], text: 'message content' })
        .expect(400);
    });

    it('Sending a message to one user should create a "p2p" channel', async () => {
      await createUser(c1, [
        'users:auth:signin',
        'modules:chat-fm:messages:send',
      ]);
      const u = await createUser(c2, [], 'role-test1');
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      const { body } = await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u.id], text: 'message content' })
        .expect(200);

      const { channel } = body;
      const ch = await Channel.findById(channel);
      expect(ch.type).to.equal('p2p');
    });

    it('Sending a message to multiple users should create a "private" channel', async () => {
      await createUser(c1, [
        'users:auth:signin',
        'modules:chat-fm:messages:send',
      ]);
      const u = await createUser(c2, [], 'role-test1');
      const u1 = await createUser({
        username: 'username3',
        password: 'jsI$Aw3$0m3',
      }, [], 'role-test2');
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      const { body } = await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u.id, u1.id], text: 'message content' })
        .expect(200);

      const { channel } = body;
      const ch = await Channel.findById(channel);
      expect(ch.type).to.equal('private');
    });

    it('Should notify users who received the message', async () => {
      await createUser(c1, [
        'users:auth:signin',
        'modules:chat-fm:messages:send',
      ]);
      const u = await createUser(c2, [], 'role-test1');
      const u1 = await createUser({
        username: 'username3',
        password: 'jsI$Aw3$0m3',
      }, [], 'role-test2');
      await agent.post('/api/v1/auth/signin').send(c1).expect(200);
      await agent
        .post(`${prefix}/chat-fm/messages`)
        .send({ to: [u.id, u1.id], text: 'message content' })
        .expect(200);
    });
  });

  afterEach(async () => {
    // if (socket.connected) {
    //   socket.disconnect();
    // }
    await Promise.all([
      User.remove(),
      Channel.remove(),
    ]);
  });
});
