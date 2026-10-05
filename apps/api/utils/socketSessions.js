export const userSessionRoom = (userId) => `user_session_${String(userId)}`;

export const joinUserSessionRoom = (socket) => {
  if (socket?.user?._id) socket.join(userSessionRoom(socket.user._id));
};

export const disconnectUserSessions = (io, userId) => {
  if (!io || !userId) return;
  io.in(userSessionRoom(userId)).disconnectSockets(true);
};
