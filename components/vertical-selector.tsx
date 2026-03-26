"use client";

import { Check, ChevronDown, Layers3 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getVerticalUi } from "@/utils/vertical-ui";

type VerticalSelectorProps = {
  verticals: string[];
  value: string;
  onChange: (vertical: string) => void;
  disabled?: boolean;
  allOptionValue?: string;
};

const ALL_VERTICALS_LABEL = "Todas as verticais";

function VerticalSvgIcon({ iconSrc }: { iconSrc: string }) {
  return (
    <span
      className="size-4 bg-current"
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url(${iconSrc})`,
        maskImage: `url(${iconSrc})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain"
      }}
    />
  );
}

function getWrappedIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return -1;
  }

  if (current < 0) {
    return delta > 0 ? 0 : total - 1;
  }

  return (current + delta + total) % total;
}

export function VerticalSelector({
  verticals,
  value,
  onChange,
  disabled = false,
  allOptionValue
}: VerticalSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const options = useMemo(() => {
    const verticalOptions = verticals.map((vertical) => ({
      value: vertical,
      label: vertical
    }));

    if (!allOptionValue) {
      return verticalOptions;
    }

    return [
      {
        value: allOptionValue,
        label: ALL_VERTICALS_LABEL
      },
      ...verticalOptions
    ];
  }, [allOptionValue, verticals]);

  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? {
    value: "",
    label: "Sem verticais"
  };
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedIsAll = Boolean(allOptionValue) && selectedOption.value === allOptionValue;
  const selectedUi = selectedIsAll ? null : getVerticalUi(selectedOption.label);
  const SelectedFallbackIcon = selectedUi?.icon;

  function closeMenu(restoreFocus = false): void {
    setIsOpen(false);
    setFocusedIndex(-1);

    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

  function openMenu(startIndex?: number): void {
    if (disabled || options.length === 0) {
      return;
    }

    const nextIndex =
      typeof startIndex === "number" && startIndex >= 0
        ? startIndex
        : selectedIndex >= 0
          ? selectedIndex
          : 0;

    setIsOpen(true);
    setFocusedIndex(nextIndex);
  }

  function selectOptionByIndex(index: number): void {
    const option = options[index];
    if (!option) {
      return;
    }

    onChange(option.value);
    closeMenu(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled || options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        setFocusedIndex((current) => getWrappedIndex(current, 1, options.length));
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      } else {
        setFocusedIndex((current) => getWrappedIndex(current, -1, options.length));
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (focusedIndex >= 0) {
        selectOptionByIndex(focusedIndex);
      }
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((current) => getWrappedIndex(current, 1, options.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((current) => getWrappedIndex(current, -1, options.length));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (focusedIndex >= 0) {
        selectOptionByIndex(focusedIndex);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      closeMenu(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (!target || !rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(target)) {
        closeMenu(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options.length]);

  useEffect(() => {
    if (!isOpen || focusedIndex < 0) {
      return;
    }

    optionRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, isOpen]);

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">Vertical</span>
      <div ref={rootRef} className="relative w-full min-w-0">
        <button
          ref={triggerRef}
          type="button"
          className="flex h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-ink outline-none transition focus-visible:border-viasoft focus-visible:ring-2 focus-visible:ring-viasoft/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          disabled={disabled}
          onClick={() => {
            if (isOpen) {
              closeMenu(false);
            } else {
              openMenu();
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md ${
                selectedIsAll ? "bg-viasoft/10 text-viasoft" : selectedUi?.chipClassName
              }`}
            >
              {selectedIsAll ? (
                <Layers3 size={14} className="text-viasoft" />
              ) : selectedUi?.iconSrc ? (
                <VerticalSvgIcon iconSrc={selectedUi.iconSrc} />
              ) : SelectedFallbackIcon ? (
                <SelectedFallbackIcon size={14} className={selectedUi?.iconClassName ?? "text-viasoft"} />
              ) : null}
            </span>
            <span className="block min-w-0 truncate text-left">{selectedOption.label}</span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition ${isOpen ? "rotate-180" : ""} ${disabled ? "text-slate-400" : "text-slate-500"}`}
          />
        </button>

        {isOpen && !disabled ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-300/30">
            <ul id={listboxId} className="max-h-72 overflow-auto" role="listbox" aria-label="Selecao de vertical">
              {options.map((option, index) => {
                const selected = option.value === value;
                const isAllOption = Boolean(allOptionValue) && option.value === allOptionValue;
                const optionUi = isAllOption ? null : getVerticalUi(option.label);
                const OptionFallbackIcon = optionUi?.icon;

                return (
                  <li key={option.value}>
                    <button
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                        selected ? "bg-viasoft/10 text-viasoft" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => selectOptionByIndex(index)}
                      onKeyDown={handleOptionKeyDown}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md ${
                            isAllOption ? "bg-viasoft/10 text-viasoft" : optionUi?.chipClassName
                          }`}
                        >
                          {isAllOption ? (
                            <Layers3 size={14} className="text-viasoft" />
                          ) : optionUi?.iconSrc ? (
                            <VerticalSvgIcon iconSrc={optionUi.iconSrc} />
                          ) : OptionFallbackIcon ? (
                            <OptionFallbackIcon size={14} className={optionUi?.iconClassName ?? "text-viasoft"} />
                          ) : null}
                        </span>
                        <span className="block min-w-0 truncate">{option.label}</span>
                      </span>
                      {selected ? <Check size={14} className="shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
