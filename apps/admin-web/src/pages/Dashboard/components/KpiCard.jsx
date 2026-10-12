import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  Minus,
} from "lucide-react";

const KpiCard = ({
  title,
  value,
  description,
  trendPercent = 0,
  icon: Icon,
  tone = "default",
  tooltip,
  loading = false,
  valueClassName = "",
}) => {
  const TrendIcon =
    trendPercent > 0 ? ArrowUpRight : trendPercent < 0 ? ArrowDownRight : Minus;
  const trendClass =
    trendPercent > 0
      ? "is-positive"
      : trendPercent < 0
        ? "is-negative"
        : "is-neutral";
  const tooltipId = tooltip
    ? `kpi-tooltip-${title.toLowerCase().replace(/\s+/g, "-")}`
    : undefined;

  return (
    <article className={`kpi-card kpi-card--${tone}`} aria-busy={loading}>
      <div className="kpi-card__topline">
        <div className="kpi-card__icon" aria-hidden="true">
          {Icon && <Icon size={20} />}
        </div>
        <div className={`kpi-card__trend ${trendClass}`}>
          <TrendIcon size={15} aria-hidden="true" />
          <span>{Math.abs(trendPercent).toLocaleString("vi-VN")}%</span>
          <span className="sr-only">so với hôm qua</span>
        </div>
      </div>
      <div className="kpi-card__label-row">
        <h2>{title}</h2>
        {tooltip && (
          <span className="dashboard-tooltip">
            <button
              type="button"
              className="dashboard-tooltip__trigger"
              aria-label={`Giải thích ${title}`}
              aria-describedby={tooltipId}
            >
              <HelpCircle size={16} aria-hidden="true" />
            </button>
            <span id={tooltipId} role="tooltip" className="dashboard-tooltip__content">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      {loading ? (
        <>
          <span className="dashboard-skeleton dashboard-skeleton--value" />
          <span className="dashboard-skeleton dashboard-skeleton--text" />
        </>
      ) : (
        <>
          <p className={`kpi-card__value ${valueClassName}`}>{value}</p>
          <p className="kpi-card__description">{description}</p>
        </>
      )}
    </article>
  );
};

export default KpiCard;
