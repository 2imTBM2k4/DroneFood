import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";
import "./FoodDisplay.css";
import { StoreContext } from "../../context/StoreContext";
import FoodItem from "../FoodItem/FoodItem";
import Reveal from "../Reveal/Reveal";
import { SkeletonGrid } from "../Skeleton/Skeleton";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";

const FoodDisplay = ({
  category = "All",
  restaurantId,
  foods = [],
  searchQuery = "",
}) => {
  const { food_list, isLoadingFoods } = useContext(StoreContext);
  const navigate = useNavigate();

  // When a parent passes `foods` it owns the loading state; only the
  // context-driven case has to wait on the global fetch.
  const usesOwnData = foods.length > 0;

  let displayItems = [];
  if (usesOwnData) {
    displayItems = foods.filter(
      (item) => category === "All" || item.category === category
    );
  } else {
    const restaurantFoods = food_list.filter(
      (item) => !restaurantId || item.restaurantId === restaurantId
    );
    if (category === "All") {
      displayItems = restaurantFoods;
    } else {
      displayItems = restaurantFoods.filter(
        (item) => category === item.category
      );
    }
  }

  // Free-text search over dish name and description, applied on top of the
  // category filter.
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    displayItems = displayItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }

  if (!usesOwnData && isLoadingFoods) {
    return (
      <div className="food-display" id="food-display">
        <SkeletonGrid count={8} />
      </div>
    );
  }

  return (
    <div className="food-display" id="food-display">
      <div className="food-display-list">
        {displayItems.map((item, index) => (
          <Reveal key={item._id} delay={Math.min(index, 7) * 60}>
            <FoodItem
              id={item._id}
              name={item.name}
              description={item.description}
              price={item.price}
              image={item.image}
              optionGroups={item.optionGroups || []}
              isBestSeller={item.isBestSeller}
              salesCount={item.salesCount}
            />
          </Reveal>
        ))}
        {displayItems.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title={query ? "No matches" : "No dishes here"}
            description={
              query
                ? `Nothing matches "${searchQuery.trim()}". Try another search.`
                : category === "All"
                ? "Nothing is available right now. Try another restaurant."
                : `Nothing in "${category}". Try a different category.`
            }
            actionLabel="Browse restaurants"
            onAction={() => navigate("/")}
          />
        )}
      </div>
    </div>
  );
};

export default FoodDisplay;
