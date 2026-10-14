import * as loginAttemptRepo from "../repositories/loginAttemptRepository.js";

const FAILURE_THRESHOLD = 5;
const WINDOW_MS = 15 * 60 * 1000;

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const normalizeIp = (ip) => (typeof ip === "string" ? ip.trim() : "");

const buildSubjects = ({ email, ip }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedIp = normalizeIp(ip);

  return [
    normalizedEmail && { subjectType: "email", subjectKey: normalizedEmail },
    normalizedIp && { subjectType: "ip", subjectKey: normalizedIp },
  ].filter(Boolean);
};

export const isCaptchaRequired = async ({ email, ip }) => {
  const subjects = buildSubjects({ email, ip });
  if (subjects.length === 0) return false;

  const attempts = await Promise.all(
    subjects.map((subject) => loginAttemptRepo.findActiveBySubject(subject))
  );

  return attempts.some((attempt) => attempt?.failureCount >= FAILURE_THRESHOLD);
};

export const recordFailedLogin = async ({ email, ip }) => {
  const subjects = buildSubjects({ email, ip });
  if (subjects.length === 0) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  await Promise.all(
    subjects.map((subject) =>
      loginAttemptRepo.incrementBySubject({ ...subject, expiresAt, now })
    )
  );
};

export const clearLoginAttempts = async ({ email, ip }) => {
  await loginAttemptRepo.deleteBySubjects(buildSubjects({ email, ip }));
};

export const loginAttemptPolicy = {
  FAILURE_THRESHOLD,
  WINDOW_MS,
};
