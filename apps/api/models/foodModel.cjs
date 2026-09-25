const mongoose = require('mongoose');

// A single choice inside a group, e.g. "Large" (+$2.00) or "Extra cheese".
const foodOptionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    priceDelta: {
        type: Number,
        default: 0,
        min: 0,
        validate: { validator: Number.isInteger, message: "priceDelta must be whole VND" },
    },
}, { _id: false });

// A set of choices the customer picks from, e.g. "Size" or "Toppings".
// `single` renders as radios, `multi` as checkboxes. For `multi`, max = 0
// means unlimited.
const optionGroupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['single', 'multi'], default: 'single' },
    required: { type: Boolean, default: false },
    min: { type: Number, default: 0, min: 0 },
    max: { type: Number, default: 0, min: 0 },
    options: {
        type: [foodOptionSchema],
        validate: {
            validator: (options) => options.length > 0,
            message: 'An option group must contain at least one option',
        },
    },
}, { _id: false });

const foodSchema = new mongoose.Schema({
    name: {type:String,required:true},
    description: {type:String,required:true},
    price:{
        type:Number,
        required:true,
        min:1,
        validate: { validator: Number.isInteger, message: "price must be whole VND" },
    },
    image:{type:String,required:true},
    category:{type:String,required:true},
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    // Owners can temporarily hide an out-of-stock dish without deleting its
    // menu record or breaking historical order snapshots.
    isAvailable: { type: Boolean, default: true, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },
    salesCount: { type: Number, default: 0, min: 0, index: true },
    // Dishes created before options existed simply have an empty array.
    optionGroups: { type: [optionGroupSchema], default: [] }
});

// Supports the canonical restaurant-menu filters without a collection scan.
foodSchema.index({ restaurantId: 1, isAvailable: 1, category: 1, price: 1 });

module.exports = mongoose.models.Food || mongoose.model('Food', foodSchema);
