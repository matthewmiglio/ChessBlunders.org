"use client";

import { useState } from "react";
import {
  PuzzleFilters,
  FilterCounts,
  filterLabels,
  GamePhase,
  Severity,
  TimeControl,
  PieceType,
  ResultCategory,
  DateRange,
  OpeningFamily,
} from "@/lib/puzzle-filters";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}

function FilterChip({ active, onClick, children, count }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
        active
          ? "bg-[#8a2be2] text-white"
          : "bg-[#3c3c3c] text-[#b4b4b4] hover:bg-[#4c4c4c]"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`ml-1.5 ${active ? "text-white/70" : "text-[#808080]"}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function FilterGroup({ label, children, isExpanded, onToggle }: FilterGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-medium text-[#808080] uppercase tracking-wider hover:text-[#b4b4b4] transition-colors"
      >
        <span>{label}</span>
        {onToggle && (
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>
      {(isExpanded === undefined || isExpanded) && (
        <div className="flex flex-wrap gap-2">{children}</div>
      )}
    </div>
  );
}

interface FilterBarProps {
  filters: PuzzleFilters;
  onChange: (filters: PuzzleFilters) => void;
  counts: FilterCounts | null;
  loading?: boolean;
}

export function FilterBar({ filters, onChange, counts, loading }: FilterBarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["phase", "severity"])
  );

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const updateFilter = <K extends keyof PuzzleFilters>(
    key: K,
    value: PuzzleFilters[K] | undefined
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onChange({});
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined
  ).length;

  if (loading) {
    return (
      <div className="bg-[#202020] border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 text-[#b4b4b4]">
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Loading filters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#f5f5f5]">Filter Puzzles</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-[#8a2be2] hover:text-[#a855f7] transition-colors"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filter Groups */}
      <div className="space-y-4">
        {/* Game Phase */}
        <FilterGroup
          label="Game Phase"
          isExpanded={expandedGroups.has("phase")}
          onToggle={() => toggleGroup("phase")}
        >
          <FilterChip
            active={filters.phase === undefined}
            onClick={() => updateFilter("phase", undefined)}
          >
            All
          </FilterChip>
          {(["opening", "middlegame", "endgame"] as GamePhase[]).map((phase) => (
            <FilterChip
              key={phase}
              active={filters.phase === phase}
              onClick={() => updateFilter("phase", phase)}
              count={counts?.[phase]}
            >
              {filterLabels.phase[phase]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Severity */}
        <FilterGroup
          label="Severity"
          isExpanded={expandedGroups.has("severity")}
          onToggle={() => toggleGroup("severity")}
        >
          <FilterChip
            active={filters.severity === undefined}
            onClick={() => updateFilter("severity", undefined)}
          >
            All
          </FilterChip>
          {(["minor", "medium", "major"] as Severity[]).map((severity) => (
            <FilterChip
              key={severity}
              active={filters.severity === severity}
              onClick={() => updateFilter("severity", severity)}
              count={counts?.[severity]}
            >
              {filterLabels.severity[severity]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Time Control */}
        <FilterGroup
          label="Time Control"
          isExpanded={expandedGroups.has("timeControl")}
          onToggle={() => toggleGroup("timeControl")}
        >
          <FilterChip
            active={filters.timeControl === undefined}
            onClick={() => updateFilter("timeControl", undefined)}
          >
            All
          </FilterChip>
          {(["bullet", "blitz", "rapid", "classical"] as TimeControl[]).map(
            (tc) => (
              <FilterChip
                key={tc}
                active={filters.timeControl === tc}
                onClick={() => updateFilter("timeControl", tc)}
                count={counts?.[tc]}
              >
                {filterLabels.timeControl[tc]}
              </FilterChip>
            )
          )}
        </FilterGroup>

        {/* Color */}
        <FilterGroup
          label="Color Played"
          isExpanded={expandedGroups.has("color")}
          onToggle={() => toggleGroup("color")}
        >
          <FilterChip
            active={filters.color === undefined}
            onClick={() => updateFilter("color", undefined)}
          >
            All
          </FilterChip>
          {(["white", "black"] as const).map((color) => (
            <FilterChip
              key={color}
              active={filters.color === color}
              onClick={() => updateFilter("color", color)}
              count={counts?.[color]}
            >
              {filterLabels.color[color]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Game Result */}
        <FilterGroup
          label="Game Result"
          isExpanded={expandedGroups.has("result")}
          onToggle={() => toggleGroup("result")}
        >
          <FilterChip
            active={filters.result === undefined}
            onClick={() => updateFilter("result", undefined)}
          >
            All
          </FilterChip>
          {(["win", "loss", "draw"] as ResultCategory[]).map((result) => (
            <FilterChip
              key={result}
              active={filters.result === result}
              onClick={() => updateFilter("result", result)}
              count={counts?.[result]}
            >
              {filterLabels.result[result]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Piece Type */}
        <FilterGroup
          label="Piece Moved"
          isExpanded={expandedGroups.has("pieceType")}
          onToggle={() => toggleGroup("pieceType")}
        >
          <FilterChip
            active={filters.pieceType === undefined}
            onClick={() => updateFilter("pieceType", undefined)}
          >
            All
          </FilterChip>
          {(["pawn", "knight", "bishop", "rook", "queen", "king"] as PieceType[]).map(
            (piece) => (
              <FilterChip
                key={piece}
                active={filters.pieceType === piece}
                onClick={() => updateFilter("pieceType", piece)}
                count={counts?.[piece]}
              >
                {filterLabels.pieceType[piece]}
              </FilterChip>
            )
          )}
        </FilterGroup>

        {/* Date Range */}
        <FilterGroup
          label="Date Range"
          isExpanded={expandedGroups.has("dateRange")}
          onToggle={() => toggleGroup("dateRange")}
        >
          <FilterChip
            active={filters.dateRange === undefined || filters.dateRange === "all"}
            onClick={() => updateFilter("dateRange", undefined)}
          >
            All Time
          </FilterChip>
          {(["week", "month", "3months", "year"] as DateRange[]).map((range) => (
            <FilterChip
              key={range}
              active={filters.dateRange === range}
              onClick={() => updateFilter("dateRange", range)}
              count={counts?.[range]}
            >
              {filterLabels.dateRange[range]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Opening Family */}
        <FilterGroup
          label="Opening"
          isExpanded={expandedGroups.has("openingFamily")}
          onToggle={() => toggleGroup("openingFamily")}
        >
          <FilterChip
            active={filters.openingFamily === undefined}
            onClick={() => updateFilter("openingFamily", undefined)}
          >
            All
          </FilterChip>
          {(["e4", "d4", "c4", "nf3", "other"] as OpeningFamily[]).map((opening) => (
            <FilterChip
              key={opening}
              active={filters.openingFamily === opening}
              onClick={() => updateFilter("openingFamily", opening)}
              count={counts?.[opening]}
            >
              {filterLabels.openingFamily[opening]}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Solved Status */}
        <FilterGroup
          label="Status"
          isExpanded={expandedGroups.has("solved")}
          onToggle={() => toggleGroup("solved")}
        >
          <FilterChip
            active={filters.solved === undefined}
            onClick={() => updateFilter("solved", undefined)}
          >
            All
          </FilterChip>
          <FilterChip
            active={filters.solved === false}
            onClick={() => updateFilter("solved", false)}
            count={counts?.unsolvedCount}
          >
            Unsolved
          </FilterChip>
          <FilterChip
            active={filters.solved === true}
            onClick={() => updateFilter("solved", true)}
            count={counts?.solvedCount}
          >
            Solved
          </FilterChip>
        </FilterGroup>
      </div>
    </div>
  );
}
