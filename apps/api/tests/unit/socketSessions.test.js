import { describe, expect, it, vi } from "vitest";
import {
  disconnectUserSessions,
  joinUserSessionRoom,
  userSessionRoom,
} from "../../utils/socketSessions.js";

describe("Socket session rooms", () => {
  it("joins authenticated sockets and disconnects already-connected sessions", () => {
    const join = vi.fn();
    const socket = { user: { _id: "507f1f77bcf86cd799439099" }, join };
    joinUserSessionRoom(socket);
    expect(join).toHaveBeenCalledWith(userSessionRoom(socket.user._id));

    const disconnectSockets = vi.fn();
    const io = { in: vi.fn(() => ({ disconnectSockets })) };
    disconnectUserSessions(io, socket.user._id);
    expect(io.in).toHaveBeenCalledWith(userSessionRoom(socket.user._id));
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });
});
