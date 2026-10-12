import { Branch } from "../models/index.cjs";

export const findById = async (id, select = "") => {
  let query = Branch.findById(id);
  if (select) query = query.select(select);
  return await query;
};

export const findByMerchantId = async (merchantId, filter = {}) => {
  return await Branch.find({ merchantId, ...filter }).sort({ createdAt: 1 });
};

export const countActiveByMerchantId = async (merchantId) => {
  return await Branch.countDocuments({ merchantId, status: "active" });
};

export const countByMerchantId = async (merchantId, filter = {}) => {
  return await Branch.countDocuments({ merchantId, ...filter });
};

export const create = async (branchData, options = {}) => {
  const { session } = options;
  const branch = new Branch(branchData);
  return await branch.save({ session });
};

export const updateById = async (id, updates, options = {}) => {
  return await Branch.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
    ...options,
  });
};

export const deleteById = async (id, options = {}) => {
  return await Branch.findByIdAndDelete(id, options);
};

export const findAll = async (
  filter = {},
  { page, limit, sort, sortBy, order, q = "" } = {}
) => {
  const match = { ...filter };
  const queryText = String(q).trim();

  const direction = order === "asc" ? 1 : -1;
  const sortMap = {
    name: { name: direction, _id: 1 },
    code: { code: direction, _id: 1 },
    merchant: { "merchantId.name": direction, _id: 1 },
    address: { "address.text": direction, _id: 1 },
    status: { status: direction, _id: 1 },
    droneDeliveryEnabled: { droneDeliveryEnabled: direction, _id: 1 },
    createdAt: { createdAt: direction, _id: 1 },
  };

  const resolvedSort =
    sort ||
    (sortBy ? sortMap[sortBy] || { [sortBy]: direction, _id: 1 } : { createdAt: -1 });

  const needsAggregate = Boolean(queryText || sortBy === "merchant");

  if (!needsAggregate) {
    let query = Branch.find(match)
      .populate("merchantId", "name slug type")
      .populate("managerUserIds", "name email")
      .sort(resolvedSort);

    if (page && limit) {
      const total = await Branch.countDocuments(match);
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

  const regex = queryText ? new RegExp(queryText, "i") : null;
  const sortStage = Object.fromEntries(
    Object.entries(resolvedSort).map(([field, dir]) => [field, dir])
  );
  const basePipeline = [
    { $match: match },
    {
      $lookup: {
        from: "merchants",
        localField: "merchantId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, slug: 1, type: 1 } }],
        as: "merchantId",
      },
    },
    {
      $unwind: {
        path: "$merchantId",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "managerUserIds",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, email: 1 } }],
        as: "managerUserIds",
      },
    },
    ...(regex
      ? [
          {
            $match: {
              $or: [
                { name: regex },
                { code: regex },
                { "merchantId.name": regex },
              ],
            },
          },
        ]
      : []),
  ];
  const [result] = await Branch.aggregate([
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

export const findNearbyBranchesWithMerchant = async ({
  lat,
  lng,
  maxDistanceMeters,
  branchQuery = {},
}) => {
  const executePipeline = () =>
    Branch.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)],
          },
          distanceField: "distance",
          maxDistance: maxDistanceMeters,
          query: {
            isOpen: true,
            status: "active",
            ...branchQuery,
          },
          spherical: true,
        },
      },
      {
        $lookup: {
          from: "merchants",
          localField: "merchantId",
          foreignField: "_id",
          as: "merchant",
        },
      },
      {
        $unwind: "$merchant",
      },
      {
        $match: {
          "merchant.status": "active",
        },
      },
    ]);

  try {
    await Branch.init();
    return await executePipeline();
  } catch (err) {
    if (err.message && err.message.includes("no geo index")) {
      await Branch.createIndexes();
      return await executePipeline();
    }
    throw err;
  }
};
