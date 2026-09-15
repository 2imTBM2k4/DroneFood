import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, ChevronRight, Zap } from 'lucide-react';
import './RestaurantItem.css';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets';
import { formatDistance } from '../../lib/distance';
import { formatVND } from '../../../../shared/utils/money';

const RestaurantItem = ({
  id,
  name,
  address,
  image,
  distanceKm,
  etaMin,
  estimatedDeliveryFee,
  rating,
}) => {
  const { url } = useContext(StoreContext);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/restaurant/${id}`);
  };

  const getImgSrc = (img) => {
    if (!img) return assets.logo;
    return img.startsWith('http') ? img : `${url}${img}`;
  };

  const imgSrc = getImgSrc(image);

  return (
    <div
      className="apple-store-utility-card restaurant-item"
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View menu for ${name}`}
    >
      <div className="apple-card-image-wrapper">
        <img
          className="apple-card-image product-render"
          src={imgSrc}
          alt={name}
          onError={(e) => {
            e.target.src = assets.logo;
          }}
        />
        <span className="apple-eta-chip">
          <Clock size={12} />
          {etaMin ? `${etaMin} min delivery` : "Time at checkout"}
        </span>
      </div>

      <div className="apple-card-content">
        <div className="apple-card-header">
          <h3 className="apple-card-title">{name}</h3>
          <span className="apple-card-rating">
            {typeof rating === "number" ? (
              <>
                <Star size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span aria-label={`Rating ${rating.toFixed(1)} out of 5`}>
                  {rating.toFixed(1)}
                </span>
              </>
            ) : (
              "Chưa có đánh giá"
            )}
          </span>
        </div>

        {typeof distanceKm === 'number' && (
          <div className="apple-restaurant-meta">
            <Zap size={13} className="apple-meta-zap" />
            <span>{formatDistance(distanceKm)}</span>
            <span className="apple-meta-dot">·</span>
            <span>
              {typeof etaMin === "number"
                ? `${etaMin} min flight time`
                : "Time at checkout"}
            </span>
            {typeof estimatedDeliveryFee === "number" && (
              <>
                <span className="apple-meta-dot">·</span>
                <span>{formatVND(estimatedDeliveryFee)} est. fee</span>
              </>
            )}
          </div>
        )}

        <p className="apple-restaurant-address">
          <MapPin size={13} className="apple-meta-pin" />
          <span>{address}</span>
        </p>

        <div className="apple-card-footer">
          <span className="apple-status-text">Available now</span>
          <span className="apple-text-link">
            View Menu
            <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default RestaurantItem;
