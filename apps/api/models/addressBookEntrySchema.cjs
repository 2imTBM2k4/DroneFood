const mongoose = require("mongoose");

// Saved addresses remain owned by the User document. Orders deliberately copy
// these values at checkout, so changing this book never rewrites history.
const addressBookEntrySchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 30 },
  recipient: { type: String, required: true, trim: true, maxlength: 50 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  address: { type: String, required: true, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  zipCode: { type: String, default: "", trim: true, maxlength: 20 },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  isDefault: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

module.exports = addressBookEntrySchema;
