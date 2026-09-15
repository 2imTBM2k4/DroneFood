import { useContext } from 'react';
import { Store } from 'lucide-react';
import './RestaurantDisplay.css';
import { StoreContext } from '../../context/StoreContext';
import RestaurantItem from '../RestaurantItem/RestaurantItem';
import Reveal from '../Reveal/Reveal';
import { SkeletonGrid } from '../Skeleton/Skeleton';
import { EmptyState, ErrorState } from '../../../../shared/components/StateBlock';
import { NEARBY_RADIUS_KM } from '../../lib/distance';
import useNearbyRestaurants from '../../hooks/useNearbyRestaurants';

const RestaurantDisplay = () => {
  const { isLoadingRestaurants, restaurantError, fetchRestaurantList } =
    useContext(StoreContext);
  // Same source of truth as the browse page, so both agree on what's nearby.
  const { restaurants, customer } = useNearbyRestaurants();

  if (isLoadingRestaurants) {
    return (
      <div className="restaurant-display" id="restaurant-display">
        <SkeletonGrid count={6} variant="restaurant" />
      </div>
    );
  }

  if (restaurantError) {
    return (
      <div className="restaurant-display" id="restaurant-display">
        <ErrorState
          title="Could not load restaurants"
          description={restaurantError}
          onRetry={fetchRestaurantList}
        />
      </div>
    );
  }

  return (
    <div className="restaurant-display" id="restaurant-display">
      <div className="restaurant-display-list">
        {restaurants.map((item, index) => (
          <Reveal key={item._id} delay={Math.min(index, 7) * 70}>
            <RestaurantItem
              id={item._id}
              name={item.name}
              address={item.address}
              phone={item.phone}
              image={item.image}
              distanceKm={item.distanceKm}
              etaMin={item.etaMin}
              estimatedDeliveryFee={item.estimatedDeliveryFee}
              rating={item.rating}
            />
          </Reveal>
        ))}
        {restaurants.length === 0 && (
          <EmptyState
            icon={Store}
            title={
              customer ? 'No restaurants near you yet' : 'No restaurants yet'
            }
            description={
              customer
                ? `We couldn't find any restaurants delivering within ${NEARBY_RADIUS_KM} km of your address. Try a different delivery location.`
                : 'No restaurants are delivering right now. Please check back soon.'
            }
          />
        )}
      </div>
    </div>
  );
};

export default RestaurantDisplay;
