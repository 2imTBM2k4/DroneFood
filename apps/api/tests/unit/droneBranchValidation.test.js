import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { resolveHubId } from "../../seeds/seedDrones.js";
import { createDroneSchema } from "../../validations/droneValidation.js";

describe("drone hub requirements", () => {
  it("requires a valid hubId when creating a drone", () => {
    const missing = createDroneSchema.validate({ droneCode: "DRONE-001" });
    const invalid = createDroneSchema.validate({
      hubId: "not-an-object-id",
      droneCode: "DRONE-001",
    });
    const hubId = new mongoose.Types.ObjectId().toString();
    const valid = createDroneSchema.validate({ hubId, droneCode: "DRONE-001" });

    expect(missing.error?.details[0].path).toEqual(["hubId"]);
    expect(invalid.error?.details[0].path).toEqual(["hubId"]);
    expect(valid.error).toBeUndefined();
    expect(valid.value.hubId).toBe(hubId);
  });

  it("resolves the seed hub from CLI first, then the environment", async () => {
    const cliHubId = new mongoose.Types.ObjectId().toString();
    const envHubId = new mongoose.Types.ObjectId().toString();

    const cliResolved = await resolveHubId({
      argv: ["--hub-id", cliHubId],
      env: { SEED_DRONE_HUB_ID: envHubId },
    });
    expect(cliResolved.toString()).toBe(cliHubId);

    const envResolved = await resolveHubId({
      argv: [],
      env: { SEED_DRONE_HUB_ID: envHubId },
    });
    expect(envResolved.toString()).toBe(envHubId);
  });
});
