import { useEffect, useState } from "react";
import axios from "axios";
import { Star } from "lucide-react";
import { toast } from "react-toastify";
import "./OrderReviewPrompt.css";

const targetLabel = (targetType) =>
  targetType === "shipper" ? "tài xế" : "món ăn";

const OrderReviewPrompt = ({ order, url, token, onFlowChanged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const reviewFlow = order.reviewFlow;
  const nextTarget = reviewFlow?.nextTarget;
  const target = nextTarget || null;
  const totalSteps = reviewFlow?.targets?.filter((item) => item.status !== "not_applicable").length || 0;
  const currentStep = nextTarget
    ? reviewFlow.targets.findIndex((item) => item.targetId === nextTarget.targetId && item.targetType === nextTarget.targetType) + 1
    : 0;
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!nextTarget) setIsOpen(false);
  }, [nextTarget]);

  if (order.orderStatus !== "delivered" || !nextTarget || !target) return null;

  const submit = async (outcome) => {
    if (outcome === "rated" && selectedRating === 0) return;
    setIsSaving(true);
    try {
      const response = await axios.post(
        `${url}/api/order-reviews/${order._id}/${nextTarget.targetType}/${nextTarget.targetId}`,
        {
          outcome,
          ...(outcome === "rated" && { rating: selectedRating }),
          ...(outcome === "rated" && nextTarget.targetType === "food" && { comment: comment.trim() }),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const nextFlow = response.data.data.reviewFlow;
      onFlowChanged(order._id, nextFlow);
      setSelectedRating(0);
      setComment("");
      if (nextFlow.complete) {
        setIsOpen(false);
        toast.success("Cảm ơn bạn đã phản hồi.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Chưa thể lưu đánh giá");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="order-review-prompt" aria-label="Đánh giá đơn hàng">
      <div>
        <strong>Đơn hàng đã hoàn thành</strong>
        <p>Hãy đánh giá {targetLabel(nextTarget.targetType)} trước khi chuyển sang bước tiếp theo.</p>
      </div>
      <button type="button" className="order-review-open" onClick={() => setIsOpen(true)}>
        Đánh giá ngay
      </button>

      {isOpen && (
        <div className="order-review-overlay" onClick={() => !isSaving && setIsOpen(false)}>
          <section
            className="order-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`review-title-${order._id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="order-review-step">
              Bước {currentStep}/{totalSteps}
            </p>
            <h3 id={`review-title-${order._id}`}>
              Bạn đánh giá {target.name || targetLabel(nextTarget.targetType)} thế nào?
            </h3>
            <p className="order-review-help">Bạn chỉ có thể gửi hoặc bỏ qua lựa chọn này một lần.</p>
            <div className="order-review-stars" role="group" aria-label="Chọn số sao từ 1 đến 5">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={rating <= selectedRating ? "selected" : ""}
                  aria-label={`${rating} sao`}
                  aria-pressed={rating === selectedRating}
                  onClick={() => setSelectedRating(rating)}
                  disabled={isSaving}
                >
                  <Star size={30} fill="currentColor" aria-hidden="true" />
                </button>
              ))}
            </div>
            {nextTarget.targetType === "food" && (
              <label className="order-review-comment" htmlFor={`review-comment-${order._id}-${nextTarget.targetId}`}>
                <span>Bình luận về món ăn (tuỳ chọn)</span>
                <textarea
                  id={`review-comment-${order._id}-${nextTarget.targetId}`}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Chia sẻ trải nghiệm của bạn về món này"
                  disabled={isSaving}
                />
              </label>
            )}
            <div className="order-review-actions">
              <button
                type="button"
                className="order-review-skip"
                onClick={() => submit("skipped")}
                disabled={isSaving}
              >
                Bỏ qua
              </button>
              <button
                type="button"
                className="order-review-submit"
                onClick={() => submit("rated")}
                disabled={isSaving || selectedRating === 0}
              >
                {isSaving ? "Đang lưu…" : "Gửi đánh giá"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

export default OrderReviewPrompt;
