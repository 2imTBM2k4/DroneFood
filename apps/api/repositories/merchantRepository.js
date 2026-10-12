import { Merchant } from "../models/index.cjs";

export const findById = async (id, select = "") => {
  let query = Merchant.findById(id);
  if (select) query = query.select(select);
  return await query;
};

export const findByOwnerUserId = async (ownerUserId, select = "") => {
  let query = Merchant.findOne({ ownerUserId });
  if (select) query = query.select(select);
  return await query;
};

export const findBySlug = async (slug, select = "", options = {}) => {
  let query = Merchant.findOne({ slug });
  if (select) query = query.select(select);
  if (options.lean) query = query.lean();
  return await query;
};

export const create = async (merchantData, options = {}) => {
  const { session } = options;
  const merchant = new Merchant(merchantData);
  return await merchant.save({ session });
};

export const updateById = async (id, updates, options = {}) => {
  return await Merchant.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    ...options,
  });
};

export const findAll = async (
  filter = {},
  { page, limit, sort, sortBy, order, q = "" } = {}
) => {
  const match = { ...filter };
  const escapedQuery = String(q).trim();

  const direction = order === "asc" ? 1 : -1;
  const sortMap = {
    name: { name: direction, _id: 1 },
    type: { type: direction, _id: 1 },
    branchCount: { branchCount: direction, _id: 1 },
    status: { status: direction, _id: 1 },
    owner: { "ownerUserId.name": direction, _id: 1 },
    createdAt: { createdAt: direction, _id: 1 },
  };

  const resolvedSort =
    sort ||
    (sortBy ? sortMap[sortBy] || { [sortBy]: direction, _id: 1 } : { createdAt: -1 });

  const needsAggregate = Boolean(escapedQuery || sortBy === "owner");

  if (!needsAggregate) {
    let query = Merchant.find(match)
      .populate("ownerUserId", "name email")
      .sort(resolvedSort);

    if (page && limit) {
      const total = await Merchant.countDocuments(match);
      const data = await query.skip((page - 1) * limit).limit(limit);
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const data = await query;
    return { data };
  }

  const regex = escapedQuery ? new RegExp(escapedQuery, "i") : null;
  const sortStage = Object.fromEntries(
    Object.entries(resolvedSort).map(([field, dir]) => [field, dir])
  );
  const basePipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "ownerUserId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, email: 1 } }],
        as: "ownerUserId",
      },
    },
    {
      $unwind: {
        path: "$ownerUserId",
        preserveNullAndEmptyArrays: true,
      },
    },
    ...(regex
      ? [
          {
            $match: {
              $or: [
                { name: regex },
                { slug: regex },
                { "ownerUserId.email": regex },
              ],
            },
          },
        ]
      : []),
  ];
  const [result] = await Merchant.aggregate([
    ...basePipeline,
    {
      $facet: {
        data: [
          { $sort: sortStage },
          ...(page && limit
            ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
            : []),
        ],
        meta: [{ $count: "total" }],
      },
    },
  ]);
  const data = result?.data || [];
  const total = result?.meta?.[0]?.total || 0;

  if (page && limit) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  return { data };
};

export const countDocuments = async (filter = {}) => {
  return await Merchant.countDocuments(filter);
};
