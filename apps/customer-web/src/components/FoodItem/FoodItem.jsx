import { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Settings2 } from "lucide-react";
import "./FoodItem.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";
import ItemOptionsSheet from "../ItemOptionsSheet/ItemOptionsSheet";
import { formatVND } from "@drone-food/web-ui/utils/money";

function FoodItem({ id, name, price, description, image, optionGroups = [], isBestSeller, salesCount }) {
  const { url, food_list, fetchSingleFood } = useContext(StoreContext);
  const navigate = useNavigate();
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

  const handleOpenDetail = () => {
    navigate(`/product/${id}`);
  };

  const item = {
    _id: id,
    name,
    price,
    description,
    image,
    optionGroups: currentOptionGroups || [],
    isBestSeller,
    salesCount,
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
        onClick={handleOpenDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenDetail();
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
          {(isBestSeller || (typeof salesCount === "number" && salesCount >= 10)) && (
            <span className="food-item-bestseller-badge">Bán chạy</span>
          )}
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
          </div>

          <p className="apple-card-desc">{description}</p>

          <div className="apple-card-footer">
            <span className="apple-card-price">{formatVND(price)}</span>
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
