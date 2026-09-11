import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import "./Header.css";

const Header = () => {
  const navigate = useNavigate();
  const { user, liveLocation, liveAddress } = useContext(StoreContext);
  const [searchQuery, setSearchQuery] = useState("");

  const addr = liveAddress || user?.address;
  const deliveryAddress = addr
    ? addr.formatted || [addr.address || addr.street, addr.city].filter(Boolean).join(", ")
    : liveLocation
    ? "Updating location…"
    : "";

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Keep the hero search in sync with the browse page's URL contract.
      // Previously this used `search`, while the result page read `q`, so a
      // successful-looking search silently opened an unfiltered list.
      navigate(`/restaurants?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/restaurants");
    }
  };

  return (
    <section className="apple-hero-tile">
      <div className="apple-hero-container">
        <div className="apple-hero-banner">
          <div className="apple-hero-banner-content">
            {/* Concise Hero Headline */}
            <h1 className="apple-hero-headline">
              Order food to your door in 15 minutes.
            </h1>

            {/* Short, realistic tagline */}
            <p className="apple-hero-lead">
              Hot, fresh meals from the best local restaurants, delivered by drone.
            </p>

            {/* Apple Pill Search Input */}
            <form className="apple-hero-search-wrapper" onSubmit={handleSearchSubmit}>
              <div className="apple-hero-search-pill">
                <Search size={16} className="apple-hero-search-icon" />
                <input
                  type="text"
                  className="apple-hero-search-field"
                  placeholder="Search dishes or restaurants…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {deliveryAddress && (
                  <span className="apple-hero-search-location" title={deliveryAddress}>
                    <MapPin size={13} />
                    <span>{deliveryAddress}</span>
                  </span>
                )}
                <button type="submit" className="apple-hero-search-submit">
                  Find Restaurants
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Header;
