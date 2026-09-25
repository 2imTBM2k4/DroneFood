import { ShipperAccountClosure } from "../models/index.cjs";

export const create = async (data, session) => ShipperAccountClosure.create([{ ...data }], { session }).then(([request]) => request);
export const findById = (id) => ShipperAccountClosure.findById(id);
export const findByShipper = (shipperId) => ShipperAccountClosure.findOne({ shipper: shipperId });
export const findByTokenHash = (hash) => ShipperAccountClosure.findOne({ formTokenHash: hash, formTokenExpiresAt: { $gt: new Date() } }).select("+formTokenHash +formTokenExpiresAt");
