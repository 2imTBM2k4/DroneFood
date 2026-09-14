import Joi from "joi";

const optionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required().messages({
    "any.required": "Mỗi lựa chọn phải có tên",
  }),
  priceDelta: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Phụ phí không được âm",
    "number.integer": "Phụ phí phải là số tiền VND nguyên",
  }),
});

const optionGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required().messages({
    "any.required": "Mỗi nhóm lựa chọn phải có tên",
  }),
  type: Joi.string().valid("single", "multi").default("single"),
  required: Joi.boolean().default(false),
  min: Joi.number().integer().min(0).default(0),
  max: Joi.number().integer().min(0).default(0),
  options: Joi.array().items(optionSchema).min(1).required().messages({
    "array.min": "Mỗi nhóm lựa chọn phải có ít nhất một lựa chọn",
    "any.required": "Mỗi nhóm lựa chọn phải có ít nhất một lựa chọn",
  }),
})
  .custom((group, helpers) => {
    if (group.type === "single") {
      // A radio group is exactly one pick; min/max are meaningless there.
      return { ...group, min: group.required ? 1 : 0, max: 1 };
    }
    if (group.max > 0 && group.min > group.max) {
      return helpers.error("any.invalid");
    }
    if (group.max > 0 && group.max > group.options.length) {
      return helpers.error("any.invalid");
    }
    return group;
  })
  .messages({
    "any.invalid":
      "Nhóm lựa chọn không hợp lệ: min phải <= max và max phải <= số lựa chọn",
  });

/**
 * Option groups arrive inside multipart/form-data, so they reach us as a JSON
 * string. Parse it before the array rules run; an already-parsed array (JSON
 * request body) passes straight through.
 */
const optionGroupsField = Joi.alternatives()
  .try(
    Joi.array().items(optionGroupSchema),
    Joi.string()
      .allow("")
      .custom((value, helpers) => {
        if (value === "") return [];
        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch {
          return helpers.error("any.invalid");
        }
        const { error, value: validated } = Joi.array()
          .items(optionGroupSchema)
          .validate(parsed, { abortEarly: false });
        if (error) return helpers.error("any.invalid", { detail: error.message });
        return validated;
      })
  )
  .messages({
    "any.invalid": "optionGroups không hợp lệ",
  });

export const addFoodSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Tên món ăn là bắt buộc",
    "string.min": "Tên món ăn phải có ít nhất 2 ký tự",
  }),
  description: Joi.string().trim().max(500).required().messages({
    "any.required": "Mô tả là bắt buộc",
  }),
  price: Joi.number().integer().positive().required().messages({
    "number.positive": "Giá phải là số dương",
    "number.integer": "Giá phải là số tiền VND nguyên",
    "any.required": "Giá là bắt buộc",
  }),
  category: Joi.string().trim().min(1).max(50).required().messages({
    "any.required": "Danh mục là bắt buộc",
  }),
  optionGroups: optionGroupsField.default([]),
});

export const updateFoodSchema = Joi.object({
  id: Joi.string().trim().required().messages({
    "any.required": "ID món ăn là bắt buộc",
  }),
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500),
  price: Joi.number().integer().positive().messages({
    "number.positive": "Giá phải là số dương",
    "number.integer": "Giá phải là số tiền VND nguyên",
  }),
  category: Joi.string().trim().min(1).max(50),
  optionGroups: optionGroupsField,
});

export const removeFoodSchema = Joi.object({
  id: Joi.string().trim().required().messages({
    "any.required": "ID món ăn là bắt buộc",
  }),
});

export const listFoodQuerySchema = Joi.object({
  restaurantId: Joi.string().trim().allow("", null),
});
