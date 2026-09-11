import './Home.css';
import Header from '../../components/Header/Header';
import AppDownload from '../../components/AppDownload/AppDownload';
import RestaurantDisplay from '../../components/RestaurantDisplay/RestaurantDisplay';
import Reveal from '../../components/Reveal/Reveal';

const Home = () => {
  return (
    <div className="apple-home-flow">
      {/* 1. Clean Hero Product Tile */}
      <Header />

      {/* 2. Restaurants Section — Parchment Tile */}
      <section className="apple-tile-parchment section-tile" id="restaurants-section">
        <div className="container">
          <div className="apple-section-header">
            <h2 className="apple-tile-headline">
              Restaurants near you
            </h2>
            <p className="apple-tile-sub">
              Popular spots ready to prepare and fly your meal.
            </p>
          </div>
          <RestaurantDisplay />
        </div>
      </section>

      {/* 3. Clean App Showcase */}
      <section className="apple-tile-light section-tile" id="app-download-section">
        <Reveal>
          <AppDownload />
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
