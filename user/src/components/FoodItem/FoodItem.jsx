import { useContext, useState, useEffect } from "react";
import { Plus, Star, Settings2, ChevronRight } from "lucide-react";
import "./FoodItem.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";
import ItemOptionsSheet from "../ItemOptionsSheet/ItemOptionsSheet";
import { formatVND } from "../../../../shared/utils/money";

function FoodItem({ id, name, price, description, image, optionGroups = [] }) {
  const { url, food_list, fetchSingleFood } = useContext(StoreContext);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currentOptionGroups, setCurrentOptionGroups] = useState(optionGroups);

  useEffect(() => {
    if (optionGroups && optionGroups.length > 0) {
      setCurrentOptionGroups(optionGroups);
    } else {
      const fromList = food_list.find((f) => f._id === id)?.optionGroups;
      if (fromList && fromList.length > 0) {
        setCurrentOptionGroups(fromList);
      }
    }
  }, [optionGroups, food_list, id]);

  const handleOpenSheet = async (e) => {
    e?.stopPropagation?.();

    // If options are still empty, attempt to fetch from backend before opening
    let groups = currentOptionGroups;
    if (!groups || groups.length === 0) {
      const fromList = food_list.find((f) => f._id === id)?.optionGroups;
      if (fromList && fromList.length > 0) {
        groups = fromList;
        setCurrentOptionGroups(fromList);
      } else if (fetchSingleFood) {
        try {
          const freshData = await fetchSingleFood(id);
          if (freshData?.optionGroups && freshData.optionGroups.length > 0) {
            groups = freshData.optionGroups;
            setCurrentOptionGroups(freshData.optionGroups);
          }
        } catch (err) {
          // fallback
        }
      }
    }

    setSheetOpen(true);
  };

  const item = {
    _id: id,
    name,
    price,
    description,
    image,
    optionGroups: currentOptionGroups || [],
  };

  const hasOptions = (currentOptionGroups || []).length > 0;

  const getImgSrc = (img) => {
    if (!img) return assets.sample_food || assets.logo;
    return img.startsWith("http") ? img : `${url}/images/${img}`;
  };

  const imgSrc = getImgSrc(image);

  return (
    <>
      <div
        className="apple-store-utility-card food-item"
        onClick={handleOpenSheet}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenSheet(e);
          }
        }}
      >
        <div className="apple-card-image-wrapper">
          <img
            className="apple-card-image product-render"
            src={imgSrc}
            alt={name}
            onError={(e) => {
              e.target.src = assets.sample_food || assets.logo;
            }}
          />
          <button
            type="button"
            className="apple-card-add-btn button-icon-circular"
            onClick={handleOpenSheet}
            aria-label={
              hasOptions ? `Configure options for ${name}` : `Add ${name} to bag`
            }
          >
            {hasOptions ? (
              <Settings2 size={16} />
            ) : (
              <Plus size={18} />
            )}
          </button>
        </div>

        <div className="apple-card-content">
          <div className="apple-card-header">
            <h3 className="apple-card-title">{name}</h3>
            <span className="apple-card-rating">
              <Star size={12} fill="currentColor" strokeWidth={0} />
              4.8
            </span>
          </div>

          <p className="apple-card-desc">{description}</p>

          <div className="apple-card-footer">
            <span className="apple-card-price">{formatVND(price)}</span>
            <span className="apple-text-link">
              {hasOptions ? "Configure" : "Add to bag"}
              <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <ItemOptionsSheet item={item} onClose={() => setSheetOpen(false)} />
      )}
    </>
  );
}

export default FoodItem;
