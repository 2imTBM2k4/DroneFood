import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Search, X, SlidersHorizontal, Store } from "lucide-react";
import "./RestaurantsPage.css";
import useNearbyRestaurants from "../../hooks/useNearbyRestaurants";
import RestaurantItem from "../../components/RestaurantItem/RestaurantItem";
import RoundedSelect from "../../components/RoundedSelect/RoundedSelect";
import Reveal from "../../components/Reveal/Reveal";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";
import { NEARBY_RADIUS_KM } from "../../lib/distance";

const getSearchParam = (params) =>
  params.get("q") ?? params.get("search") ?? "";

const ratingOptions = [
  { value: "", label: "Tất cả" },
  { value: "4.5", label: "Từ 4,5 sao" },
  { value: "4", label: "Từ 4 sao" },
  { value: "3", label: "Từ 3 sao" },
];

const deliveryFeeOptions = [
  { value: "", label: "Tất cả" },
  { value: "20000", label: "Tối đa 20.000 ₫" },
  { value: "40000", label: "Tối đa 40.000 ₫" },
  { value: "60000", label: "Tối đa 60.000 ₫" },
];

const etaOptions = [
  { value: "", label: "Tất cả" },
  { value: "15", label: "Tối đa 15 phút" },
  { value: "25", label: "Tối đa 25 phút" },
  { value: "35", label: "Tối đa 35 phút" },
];

/**
 * Browse restaurants that deliver here — the step between the home page and a
 * restaurant's own menu. Search and cuisine chips both narrow the same list,
 * which is already sorted nearest-first.
 */
