import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, ChevronRight, Zap } from 'lucide-react';
import './RestaurantItem.css';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/assets';
import { formatDistance } from '../../lib/distance';

const RestaurantItem = ({ id, name, address, image, distanceKm, etaMin }) => {
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
          {etaMin ? `${etaMin}m drone drop` : '15m drop'}
        </span>
      </div>

      <div className="apple-card-content">
        <div className="apple-card-header">
          <h3 className="apple-card-title">{name}</h3>
          <span className="apple-card-rating">
            <Star size={12} fill="currentColor" strokeWidth={0} />
            4.9
          </span>
        </div>

        {typeof distanceKm === 'number' && (
          <div className="apple-restaurant-meta">
            <Zap size={13} className="apple-meta-zap" />
            <span>{formatDistance(distanceKm)}</span>
            <span className="apple-meta-dot">·</span>
            <span>{etaMin || 15} min flight time</span>
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
