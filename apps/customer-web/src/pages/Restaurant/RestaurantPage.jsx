import { useState, useEffect, useMemo, useRef, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, Store, UtensilsCrossed, MapPin, ChevronDown, Check, Plane } from "lucide-react";
import "./RestaurantPage.css";
import { StoreContext } from "../../context/StoreContext";
import FoodDisplay from "../../components/FoodDisplay/FoodDisplay";
import { SkeletonGrid } from "../../components/Skeleton/Skeleton";
import { EmptyState, ErrorState } from "@drone-food/web-ui/components/StateBlock";
import { assets } from "../../assets/assets";
import { formatVND } from "@drone-food/web-ui/utils/money";
import {
  haversineKm,
  estimateEtaMinutes,
  formatDistance,
} from "../../lib/distance";

/** Turn a category name into a DOM id we can scroll to. */
const sectionId = (category) =>
  `menu-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const RestaurantPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { restaurant_list, url, user, liveLocation, fees } = useContext(StoreContext);

  const [restaurant, setRestaurant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [restaurantFoods, setRestaurantFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  const navRef = useRef(null);

  useEffect(() => {
    const found = restaurant_list.find((r) => r._id === id);
    setRestaurant(found || null);
  }, [id, restaurant_list]);

  // Tải danh sách chi nhánh nếu quán là thương hiệu chuỗi
  useEffect(() => {
    if (!id) return;
    let active = true;
    const fetchBranches = async () => {
      try {
        const res = await fetch(`${url}/api/branch/list?merchantId=${id}&status=active`);
        const data = await res.json();
        if (!active) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const rawBranches = data.data;
          const customerCoords = liveLocation || user?.address;

          const annotated = rawBranches.map((b) => {
            const bLat = b.address?.lat ?? b.location?.coordinates?.[1];
            const bLng = b.address?.lng ?? b.location?.coordinates?.[0];
            let dist = null;
            if (
              customerCoords &&
              typeof customerCoords.lat === "number" &&
              typeof customerCoords.lng === "number" &&
              typeof bLat === "number" &&
              typeof bLng === "number"
            ) {
              dist = haversineKm(
                { lat: customerCoords.lat, lng: customerCoords.lng },
                { lat: bLat, lng: bLng }
              );
            }
            return {
              ...b,
              distanceKm: dist,
              etaMin: dist != null ? estimateEtaMinutes(dist) : null,
            };
          });

          if (customerCoords) {
            annotated.sort((a, b) => {
              if (a.distanceKm == null) return 1;
              if (b.distanceKm == null) return -1;
              return a.distanceKm - b.distanceKm;
            });
          }

          setBranches(annotated);
          setSelectedBranch(annotated[0]);
        } else {
          setBranches([]);
          setSelectedBranch(null);
        }
      } catch (err) {
        console.error("Fetch branches error:", err);
        setBranches([]);
        setSelectedBranch(null);
      }
    };

    fetchBranches();
    return () => {
      active = false;
    };
  }, [id, url, liveLocation, user]);

  const fetchFoods = useCallback(async (signal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const queryObj = { limit: "100" };
      if (selectedBranch) {
        queryObj.branchId = selectedBranch._id;
      } else {
        queryObj.restaurantId = id;
      }
      const params = new URLSearchParams(queryObj);
      const response = await fetch(`${url}/api/food/list?${params}`, { signal });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const data = await response.json();
      if (data.success) {
        setRestaurantFoods(data.data || []);
      } else {
        throw new Error(data.message || "Could not load this menu");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setRestaurantFoods([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id, url, selectedBranch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFoods(controller.signal);
    return () => controller.abort();
  }, [fetchFoods]);

  // Categories in the order the kitchen listed them, deduplicated.
  const categories = useMemo(
    () => [...new Set(restaurantFoods.map((item) => item.category).filter(Boolean))],
    [restaurantFoods]
  );

  // One bucket of dishes per category — the page renders every section at
  // once and lets the nav scroll between them, rather than filtering.
  const sections = useMemo(
    () =>
      categories.map((category) => ({
        category,
        id: sectionId(category),
        foods: restaurantFoods.filter((item) => item.category === category),
      })),
    [categories, restaurantFoods]
  );

  useEffect(() => {
    setActiveCategory((current) =>
      current && categories.includes(current) ? current : categories[0] || null
    );
  }, [categories]);

  // Scroll-spy: keep the catalog in sync with the section currently passing
  // the reading line. A requestAnimationFrame keeps this inexpensive while
  // still responding immediately to mouse wheel, touch, and keyboard scrolls.
  useEffect(() => {
    if (sections.length === 0) return;

    let animationFrame = null;

    const syncActiveCategory = () => {
      animationFrame = null;
      const mobileCatalog = window.matchMedia("(max-width: 900px)").matches;
      const navbarOffset =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--navbar-offset")
        ) || 96;
      // The mobile catalog sits below the fixed navbar, while the desktop
      // sidebar is vertically centered and never covers section headings.
      const readingLine = mobileCatalog && navRef.current
        ? navRef.current.getBoundingClientRect().bottom + 16
        : mobileCatalog
          ? navbarOffset + 24
          : window.innerHeight * 0.5;

      let nextCategory = sections[0].category;
      for (const section of sections) {
        const node = document.getElementById(section.id);
        if (node && node.getBoundingClientRect().top <= readingLine) {
          nextCategory = section.category;
        } else {
          break;
        }
      }

      setActiveCategory((current) =>
        current === nextCategory ? current : nextCategory
      );
    };

    const queueSync = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(syncActiveCategory);
      }
    };

    syncActiveCategory();
    window.addEventListener("scroll", queueSync, { passive: true });
    window.addEventListener("resize", queueSync);

    return () => {
      window.removeEventListener("scroll", queueSync);
      window.removeEventListener("resize", queueSync);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [sections]);

  // Keep the active chip in view on the horizontally scrolling mobile bar.
  useEffect(() => {
    if (
      !activeCategory ||
      !navRef.current ||
      !window.matchMedia("(max-width: 900px)").matches
    ) return;
    const chip = navRef.current.querySelector(`[data-chip="${activeCategory}"]`);
    if (chip?.scrollIntoView) {
      chip.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [activeCategory]);

  const handleCategoryClick = (category) => {
    const target = document.getElementById(sectionId(category));
    if (!target) return;

    setActiveCategory(category);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobileCatalog = window.matchMedia("(max-width: 900px)").matches;
    const offset = mobileCatalog && navRef.current
      ? navRef.current.getBoundingClientRect().height + 112
      : 120;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const buildImgSrc = (image) => {
    if (!image) return assets.logo;
    if (image.startsWith("http")) return image;
    return `${url}${image}`;
  };

  // Real distance + delivery estimate when we know both ends' coordinates.
  const { distanceKm, etaMin } = useMemo(() => {
    if (selectedBranch && selectedBranch.distanceKm != null) {
      return {
        distanceKm: selectedBranch.distanceKm,
        etaMin: selectedBranch.etaMin,
      };
    }
    const a = liveLocation || user?.address;
    const target = selectedBranch
      ? {
          lat:
            selectedBranch.address?.lat ??
            selectedBranch.location?.coordinates?.[1],
          lng:
            selectedBranch.address?.lng ??
            selectedBranch.location?.coordinates?.[0],
        }
      : restaurant;
    if (
      target &&
      typeof target.lat === "number" &&
      typeof target.lng === "number" &&
      a &&
      typeof a.lat === "number" &&
      typeof a.lng === "number"
    ) {
      const d = haversineKm(
        { lat: a.lat, lng: a.lng },
        { lat: target.lat, lng: target.lng }
      );
      return { distanceKm: d, etaMin: estimateEtaMinutes(d) };
    }
    return { distanceKm: null, etaMin: null };
  }, [selectedBranch, restaurant, liveLocation, user]);


  const deliveryFee = fees?.deliveryFee;
  const rawRestaurantRating = Number(restaurant?.averageRating ?? restaurant?.rating);
  const restaurantRating =
    Number.isFinite(rawRestaurantRating) &&
    rawRestaurantRating >= 0 &&
    rawRestaurantRating <= 5
      ? rawRestaurantRating
      : null;

  // The restaurant list may still be loading — don't call it missing yet.
  if (!restaurant && restaurant_list.length === 0) {
    return (
      <div className="restaurant-page">
        <div className="skeleton restaurant-banner-skeleton" />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="restaurant-page">
        <EmptyState
          icon={Store}
          title="Restaurant not found"
          description="This restaurant may have closed or the link is out of date."
          actionLabel="Browse restaurants"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  return (
    <div className="restaurant-page">
        <header className="restaurant-hero">
          <div className="restaurant-hero-image">
            <img
              src={buildImgSrc(restaurant.image)}
              alt={restaurant.name}
              onError={(e) => {
                e.target.src = assets.logo;
              }}
            />
          </div>

          <div className="restaurant-hero-card">
            <div className="restaurant-hero-top">
              <h1>{restaurant.name}</h1>
              {typeof restaurantRating === "number" && (
                <span className="restaurant-hero-rating">
                  <Star size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  <span aria-label={`Rating ${restaurantRating.toFixed(1)} out of 5`}>
                    {restaurantRating.toFixed(1)}
                  </span>
                </span>
              )}
            </div>

            {restaurant.description && (
              <p className="restaurant-hero-desc">{restaurant.description}</p>
            )}

            <div className="restaurant-hero-meta">
              <span className="restaurant-hero-meta-item">
                {selectedBranch
                  ? selectedBranch.address?.text || selectedBranch.address || "Chi nhánh"
                  : restaurant.address}
              </span>
              {(selectedBranch?.phone || restaurant.phone) && (
                <span className="restaurant-hero-meta-item">
                  {selectedBranch?.phone || restaurant.phone}
                </span>
              )}
              {typeof distanceKm === "number" && (
                <span className="restaurant-hero-meta-item">
                  {formatDistance(distanceKm)}
                </span>
              )}
              <span className="restaurant-hero-meta-item">
                Giờ mở cửa: {restaurant.openingHours?.openTime || "07:00"} - {restaurant.openingHours?.closeTime || "22:00"}
              </span>
              <span className="restaurant-hero-meta-item">
                {etaMin ? `${etaMin} phút` : "15–25 phút"}
              </span>
              <span className="restaurant-hero-meta-item">
                {typeof deliveryFee === "number"
                  ? `${formatVND(deliveryFee)} giao hàng`
                  : "Phí giao tính lúc checkout"}
              </span>
            </div>

            {selectedBranch && (
              <div className="restaurant-branch-bar">
                <div className="branch-bar-left">
                  <div className="branch-title-row">
                    <span className="branch-label">Chi nhánh phục vụ:</span>
                    <strong className="branch-name">{selectedBranch.name}</strong>
                    {selectedBranch.droneDeliveryEnabled && (
                      <span className="branch-drone-tag">
                        <Plane size={13} /> Giao Drone
                      </span>
                    )}
                  </div>
                  <p className="branch-address-text">
                    <MapPin size={13} />{" "}
                    {selectedBranch.address?.text ||
                      selectedBranch.address ||
                      "Địa chỉ chi nhánh"}
                  </p>
                </div>
                {branches.length > 1 && (
                  <button
                    type="button"
                    className="branch-switch-btn"
                    onClick={() => setBranchModalOpen(true)}
                  >
                    Đổi chi nhánh ({branches.length}) <ChevronDown size={14} />
                  </button>
                )}
              </div>
            )}

            {((selectedBranch ? selectedBranch.isOpen === false : restaurant.isOpen === false) ||
              restaurant.isOpenNow === false) && (
              <p className="restaurant-hero-closed">
                {selectedBranch && selectedBranch.isOpen === false
                  ? `Chi nhánh ${selectedBranch.name} hiện đang tạm đóng cửa và không nhận đơn lúc này.`
                  : `Nhà hàng hiện đang đóng cửa (Giờ hoạt động: ${restaurant.openingHours?.openTime || "07:00"} - ${restaurant.openingHours?.closeTime || "22:00"}). Quý khách vui lòng quay lại trong giờ mở cửa.`}
              </p>
            )}

            {restaurant.isLocked && (
              <p className="restaurant-hero-closed">
                Nhà hàng tạm thời ngưng hoạt động — không nhận đơn hàng vào lúc này.
              </p>
            )}
          </div>
        </header>

        <div className="restaurant-menu-layout">
          <div className="restaurant-page-content">
            {loading && <SkeletonGrid count={6} />}

            {!loading && error && (
              <ErrorState
                title="Could not load this menu"
                description={error}
                onRetry={fetchFoods}
                actionLabel="Back to restaurants"
                onAction={() => navigate("/")}
              />
            )}

            {!loading && !error && restaurant.isOpen === false && (
              <EmptyState
                icon={Store}
                title="This restaurant is closed"
                description="The kitchen has paused orders for now. Browse other restaurants delivering to you."
                actionLabel="Browse restaurants"
                onAction={() => navigate("/restaurants")}
              />
            )}

            {!loading &&
              !error &&
              restaurant.isOpen !== false &&
              sections.map(({ category, id: anchor, foods }) => (
                <section
                  key={category}
                  id={anchor}
                  data-category={category}
                  className="menu-section"
                >
                  <h2 className="menu-section-title">{category}</h2>
                  <FoodDisplay
                    foods={foods}
                    category="All"
                    restaurantId={id}
                    branchId={selectedBranch?._id}
                  />
                </section>
              ))}

            {!loading && !error && sections.length === 0 && (
              <EmptyState
                icon={UtensilsCrossed}
                title="No dishes yet"
                description="This restaurant hasn't published its menu. Check back soon."
                actionLabel="Browse restaurants"
                onAction={() => navigate("/")}
              />
            )}
          </div>

          {sections.length > 0 && restaurant.isOpen !== false && (
            <nav className="restaurant-catalog" ref={navRef} aria-label="Menu categories">
              <div className="catalog-list">
                {sections.map(({ category }) => (
                  <button
                    key={category}
                    type="button"
                    data-chip={category}
                    className={`catalog-item ${activeCategory === category ? "active" : ""}`}
                    aria-current={activeCategory === category ? "true" : undefined}
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>

      {branchModalOpen && (
        <div
          className="branch-modal-overlay"
          onClick={() => setBranchModalOpen(false)}
        >
          <div
            className="branch-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="branch-modal-header">
              <h3>Chọn chi nhánh phục vụ</h3>
              <button
                type="button"
                className="close"
                onClick={() => setBranchModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <p className="branch-modal-desc">
              Các chi nhánh thuộc hệ thống <strong>{restaurant.name}</strong>. Hãy chọn chi nhánh thuận tiện nhất để tối ưu phí và thời gian giao hàng:
            </p>
            <div className="branch-list">
              {branches.map((b) => {
                const isSelected = selectedBranch?._id === b._id;
                return (
                  <div
                    key={b._id}
                    className={`branch-item-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedBranch(b);
                      setBranchModalOpen(false);
                    }}
                  >
                    <div className="branch-item-details">
                      <div className="branch-item-head">
                        <span className="branch-item-name">{b.name}</span>
                        {b.isOpen === false && (
                          <span className="branch-closed-badge">Tạm đóng</span>
                        )}
                        {b.droneDeliveryEnabled && (
                          <span className="branch-drone-chip">
                            <Plane size={11} /> Drone
                          </span>
                        )}
                      </div>
                      <p className="branch-item-addr">
                        {b.address?.text || b.address || "Chưa có địa chỉ"}
                      </p>
                      <div className="branch-item-meta">
                        {b.distanceKm != null && (
                          <span>Cách bạn {formatDistance(b.distanceKm)}</span>
                        )}
                        {b.etaMin != null && (
                          <span>· Khoảng {b.etaMin} phút</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={18} className="branch-check-icon" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantPage;
