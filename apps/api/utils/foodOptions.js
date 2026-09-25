import crypto from "crypto";
import AppError from "./AppError.js";

/**
 * Validate a customer's picks against the dish's own option groups and return
 * them normalised, with every priceDelta taken from the database.
 *
 * The client is never trusted for price: it may name a group and an option,
 * and nothing else. Anything it sends as priceDelta is discarded.
 *
 * @returns {Array<{groupName: string, optionName: string, priceDelta: number}>}
 *          Sorted deterministically so the same picks always hash alike.
 */
export const resolveSelectedOptions = (food, selectedOptions = []) => {
  const groups = food.optionGroups || [];
  const picks = Array.isArray(selectedOptions) ? selectedOptions : [];

  // Reject picks that name a group this dish doesn't have.
  picks.forEach((pick) => {
    if (!groups.some((group) => group.name === pick.groupName)) {
      throw new AppError(`Unknown option group "${pick.groupName}"`, 400);
    }
  });

  const resolved = [];

  groups.forEach((group) => {
    const groupPicks = picks.filter((pick) => pick.groupName === group.name);

    groupPicks.forEach((pick) => {
      const option = group.options.find((o) => o.name === pick.optionName);
      if (!option) {
        throw new AppError(
          `"${pick.optionName}" is not an option in "${group.name}"`,
          400
        );
      }
      resolved.push({
        groupName: group.name,
        optionName: option.name,
        priceDelta: option.priceDelta || 0,
      });
    });

    // Duplicate picks of the same option would double-charge it.
    const names = groupPicks.map((pick) => pick.optionName);
    if (new Set(names).size !== names.length) {
      throw new AppError(`Duplicate selection in "${group.name}"`, 400);
    }

    if (group.type === "single") {
      if (groupPicks.length > 1) {
        throw new AppError(`Pick only one option in "${group.name}"`, 400);
      }
      if (group.required && groupPicks.length === 0) {
        throw new AppError(`"${group.name}" is required`, 400);
      }
    } else {
      const min = group.required ? Math.max(group.min || 0, 1) : group.min || 0;
      if (groupPicks.length < min) {
        throw new AppError(
          `Pick at least ${min} option(s) in "${group.name}"`,
          400
        );
      }
      // max = 0 means unlimited.
      if (group.max > 0 && groupPicks.length > group.max) {
        throw new AppError(
          `Pick at most ${group.max} option(s) in "${group.name}"`,
          400
        );
      }
    }
  });

  return resolved.sort(
    (a, b) =>
      a.groupName.localeCompare(b.groupName) ||
      a.optionName.localeCompare(b.optionName)
  );
};

/**
 * Stable identifier for a cart line. Two lines merge only when they are the
 * same dish with the same options — a note never splits a line, it just rides
 * along with the most recent value.
 */
export const buildLineKey = (foodId, resolvedOptions = []) => {
  const signature = resolvedOptions
    .map((option) => `${option.groupName}:${option.optionName}`)
    .join("|");
  return crypto
    .createHash("sha1")
    .update(`${foodId}::${signature}`)
    .digest("hex")
    .slice(0, 24);
};

/** Base price plus every selected option's surcharge. */
export const computeUnitPrice = (food, resolvedOptions = []) =>
  resolvedOptions.reduce(
    (total, option) => total + (option.priceDelta || 0),
    food.price
  );
