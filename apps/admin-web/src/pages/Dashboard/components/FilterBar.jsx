import React from "react";
import { RefreshCw } from "lucide-react";

const FilterBar = ({
  period,
  region,
  periods,
  regions,
  onPeriodChange,
  onRegionChange,
  onRefresh,
  refreshing,
  lastUpdated,
}) => (
  <section className="dashboard-filter-bar" aria-label="Bộ lọc dashboard">
    <div className="dashboard-filter-group">
      <span className="dashboard-filter-label">Thời gian</span>
      <div className="dashboard-period-switcher" role="group" aria-label="Thời gian">
        {periods.map((option) => (
          <button
            type="button"
            key={option.value}
            className={period === option.value ? "is-active" : ""}
            aria-pressed={period === option.value}
            onClick={() => onPeriodChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <label className="dashboard-filter-group dashboard-region-filter">
      <span className="dashboard-filter-label">Khu vực</span>
      <select
        value={region}
        onChange={(event) => onRegionChange(event.target.value)}
      >
        {regions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>

    <div className="dashboard-refresh-group">
      {lastUpdated && (
        <span className="dashboard-last-updated">
          Cập nhật {lastUpdated}
        </span>
      )}
      <button
        type="button"
        className="dashboard-refresh-button"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw
          size={17}
          aria-hidden="true"
          className={refreshing ? "is-spinning" : ""}
        />
        {refreshing ? "Đang tải" : "Refresh"}
      </button>
    </div>
  </section>
);

export default FilterBar;
