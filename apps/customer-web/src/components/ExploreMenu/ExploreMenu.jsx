import "./ExploreMenu.css";
import { menu_list } from "../../assets/assets";

const ExploreMenu = ({ category, setCategory }) => {
  return (
    <section className="apple-explore-menu" id="explore-menu">
      <div className="apple-explore-head">
        <h2 className="apple-explore-title">Explore by Cuisine</h2>
        <p className="apple-explore-subtitle">
          Curated menus from artisan chefs, packaged for flight-grade stability.
        </p>
      </div>

      <div className="apple-chips-scroll-container">
        <button
          type="button"
          onClick={() => setCategory("All")}
          className={`apple-chip configurator-option-chip ${
            category === "All" ? "selected configurator-option-chip-selected" : ""
          }`}
        >
          <span className="apple-chip-dot" />
          <span className="apple-chip-label">All Cuisines</span>
        </button>

        {menu_list.map((item, index) => {
          const isSelected = category === item.menu_name;
          return (
            <button
              type="button"
              key={index}
              onClick={() =>
                setCategory((prev) =>
                  prev === item.menu_name ? "All" : item.menu_name
                )
              }
              className={`apple-chip configurator-option-chip ${
                isSelected ? "selected configurator-option-chip-selected" : ""
              }`}
            >
              <img
                className="apple-chip-thumb"
                src={item.menu_image}
                alt={item.menu_name}
              />
              <span className="apple-chip-label">{item.menu_name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ExploreMenu;
