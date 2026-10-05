import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { initializeIndexes as initializeAccountEmailJobIndexes } from "../repositories/accountEmailJobRepository.js";
import { initializeIndexes as initializeUserIndexes } from "../repositories/userRepository.js";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await Promise.all([initializeAccountEmailJobIndexes(), initializeUserIndexes()]);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

process.env.JWT_SECRET = "test-secret-key-for-testing";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.ACCOUNT_SECURITY_URL = "http://account-security.test";
process.env.FORGOT_PASSWORD_MIN_RESPONSE_MS = "10";
process.env.EMAIL_VERIFICATION_MIN_RESPONSE_MS = "10";
process.env.BANK_ACCOUNT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
