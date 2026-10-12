import React from "react";

const ChartCard = ({
  title,
  subtitle,
  summary,
  children,
  className = "",
  loading = false,
  error,
  onRetry,
  headerAside,
}) => (
  <section className={`chart-card ${className}`} aria-busy={loading}>
    <div className="chart-card__header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {headerAside}
    </div>
    {summary && <p className="sr-only">{summary}</p>}
    <div className="chart-card__body">
      {loading ? (
        <div className="chart-loading" aria-label="Đang tải biểu đồ">
          <span className="dashboard-skeleton dashboard-skeleton--chart" />
        </div>
      ) : error ? (
        <div className="chart-error" role="alert">
          <p>Không thể tải dữ liệu biểu đồ.</p>
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Thử lại
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  </section>
);

export default ChartCard;
