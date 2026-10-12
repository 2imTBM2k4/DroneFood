import { Hub } from "../models/index.cjs";

export const findById = async (id, select = "") => {
  let query = Hub.findById(id);
  if (select) query = query.select(select);
  return await query;
};

export const findByCode = async (code) => {
  return await Hub.findOne({ code });
};

export const create = async (hubData, options = {}) => {
  const hub = new Hub(hubData);
  return await hub.save(options);
};

export const updateById = async (id, updates, options = {}) => {
  return await Hub.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    ...options,
  });
};

export const deleteById = async (id, options = {}) => {
  return await Hub.findByIdAndDelete(id, options);
};

export const findAll = async (filter = {}, { page, limit, sort = { createdAt: -1 } } = {}) => {
  let query = Hub.find(filter).sort(sort);

  if (page && limit) {
    const total = await Hub.countDocuments(filter);
    const data = await query.skip((page - 1) * limit).limit(limit);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  const data = await query;
  return { data };
};

export const countDocuments = async (filter = {}) => {
  return await Hub.countDocuments(filter);
};
