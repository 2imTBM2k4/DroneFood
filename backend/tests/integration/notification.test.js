import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app.js";
import { Notification } from "../../models/index.cjs";
import { createAdmin, createUser, generateToken } from "../helpers.js";
import { createAndEmit } from "../../services/notificationService.js";

const draftFor = (recipient, eventKey = "test:event:1") => ({
  recipient: recipient._id,
  role: recipient.role,
  type: "test.event",
  title: "Thông báo thử nghiệm",
  body: "Nội dung không chứa dữ liệu nhạy cảm.",
  data: { path: "/orders", orderId: "abc" },
  eventKey,
});

describe("notification inbox", () => {
  it("persists once per recipient and emits only the first delivery", async () => {
    const user = await createUser();
    const emitted = [];
    const io = { to: () => ({ emit: (...args) => emitted.push(args) }) };

    const first = await createAndEmit(io, draftFor(user));
    const retry = await createAndEmit(io, draftFor(user));

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(await Notification.countDocuments()).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0][0]).toBe("notificationCreated");
  });

  it("keeps list, unread count and read mutations scoped to the recipient", async () => {
    const user = await createUser();
    const other = await createUser();
    await createAndEmit(null, draftFor(user, "test:event:user"));
    await createAndEmit(null, draftFor(other, "test:event:other"));
    const token = generateToken(user._id);

    const listed = await request(app).get("/api/notifications?page=1&limit=20").set("Authorization", `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.data).toHaveLength(1);
    expect(listed.body.data.data[0].recipient).toBe(String(user._id));

    const count = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${token}`);
    expect(count.body.data.count).toBe(1);

    const denied = await request(app).post(`/api/notifications/${(await Notification.findOne({ recipient: other._id }))._id}/read`).set("Authorization", `Bearer ${token}`);
    expect(denied.status).toBe(404);

    const read = await request(app).post(`/api/notifications/${listed.body.data.data[0]._id}/read`).set("Authorization", `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
    const afterRead = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${token}`);
    expect(afterRead.body.data.count).toBe(0);
  });

  it("allows every authenticated role to access only its own inbox", async () => {
    const admin = await createAdmin();
    await createAndEmit(null, draftFor(admin, "test:event:admin"));
    const response = await request(app).get("/api/notifications").set("Authorization", `Bearer ${generateToken(admin._id)}`);
    expect(response.status).toBe(200);
    expect(response.body.data.data[0].role).toBe("admin");
  });
});
