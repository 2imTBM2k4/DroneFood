import React from "react";
import { AlertCircle, Inbox, RotateCcw } from "lucide-react";

const LoadingRows = ({ columns }) => (
  <div className="action-table-state" aria-label="Đang tải dữ liệu">
    {[0, 1, 2].map((row) => (
      <div className="action-table-skeleton-row" key={row}>
        {columns.map((column) => (
          <span
            className="dashboard-skeleton dashboard-skeleton--cell"
            key={column.key}
          />
        ))}
      </div>
    ))}
  </div>
);

const ActionTable = ({
  title,
  rows,
  columns,
  status = "ready",
  error,
  onRetry,
  className = "",
}) => {
  const count = status === "ready" ? rows.length : null;

  return (
    <section
      className={`action-table-card ${className}`}
      aria-busy={status === "loading"}
    >
      <div className="action-table-card__header">
        <h2>{title}</h2>
        <span
          className="action-table-card__count"
          aria-label={count === null ? "Đang cập nhật số lượng" : `${count} mục`}
        >
          {count ?? "…"}
        </span>
      </div>

      {status === "loading" ? (
        <LoadingRows columns={columns} />
      ) : status === "error" ? (
        <div className="action-table-state" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <strong>Không thể tải dữ liệu</strong>
          <p>{error || "Vui lòng thử lại sau."}</p>
          {onRetry && (
            <button type="button" onClick={onRetry}>
              <RotateCcw size={15} aria-hidden="true" />
              Thử lại
            </button>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="action-table-state">
          <Inbox size={22} aria-hidden="true" />
          <strong>Không có dữ liệu</strong>
          <p>Không có mục nào cần xử lý với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="action-table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key} data-label={column.label}>
                      {column.render
                        ? column.render(row)
                        : row[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ActionTable;
