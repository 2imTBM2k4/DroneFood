import { useContext, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Star, ArrowLeft } from "lucide-react";
import "./ProductDetail.css";
import { StoreContext } from "../../context/StoreContext";
import { ErrorState } from "../../../../shared/components/StateBlock";
import ItemOptionsSheet from "../../components/ItemOptionsSheet/ItemOptionsSheet";
import { assets } from "../../assets/assets";
import { formatVND } from "../../../../shared/utils/money";

const BackButton = ({ onClick }) => (
  <button type="button" className="back-btn" onClick={onClick}>
    <ArrowLeft size={16} aria-hidden="true" />
    Quay lại
  </button>
);

/**
 * Deep-link page for a single dish. Adding to the cart goes through the same
 * ItemOptionsSheet the menu cards open, so options behave identically here.
 */
const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { food_list, url, isLoadingFoods } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState({ averageRating: null, ratingCount: 0, reviews: [] });

  const fetchSingleProduct = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${url}/api/food/${id}`);
      const data = await res.json();
      if (data.success) {
        setItem(data.data);
      } else {
        throw new Error(data.message || "Product not found");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, url]);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`${url}/api/order-reviews/food/${id}`);
      const data = await response.json();
      if (data.success) setReviewSummary(data.data);
    } catch {
      // Reviews are supplementary; a failed review request must not hide the dish.
    }
  }, [id, url]);

  useEffect(() => {
    if (isLoadingFoods) return;
    const foundItem = food_list.find((product) => product._id === id);
    if (foundItem) {
      setItem(foundItem);
      setLoading(false);
    } else {
      fetchSingleProduct();
    }
  }, [food_list, id, isLoadingFoods, fetchSingleProduct]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  if (loading || isLoadingFoods) {
    return (
      <div className="product-detail">
        <BackButton onClick={() => navigate(-1)} />
        <div className="product-detail-container">
          <div className="product-detail-image">
            <div className="skeleton product-detail-image-skeleton" />
          </div>
          <div className="product-detail-info">
            {/* .product-detail-info is a flex column with a gap, so these
                need no margins of their own. */}
            <div className="skeleton skeleton-text" style={{ width: "60%", height: 30 }} />
            <div className="skeleton skeleton-text" style={{ width: "100%" }} />
            <div className="skeleton skeleton-text" style={{ width: "88%" }} />
            <div className="skeleton skeleton-text" style={{ width: "30%", height: 22 }} />
            <div className="skeleton" style={{ width: 160, height: 42 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="product-detail">
        <BackButton onClick={() => navigate(-1)} />
        <ErrorState
          title={error ? "Could not load this dish" : "Dish not found"}
          description={error || "This dish may have been removed from the menu."}
          onRetry={error ? fetchSingleProduct : undefined}
          actionLabel="Back to home"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  const imageSrc = item.image?.startsWith("http")
    ? item.image
    : `${url}/images/${item.image}`;

  const optionGroups = item.optionGroups || [];

  return (
    <div className="product-detail">
      <BackButton onClick={() => navigate(-1)} />
      <div className="product-detail-container">
        <div className="product-detail-image">
          <img
            src={imageSrc}
            alt={item.name}
            onError={(e) => {
              e.target.src = assets.sample_food || assets.logo;
            }}
          />
        </div>
        <div className="product-detail-info">
          <div className="product-detail-name-rating">
            <h2>{item.name}</h2>
            <span className="product-detail-rating">
              <Star size={15} fill="currentColor" strokeWidth={0} />
              {typeof reviewSummary.averageRating === "number"
                ? `${reviewSummary.averageRating.toFixed(1)} (${reviewSummary.ratingCount})`
                : "Chưa có đánh giá"}
            </span>
          </div>
          <p className="product-detail-desc">{item.description}</p>
          <p className="product-detail-price">{formatVND(item.price)}</p>

          {optionGroups.length > 0 && (
            <ul className="product-detail-options">
              {optionGroups.map((group) => (
                <li key={group.name}>
                  <span className="ds-label">{group.name}</span>
                  <span className="product-detail-option-names">
                    {group.options.map((option) => option.name).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="product-detail-cart">
            <button className="add-detail" onClick={() => setSheetOpen(true)}>
              <Plus size={18} strokeWidth={2.5} />
              {optionGroups.length > 0 ? "Choose options" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>

      <section className="product-detail-reviews" aria-labelledby="food-reviews-title">
        <h3 id="food-reviews-title">Đánh giá món ăn</h3>
        {reviewSummary.reviews.length === 0 ? (
          <p>Chưa có đánh giá nào cho món này.</p>
        ) : (
          <ul>
            {reviewSummary.reviews.map((review) => (
              <li key={review._id}>
                <div className="product-review-head">
                  <strong>{review.reviewerName}</strong>
                  <span><Star size={14} fill="currentColor" aria-hidden="true" /> {review.rating}</span>
                </div>
                {review.comment && <p>{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheetOpen && (
        <ItemOptionsSheet item={item} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
};

export default ProductDetail;
