"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };
export type SelectGroup = { group: string; options: SelectOption[] };
export type SelectItem = SelectOption | SelectGroup;

const isGroup = (item: SelectItem): item is SelectGroup => "group" in item;

function placement(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  let bounds = {
    top: 0,
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
  };
  let node = trigger.parentElement;
  while (node && node !== document.body) {
    if (/(auto|scroll|hidden)/.test(getComputedStyle(node).overflowY)) {
      const r = node.getBoundingClientRect();
      bounds = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      break;
    }
    node = node.parentElement;
  }
  const below = bounds.bottom - rect.bottom - 10;
  const above = rect.top - bounds.top - 10;
  const place = below >= 232 || below >= above ? "below" : "above";
  return {
    place,
    maxHeight: Math.max(150, Math.min(300, place === "below" ? below : above)),
    align: rect.left + 240 > bounds.right - 8 ? "right" : "left",
  };
}

export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  searchable = true,
  disabled = false,
  compact = false,
  className = "",
  style,
  ariaLabel,
}: {
  options: SelectItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const flat = useMemo(
    () => options.flatMap((item) => (isGroup(item) ? item.options : [item])),
    [options],
  );
  const [inner, setInner] = useState(defaultValue ?? flat[0]?.value ?? "");
  const current = value !== undefined ? value : inner;
  const selected = flat.find((option) => option.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({
    place: "below",
    maxHeight: 300,
    align: "left",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const listId = `${id}-list`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (option: SelectOption) =>
      !q ||
      `${option.label} ${option.value} ${option.hint ?? ""}`
        .toLowerCase()
        .includes(q);
    return options
      .map((item) =>
        isGroup(item)
          ? { group: item.group, options: item.options.filter(match) }
          : { group: "", options: match(item) ? [item] : [] },
      )
      .filter((entry) => entry.options.length);
  }, [options, query]);
  const filteredFlat = useMemo(
    () => filtered.flatMap((entry) => entry.options),
    [filtered],
  );

  function show() {
    if (disabled) return;
    if (triggerRef.current) setPos(placement(triggerRef.current));
    setQuery("");
    setActive(Math.max(0, flat.findIndex((o) => o.value === current)));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }
  function commit(next: string) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    const target = searchable ? searchRef.current : popRef.current;
    target?.focus({ preventScroll: true });
    function outside(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function resize() {
      if (triggerRef.current) setPos(placement(triggerRef.current));
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!filteredFlat.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(
        (i) => (i + step + filteredFlat.length) % filteredFlat.length,
      );
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : filteredFlat.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const option = filteredFlat[active];
      if (option) commit(option.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  let optionIndex = -1;
  const popPlace =
    pos.place === "above"
      ? "bottom-[calc(100%+6px)] animate-pop-in-above"
      : "top-[calc(100%+6px)] animate-pop-in";
  const popAlign = pos.align === "right" ? "left-auto right-0" : "left-0";
  const popOrigin =
    pos.place === "above"
      ? pos.align === "right"
        ? "origin-bottom-right"
        : "origin-bottom-left"
      : pos.align === "right"
        ? "origin-top-right"
        : "origin-top-left";
  return (
    <div
      ref={rootRef}
      data-select=""
      className={`relative ${className}`}
      style={style}
    >
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 border bg-white text-left transition-[border-color,box-shadow] duration-[160ms] disabled:cursor-not-allowed disabled:bg-[#f4f6f5] disabled:opacity-55 ${
          compact
            ? "min-h-[37px] rounded-[6px] px-[10px] py-[7px] text-[11px] max-md:min-h-[42px]"
            : "min-h-[44px] rounded-[7px] px-3 py-[11px] text-[length:inherit] max-md:min-h-[48px]"
        } ${
          open
            ? "border-green shadow-[0_0_0_3px_#21765b15] outline-none"
            : "border-field hover:enabled:border-[#b9cec2]"
        }`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span
          className={`min-w-0 truncate ${selected ? "" : "text-[#9aa39e]"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`transition-[transform,color] duration-[180ms] ${
            open ? "rotate-180 text-green" : "text-muted"
          }`}
        />
      </button>
      {open && (
        <div
          ref={popRef}
          tabIndex={-1}
          className={`absolute z-[70] flex w-max min-w-full max-w-[min(340px,calc(100vw-24px))] flex-col items-stretch gap-0 overflow-hidden rounded-[10px] border border-[#dbe4dd] bg-white shadow-[0_14px_44px_#10352426,0_2px_8px_#10352414] outline-none ${popPlace} ${popAlign} ${popOrigin}`}
          style={{ maxHeight: pos.maxHeight }}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
        >
          {searchable && (
            <div className="flex items-center gap-[7px] border-b border-line bg-paper px-[10px] py-2 text-muted">
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                placeholder={searchPlaceholder}
                aria-label={`Search ${ariaLabel ?? "options"}`}
                aria-controls={listId}
                className="min-h-[28px] w-full rounded-none border-0 bg-transparent p-[2px] text-[12px] focus:border-0 focus:shadow-none"
                aria-activedescendant={
                  filteredFlat[active]
                    ? `${id}-opt-${active}`
                    : undefined
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="flex size-5 min-h-0 shrink-0 items-center justify-center rounded-[5px] border-0 bg-[#e7ede9] p-0 text-muted hover:bg-[#d8e2dc] hover:text-ink"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setActive(0);
                    searchRef.current?.focus();
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          <div
            ref={listRef}
            role="listbox"
            id={listId}
            aria-label={ariaLabel}
            className="flex-1 overflow-y-auto overscroll-contain p-[5px]"
          >
            {filtered.map((entry) => (
              <div
                key={entry.group || entry.options[0].value}
                role={entry.group ? "group" : undefined}
                aria-label={entry.group || undefined}
              >
                {entry.group && (
                  <div className="px-[9px] pt-[7px] pb-1 text-[9.5px] font-bold tracking-[0.9px] text-[#8b958f] uppercase">
                    {entry.group}
                  </div>
                )}
                {entry.options.map((option) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  const isSelected = option.value === current;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      id={`${id}-opt-${index}`}
                      data-active={index === active}
                      className={`flex w-full items-center gap-2 rounded-[7px] border-0 bg-transparent text-left data-[active=true]:bg-mint ${
                        compact
                          ? "px-2 py-[7px] text-[11.5px]"
                          : "px-[9px] py-2 text-[12.5px]"
                      } ${
                        isSelected
                          ? "font-semibold text-green-dark"
                          : "text-ink"
                      }`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => commit(option.value)}
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.hint && (
                        <span className="max-w-[45%] truncate text-[10.5px] font-normal text-muted">
                          {option.hint}
                        </span>
                      )}
                      {isSelected && <Check size={14} className="text-green" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {!filteredFlat.length && (
              <div className="px-3 py-4 text-center text-[12px] text-muted">
                No matches for “{query.trim()}”
              </div>
            )}
          </div>
          <div className="flex justify-between gap-[10px] border-t border-line bg-paper px-[11px] py-[6px] text-[9.5px] tracking-[0.2px] text-[#939d97]">
            <span>
              {filteredFlat.length} of {flat.length}
            </span>
            <span>↑↓ navigate · ↵ select · esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}