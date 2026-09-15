/*
 * Encrypts plaintext refund-bank account numbers created before the protected
 * refund workflow. Run without --apply to inspect, then run with --apply only
 * after a database backup:
 *   npm run migrate:refund-bank-accounts
 *   npm run migrate:refund-bank-accounts -- --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");

const apply = process.argv.includes("--apply");

async function run() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const refunds = mongoose.connection.collection("refundrequests");
  const legacy = await refunds.find({
    "bank.accountNumber": { $type: "string" },
    $or: [{ bankAccountEncrypted: { $exists: false } }, { bankAccountEncrypted: null }, { bankAccountEncrypted: "" }],
  }).toArray();

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", legacyRefundCount: legacy.length }));
  if (!apply || legacy.length === 0) return;

  const { encryptBankAccountNumber } = await import("../utils/bankAccountCrypto.js");
  for (const refund of legacy) {
    const accountNumber = String(refund.bank.accountNumber).replace(/\s/g, "");
    await refunds.updateOne(
      { _id: refund._id },
      {
        $set: {
          "bank.accountNumberLast4": accountNumber.slice(-4),
          bankAccountEncrypted: encryptBankAccountNumber(accountNumber),
        },
        $unset: { "bank.accountNumber": "" },
      }
    );
  }
  console.log(`Encrypted ${legacy.length} refund bank account(s).`);
}

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.connection.close(); });
