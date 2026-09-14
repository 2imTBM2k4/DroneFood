import express from "express";
import { getDeliveryRates } from "../config/fees.js";

const configRouter = express.Router();

// Fees the checkout UI displays. The server still recomputes the total from
// these itself — this endpoint only keeps the displayed figures honest.
configRouter.get("/fees", (req, res) => {
  res.json({
    success: true,
    ...getDeliveryRates(),
  });
});

export default configRouter;
