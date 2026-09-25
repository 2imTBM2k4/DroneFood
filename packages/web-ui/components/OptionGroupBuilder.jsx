import React from "react";
import "./OptionGroupBuilder.css";

/**
 * Editor for a dish's option groups, shared by the restaurant and admin apps.
 *
 * Controlled component: `value` is the array stored on the dish, `onChange`
 * receives the next array. It mirrors backend/models/foodModel.cjs —
 * { name, type, required, min, max, options: [{ name, priceDelta }] }.
 *
 * Single-choice groups don't expose min/max: the backend forces them to
 * exactly one pick, so showing the fields would only invite contradictions.
 */

const emptyGroup = () => ({
  name: "",
  type: "single",
  required: false,
  min: 0,
  max: 0,
  options: [{ name: "", priceDelta: 0 }],
});

/**
 * Validate before submit. Returns an array of human-readable problems;
 * an empty array means the groups are safe to send.
 */
export const validateOptionGroups = (groups = []) => {
  const problems = [];

  groups.forEach((group, groupIndex) => {
    const label = group.name?.trim() || `Group ${groupIndex + 1}`;

    if (!group.name?.trim()) {
      problems.push(`${label}: name is required`);
    }
    if (!group.options?.length) {
      problems.push(`${label}: add at least one option`);
    }

    const names = [];
    (group.options || []).forEach((option, optionIndex) => {
      const optionLabel = option.name?.trim();
      if (!optionLabel) {
        problems.push(`${label}: option ${optionIndex + 1} needs a name`);
        return;
      }
      if (names.includes(optionLabel)) {
        problems.push(`${label}: "${optionLabel}" appears twice`);
      }
      names.push(optionLabel);

      if (Number(option.priceDelta) < 0) {
        problems.push(`${label} / ${optionLabel}: surcharge cannot be negative`);
      }
    });

    if (group.type === "multi") {
      const min = Number(group.min) || 0;
      const max = Number(group.max) || 0;
      if (max > 0 && min > max) {
        problems.push(`${label}: min cannot exceed max`);
      }
      if (max > (group.options?.length || 0)) {
        problems.push(`${label}: max cannot exceed the number of options`);
      }
      if (group.required && min < 1) {
        problems.push(`${label}: a required group needs min of at least 1`);
      }
    }
  });

  const groupNames = groups.map((group) => group.name?.trim()).filter(Boolean);
  if (new Set(groupNames).size !== groupNames.length) {
    problems.push("Two groups share the same name");
  }

  return problems;
};

/** Strip empties and coerce numbers so the payload matches the Joi schema. */
export const normaliseOptionGroups = (groups = []) =>
  groups
    .filter((group) => group.name?.trim() && group.options?.length)
    .map((group) => ({
      name: group.name.trim(),
      type: group.type,
      required: Boolean(group.required),
      min: group.type === "single" ? (group.required ? 1 : 0) : Number(group.min) || 0,
      max: group.type === "single" ? 1 : Number(group.max) || 0,
      options: group.options
        .filter((option) => option.name?.trim())
        .map((option) => ({
          name: option.name.trim(),
          priceDelta: Number(option.priceDelta) || 0,
        })),
    }));

const OptionGroupBuilder = ({ value = [], onChange }) => {
  const updateGroup = (index, patch) => {
    onChange(
      value.map((group, i) => (i === index ? { ...group, ...patch } : group))
    );
  };

  const updateOption = (groupIndex, optionIndex, patch) => {
    onChange(
      value.map((group, i) =>
        i !== groupIndex
          ? group
          : {
              ...group,
              options: group.options.map((option, j) =>
                j === optionIndex ? { ...option, ...patch } : option
              ),
            }
      )
    );
  };

  const addGroup = () => onChange([...value, emptyGroup()]);

  const removeGroup = (index) =>
    onChange(value.filter((_, i) => i !== index));

  const addOption = (groupIndex) =>
    updateGroup(groupIndex, {
      options: [...value[groupIndex].options, { name: "", priceDelta: 0 }],
    });

  const removeOption = (groupIndex, optionIndex) =>
    updateGroup(groupIndex, {
      options: value[groupIndex].options.filter((_, j) => j !== optionIndex),
    });

  return (
    <div className="ogb">
      <div className="ogb-head">
        <p className="ogb-title">Option groups</p>
        <span className="ogb-hint">
          Sizes, toppings, anything the customer picks. Leave empty if the dish
          has no choices.
        </span>
      </div>

      {value.map((group, groupIndex) => (
        <fieldset className="ogb-group" key={groupIndex}>
          <div className="ogb-group-head">
            <input
              type="text"
              className="ogb-input ogb-group-name"
              placeholder="Group name (e.g. Size)"
              value={group.name}
              onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
            />
            <select
              className="ogb-input ogb-select"
              value={group.type}
              onChange={(e) => updateGroup(groupIndex, { type: e.target.value })}
            >
              <option value="single">Pick one</option>
              <option value="multi">Pick many</option>
            </select>
            <label className="ogb-check">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(e) =>
                  updateGroup(groupIndex, { required: e.target.checked })
                }
              />
              Required
            </label>
            <button
              type="button"
              className="ogb-remove"
              onClick={() => removeGroup(groupIndex)}
              aria-label={`Remove group ${group.name || groupIndex + 1}`}
            >
              Remove group
            </button>
          </div>

          {group.type === "multi" && (
            <div className="ogb-limits">
              <label className="ogb-limit">
                Min
                <input
                  type="number"
                  min="0"
                  className="ogb-input ogb-number"
                  value={group.min}
                  onChange={(e) =>
                    updateGroup(groupIndex, { min: e.target.value })
                  }
                />
              </label>
              <label className="ogb-limit">
                Max
                <input
                  type="number"
                  min="0"
                  className="ogb-input ogb-number"
                  value={group.max}
                  onChange={(e) =>
                    updateGroup(groupIndex, { max: e.target.value })
                  }
                />
              </label>
              <span className="ogb-hint">0 = no limit</span>
            </div>
          )}

          <div className="ogb-options">
            {group.options.map((option, optionIndex) => (
              <div className="ogb-option" key={optionIndex}>
                <input
                  type="text"
                  className="ogb-input"
                  placeholder="Option name (e.g. Large)"
                  value={option.name}
                  onChange={(e) =>
                    updateOption(groupIndex, optionIndex, {
                      name: e.target.value,
                    })
                  }
                />
                <div className="ogb-price">
                  <span className="ogb-price-sign">+₫</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="ogb-input ogb-number"
                    value={option.priceDelta}
                    onChange={(e) =>
                      updateOption(groupIndex, optionIndex, {
                        priceDelta: e.target.value,
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="ogb-remove ogb-remove-option"
                  onClick={() => removeOption(groupIndex, optionIndex)}
                  disabled={group.options.length === 1}
                  aria-label="Remove option"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ogb-add-option"
              onClick={() => addOption(groupIndex)}
            >
              + Add option
            </button>
          </div>
        </fieldset>
      ))}

      <button type="button" className="ogb-add-group" onClick={addGroup}>
        + Add option group
      </button>
    </div>
  );
};

export default OptionGroupBuilder;
