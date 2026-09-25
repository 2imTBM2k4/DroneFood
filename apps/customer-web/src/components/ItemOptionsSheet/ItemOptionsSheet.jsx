import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Minus } from "lucide-react";
import { toast } from "react-toastify";
import "./ItemOptionsSheet.css";
import { StoreContext } from "../../context/StoreContext";
import { assets } from "../../assets/assets";
import { formatVND } from "../../../../shared/utils/money";

/**
 * The dish sheet: options, quantity, kitchen note, live price.
 *
 * A modal on desktop and a bottom sheet on mobile — same component, the
 * difference is CSS. Dishes with no option groups still use it, they just
 * show quantity and a note.
 *
 * Props:
 *   item          the dish (needs name, price, image, optionGroups)
 *   onClose       close without adding
 *   initial       { quantity, selectedOptions, note } to pre-fill when editing
 *                 an existing cart line
 *   onSubmit      overrides the default add-to-cart, for editing a line
 *   submitLabel   defaults to "Add to cart"
 */
const ItemOptionsSheet = ({
  item,
  onClose,
  initial,
  onSubmit,
  submitLabel = "Add to cart",
}) => {
  const { addToCart, url } = useContext(StoreContext);
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  const groups = useMemo(() => item?.optionGroups || [], [item]);

  const [quantity, setQuantity] = useState(initial?.quantity || 1);
  const [note, setNote] = useState(initial?.note || "");
  const [submitting, setSubmitting] = useState(false);

  // selections: { [groupName]: string[] } — one entry for single-choice
  // groups, any number for multi-choice ones.
  const [selections, setSelections] = useState(() => {
    const initialSelections = {};
    groups.forEach((group) => {
      initialSelections[group.name] = (initial?.selectedOptions || [])
        .filter((option) => option.groupName === group.name)
        .map((option) => option.optionName);
    });
    return initialSelections;
  });

  // Trap focus inside the sheet, close on Escape, and freeze the page behind.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((el) => !el.disabled && el.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  if (!item) return null;

  const imageSrc = item.image?.startsWith("http")
    ? item.image
    : `${url}/images/${item.image}`;

  const toggleOption = (group, optionName) => {
    setSelections((current) => {
      const picked = current[group.name] || [];

      if (group.type === "single") {
        // Re-clicking the chosen option clears it, unless the group is required.
        const next =
          picked[0] === optionName && !group.required ? [] : [optionName];
        return { ...current, [group.name]: next };
      }

      if (picked.includes(optionName)) {
        return {
          ...current,
          [group.name]: picked.filter((name) => name !== optionName),
        };
      }
      if (group.max > 0 && picked.length >= group.max) {
        toast.info(`Pick at most ${group.max} in "${group.name}"`);
        return current;
      }
      return { ...current, [group.name]: [...picked, optionName] };
    });
  };

  const selectedOptions = groups.flatMap((group) =>
    (selections[group.name] || []).map((optionName) => ({
      groupName: group.name,
      optionName,
    }))
  );

  // Mirror of the server's pricing so the button can show a live total.
  const unitPrice = groups.reduce((total, group) => {
    const picked = selections[group.name] || [];
    return (
      total +
      picked.reduce((sum, optionName) => {
        const option = group.options.find((o) => o.name === optionName);
        return sum + (option?.priceDelta || 0);
      }, 0)
    );
  }, item.price);

  /** Which required rule, if any, is currently unmet. */
  const missingGroup = groups.find((group) => {
    const picked = selections[group.name] || [];
    if (group.type === "single") return group.required && picked.length === 0;
    const min = group.required ? Math.max(group.min || 0, 1) : group.min || 0;
    return picked.length < min;
  });

  const handleSubmit = async () => {
    if (missingGroup) {
      toast.warning(`Please choose from "${missingGroup.name}"`);
      return;
    }
    setSubmitting(true);
    try {
      const succeeded = onSubmit
        ? await onSubmit({ quantity, selectedOptions, note: note.trim() })
        : await addToCart(item._id, quantity, selectedOptions, note.trim());

      if (succeeded) {
        if (!onSubmit) toast.success("Added to cart!");
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requirementLabel = (group) => {
    if (group.type === "single") return group.required ? "Required" : "Optional";
    if (group.required || group.min > 0) {
      const min = group.required ? Math.max(group.min || 0, 1) : group.min;
      return group.max > 0 ? `Choose ${min}–${group.max}` : `Choose ${min}+`;
    }
    return group.max > 0 ? `Up to ${group.max}` : "Optional";
  };

  // Portalled to <body> so no transformed ancestor can capture the overlay's
  // position:fixed or trap it in a stacking context.
  return createPortal(
    <div className="ios-overlay" onClick={onClose}>
      <div
        className="ios-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ios-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="ios-scroll">
          <div className="ios-hero">
            <img
              src={imageSrc}
              alt={item.name}
              onError={(e) => {
                e.target.src = assets.sample_food || assets.logo;
              }}
            />
          </div>

          <div className="ios-body">
            <div className="ios-heading">
              <h2>{item.name}</h2>
            </div>
            <p className="ios-desc">{item.description}</p>
            <p className="ios-base-price ds-num">{formatVND(item.price)}</p>

            {groups.map((group) => (
              <fieldset className="ios-group" key={group.name}>
                <legend className="ios-group-head">
                  <span className="ios-group-name">{group.name}</span>
                  <span className="ds-label">{requirementLabel(group)}</span>
                </legend>

                <div className="ios-options">
                  {group.options.map((option) => {
                    const picked = (selections[group.name] || []).includes(
                      option.name
                    );
                    return (
                      <label
                        key={option.name}
                        className={`ios-option ${picked ? "picked" : ""}`}
                      >
                        <input
                          type={group.type === "single" ? "radio" : "checkbox"}
                          name={`group-${group.name}`}
                          checked={picked}
                          onChange={() => toggleOption(group, option.name)}
                        />
                        <span className="ios-option-name">{option.name}</span>
                        {option.priceDelta > 0 && (
                          <span className="ios-option-price ds-num">
                            +{formatVND(option.priceDelta)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <label className="ios-note">
              <span className="ds-label">Note for the kitchen</span>
              <textarea
                rows={2}
                maxLength={200}
                value={note}
                placeholder="e.g. no coriander, extra spicy"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="ios-footer">
          <div className="ios-stepper">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={15} strokeWidth={2.5} />
            </button>
            <span className="ds-num" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              disabled={quantity >= 99}
              aria-label="Increase quantity"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>

          <button
            type="button"
            className="ios-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              "Saving…"
            ) : (
              <>
                {submitLabel}
                <span className="ios-submit-sep">·</span>
                <span className="ds-num">
                  {formatVND(unitPrice * quantity)}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ItemOptionsSheet;
