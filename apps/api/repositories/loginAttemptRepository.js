import LoginAttempt from "../models/loginAttemptModel.cjs";

export const findActiveBySubject = async ({ subjectType, subjectKey, now = new Date() }) => {
  return LoginAttempt.findOne({
    subjectType,
    subjectKey,
    expiresAt: { $gt: now },
  }).lean();
};

export const incrementBySubject = async ({ subjectType, subjectKey, expiresAt, now = new Date() }) => {
  await LoginAttempt.deleteMany({
    subjectType,
    subjectKey,
    expiresAt: { $lte: now },
  });

  return LoginAttempt.findOneAndUpdate(
    { subjectType, subjectKey },
    {
      $inc: { failureCount: 1 },
      $setOnInsert: { expiresAt },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

export const deleteBySubjects = async (subjects) => {
  if (subjects.length === 0) return;
  await LoginAttempt.deleteMany({ $or: subjects });
};
