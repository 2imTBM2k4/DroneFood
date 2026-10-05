import nodemailer from "nodemailer";
import { smtpTimeouts } from "./smtpTimeouts.js";

const sendEmail = async ({ to, subject, html }) => {
  // Automated tests must never contact a real SMTP provider. Focused email
  // tests replace this module with a mock and still exercise the full caller.
  if (process.env.NODE_ENV === "test") {
    return { skipped: true };
  }

  const timeouts = smtpTimeouts();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    ...timeouts,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Drone Food" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

export default sendEmail;
