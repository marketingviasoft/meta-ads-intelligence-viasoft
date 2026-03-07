"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { MetaCampaign } from "@/lib/types";

type CampaignSelectorProps = {
  campaigns: MetaCampaign[];
  value: string;
  onChange: (campaignId: string) => void;
  disabled?: boolean;
};

function getWrappedIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return -1;
  }

  if (current < 0) {
    return delta > 0 ? 0 : total - 1;
  }

  return (current + delta + total) % total;
}

export function CampaignSelector({
  campaigns,
  value,
  onChange,
  disabled = false
}: CampaignSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const options = useMemo(
    () =>
      campaigns.map((campaign) => ({
        value: campaign.id,
        label: campaign.name
      })),
    [campaigns]
  );

  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);

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
      <span
        className={`text-xs font-semibold uppercase tracking-[0.08em] ${
          disabled ? "text-[#aaaaaa]" : "text-viasoft"
        }`}
      >
        Campanhas ativas
      </span>
      <div ref={rootRef} className="relative w-full min-w-0">
        <button
          ref={triggerRef}
          type="button"
          className={`flex h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium outline-none transition ${
            disabled
              ? "cursor-default border-[#e4e4e4] bg-[#e4e4e4] text-[#aaaaaa]"
              : "border-slate-300 bg-white text-ink focus-visible:border-viasoft focus-visible:ring-2 focus-visible:ring-viasoft/25"
          }`}
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
          aria-disabled={disabled}
        >
          <span className="block min-w-0 flex-1 truncate text-left">
            {selectedOption?.label ?? "Sem campanhas ativas"}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition ${isOpen && !disabled ? "rotate-180" : ""} ${
              disabled ? "text-[#aaaaaa]" : "text-slate-500"
            }`}
          />
        </button>

        {isOpen && !disabled ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-300/30">
            <ul id={listboxId} className="max-h-72 overflow-auto" role="listbox" aria-label="Selecao de campanha">
              {options.map((option, index) => {
                const selected = option.value === value;

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
                      <span className="block min-w-0 flex-1 truncate">{option.label}</span>
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
