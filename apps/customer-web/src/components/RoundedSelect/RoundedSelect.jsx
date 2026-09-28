import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./RoundedSelect.css";

const normaliseOptions = (options) => options.map((option) => ({
  value: String(option.value),
  label: option.label,
}));

const RoundedSelect = ({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  size = "regular",
}) => {
  const generatedId = useId().replace(/:/g, "");
  const controlId = id || `rounded-select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const items = useMemo(() => normaliseOptions(options), [options]);
  const selectedIndex = Math.max(0, items.findIndex((option) => option.value === String(value)));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selectedOption = items[selectedIndex] || items[0];

  useEffect(() => {
    if (!open) setHighlightedIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const choose = (index) => {
    const option = items[index];
    if (!option) return;
    onChange(option.value);
    setHighlightedIndex(index);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event) => {
    if (items.length === 0) return;
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        setOpen(true);
        setHighlightedIndex(selectedIndex);
      } else {
        setHighlightedIndex((current) => (current + direction + items.length) % items.length);
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(event.key === "Home" ? 0 : items.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(highlightedIndex);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`rounded-select rounded-select--${size} ${open ? "is-open" : ""} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        className="rounded-select__trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${highlightedIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span className="rounded-select__value">{selectedOption?.label || ""}</span>
        <ChevronDown className="rounded-select__chevron" size={16} aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="rounded-select__menu" role="listbox" aria-label={ariaLabel}>
          {items.map((option, index) => {
            const selected = option.value === String(value);
            const highlighted = index === highlightedIndex;
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={option.value || `empty-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                className={`rounded-select__option ${selected ? "is-selected" : ""} ${highlighted ? "is-highlighted" : ""}`}
                onPointerMove={() => setHighlightedIndex(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {selected && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoundedSelect;
