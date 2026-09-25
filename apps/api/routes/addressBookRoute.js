import express from "express";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  createAddressEntry,
  deleteAddressEntry,
  listAddressBook,
  setDefaultAddressEntry,
  updateAddressEntry,
} from "../controllers/addressBookController.js";
import {
  addressEntryParamsSchema,
  createAddressEntrySchema,
  updateAddressEntrySchema,
} from "../validations/addressBookValidation.js";

const router = express.Router();

router.use(protect);
router.get("/", listAddressBook);
router.post("/", validate(createAddressEntrySchema), createAddressEntry);
router.patch("/:id", validate(addressEntryParamsSchema, "params"), validate(updateAddressEntrySchema), updateAddressEntry);
router.put("/:id/default", validate(addressEntryParamsSchema, "params"), setDefaultAddressEntry);
router.delete("/:id", validate(addressEntryParamsSchema, "params"), deleteAddressEntry);

export default router;