const RestaurantsPage = () => {
  const { restaurants, categories, customer } = useNearbyRestaurants();
  const [searchParams, setSearchParams] = useSearchParams();
  // `search` was used by an earlier version of the home hero. Accept it for
  // shared and bookmarked links, then write all new changes using `q`.
  const [category, setCategory] = useState(
    searchParams.get("category") || "All"
  );
  const [search, setSearch] = useState(() => getSearchParam(searchParams));
  const [filtersOpen, setFiltersOpen] = useState(() =>
    Boolean(
      searchParams.get("minRating") ||
        searchParams.get("maxDeliveryFee") ||
        searchParams.get("maxEta")
    )
  );
  const minimumRating = searchParams.get("minRating") || "";
  const maximumDeliveryFee = searchParams.get("maxDeliveryFee") || "";
  const maximumEta = searchParams.get("maxEta") || "";

  // Keep state in step with the URL (arriving from the home hero or strip,
  // and the back button).
  useEffect(() => {
    setSearch(getSearchParam(searchParams));
    setCategory(searchParams.get("category") || "All");
  }, [searchParams]);

  const writeParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    // Normalise legacy URLs the moment the user updates the filter.
    if (key === "q") next.delete("search");
    if (value && value !== "All") next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    writeParam("q", value.trim());
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    writeParam("category", value);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setSearchParams({}, { replace: true });
  };

  const query = search.trim().toLowerCase();
  const visible = restaurants.filter((r) => {
    const matchesCategory =
      category === "All" || r.categories.includes(category);
    const matchesQuery =
      !query ||
      r.name?.toLowerCase().includes(query) ||
      r.address?.toLowerCase().includes(query) ||
      r.categories.some((c) => c.toLowerCase().includes(query));
    const matchesRating =
      !minimumRating ||
      (typeof r.rating === "number" && r.rating >= Number(minimumRating));
    const matchesDeliveryFee =
      !maximumDeliveryFee ||
      (typeof r.estimatedDeliveryFee === "number" &&
        r.estimatedDeliveryFee <= Number(maximumDeliveryFee));
    const matchesEta =
      !maximumEta ||
      (typeof r.etaMin === "number" && r.etaMin <= Number(maximumEta));
    return (
      matchesCategory &&
      matchesQuery &&
      matchesRating &&
      matchesDeliveryFee &&
      matchesEta
    );
  });
  const hasFilters = Boolean(
    query ||
      category !== "All" ||
      minimumRating ||
      maximumDeliveryFee ||
      maximumEta
  );
  const activeAdvancedFilterCount = [
    minimumRating,
    maximumDeliveryFee,
    maximumEta,
  ].filter(Boolean).length;

  return (
    <div className="restaurants-page">
      <header className="restaurants-head">
        <h1 className="restaurants-title">
          {customer ? "Restaurants near you" : "Restaurants"}
        </h1>
        <p className="restaurants-sub">
          {customer
            ? `Delivering to your address, nearest first`
            : "Popular places delivering right now"}
        </p>
      </header>

      <div className="restaurants-search-wrap">
        <div className="restaurants-search">
          <Search className="restaurants-search-icon" size={20} />
          <input
            type="text"
            className="restaurants-search-input"
            placeholder="Search restaurants or cuisines…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search restaurants"
          />
          {search && (
            <button
              type="button"
              className="restaurants-search-clear"
              onClick={() => handleSearchChange("")}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="restaurants-catalog">
        <div className="restaurants-catalog-toolbar">
          {categories.length > 0 && (
            <div className="catalog-list" aria-label="Danh mục nhà hàng">
              {["All", ...categories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`catalog-item ${category === cat ? "active" : ""}`}
                  onClick={() => handleCategoryChange(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            id="restaurant-filters-toggle"
            className={`restaurants-filter-toggle ${filtersOpen ? "is-open" : ""}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="restaurant-filters-panel"
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Bộ lọc</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="restaurants-filter-count" aria-label={`${activeAdvancedFilterCount} bộ lọc đang áp dụng`}>
                {activeAdvancedFilterCount}
              </span>
            )}
            <ChevronDown className="restaurants-filter-chevron" size={17} aria-hidden="true" />
          </button>
        </div>

        {filtersOpen && (
          <section
            id="restaurant-filters-panel"
            className="restaurants-filters"
            aria-labelledby="restaurant-filters-toggle"
          >
            <div className="restaurants-filter-fields">
              <div className="restaurants-filter-field">
                <label htmlFor="minimum-rating">Đánh giá</label>
                <RoundedSelect
                  id="minimum-rating"
                  value={minimumRating}
                  options={ratingOptions}
                  onChange={(value) => writeParam("minRating", value)}
                  ariaLabel="Lọc theo đánh giá tối thiểu"
                />
              </div>
              <div className="restaurants-filter-field">
                <label htmlFor="maximum-delivery-fee">Phí giao hàng ước tính</label>
                <RoundedSelect
                  id="maximum-delivery-fee"
                  value={maximumDeliveryFee}
                  options={deliveryFeeOptions}
                  onChange={(value) => writeParam("maxDeliveryFee", value)}
                  ariaLabel="Lọc theo phí giao hàng tối đa"
                />
              </div>
              <div className="restaurants-filter-field">
                <label htmlFor="maximum-eta">Thời gian giao ước tính</label>
                <RoundedSelect
                  id="maximum-eta"
                  value={maximumEta}
                  options={etaOptions}
                  onChange={(value) => writeParam("maxEta", value)}
                  ariaLabel="Lọc theo thời gian giao tối đa"
                />
              </div>
            </div>
            {hasFilters && (
              <button type="button" className="restaurants-filter-clear" onClick={clearFilters}>
                Xóa bộ lọc
              </button>
            )}
          </section>
        )}
      </div>

      <div className="restaurants-grid">
        {visible.map((item, index) => (
          <Reveal key={item._id} delay={Math.min(index, 7) * 70}>
            <RestaurantItem
              id={item._id}
              name={item.name}
              address={item.address}
              phone={item.phone}
              image={item.image}
              distanceKm={item.distanceKm}
              etaMin={item.etaMin}
              rating={item.rating}
            />
          </Reveal>
        ))}
      </div>

      {visible.length === 0 && (
        <EmptyState
          icon={Store}
          title={hasFilters ? "No matches" : "Nothing nearby"}
          description={
            hasFilters
              ? "No restaurant here matches those filters. Try widening your search."
              : customer
              ? `No restaurants deliver within ${NEARBY_RADIUS_KM} km of your address yet.`
              : "No restaurants are delivering right now. Please check back soon."
          }
          actionLabel={hasFilters ? "Clear filters" : undefined}
          onAction={hasFilters ? clearFilters : undefined}
        />
      )}
    </div>
  );
};

export default RestaurantsPage;
