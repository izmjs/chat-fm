const PREFIX = 'chat-fm';

module.exports = async (io, socket) => {
  const { user } = socket.request;

  if (!user) {
    socket.join(`${PREFIX}:public`);
  } else {
    socket.join(`${PREFIX}:public`);
    socket.join(`${PREFIX}:internal`);
    socket.join(`${PREFIX}:users:${user.id}`);
  }
};
