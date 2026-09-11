import "./Skeleton.css";

/**
 * Skeleton placeholders. Each variant mirrors the real component's box model
 * so swapping in the loaded content causes no layout shift.
 * The shimmer itself lives in shared/tokens.css (.skeleton).
 */

export const SkeletonFoodCard = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-card-image" />
    <div className="skeleton-card-body">
      <div className="skeleton skeleton-text" style={{ width: "70%", height: 18 }} />
      <div className="skeleton skeleton-text" style={{ width: "95%" }} />
      <div className="skeleton skeleton-text" style={{ width: "55%" }} />
      <div className="skeleton skeleton-text" style={{ width: "30%", height: 16 }} />
    </div>
  </div>
);

export const SkeletonRestaurantCard = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-card-image" />
    <div className="skeleton-card-body">
      <div className="skeleton skeleton-text" style={{ width: "60%", height: 20 }} />
      <div className="skeleton skeleton-text" style={{ width: "85%" }} />
      <div className="skeleton skeleton-text" style={{ width: "45%" }} />
    </div>
  </div>
);

/** Grid of card skeletons matching .food-display-list / .restaurant-display-list. */
export const SkeletonGrid = ({ count = 8, variant = "food" }) => {
  const Card = variant === "restaurant" ? SkeletonRestaurantCard : SkeletonFoodCard;
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} />
      ))}
    </div>
  );
};

/** Stack of rows — used by cart lines and order cards. */
export const SkeletonList = ({ count = 3, height = 84 }) => (
  <div className="skeleton-list" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton" style={{ height }} />
    ))}
  </div>
);

export default SkeletonGrid;
