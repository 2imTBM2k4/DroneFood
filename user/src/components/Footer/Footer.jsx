import "./Footer.css";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="apple-footer" id="footer" aria-label="Drone Food Directory">
      <div className="apple-footer-inner">
        {/* Multi-column Directory Links */}
        <nav className="apple-footer-directory" aria-label="Directory Navigation">
          <div className="apple-footer-column">
            <h4 className="apple-footer-heading">Drone Food</h4>
            <ul className="apple-footer-links">
              <li><Link to="/restaurants">Restaurants</Link></li>
              <li><Link to="/#app-download-section">Mobile App</Link></li>
              <li><Link to="/restaurants">15-Min Delivery</Link></li>
            </ul>
          </div>

          <div className="apple-footer-column">
            <h4 className="apple-footer-heading">Account</h4>
            <ul className="apple-footer-links">
              <li><Link to="/cart">Shopping Bag</Link></li>
              <li><Link to="/myorders">Orders & Tracking</Link></li>
              <li><Link to="/profile">Profile Settings</Link></li>
            </ul>
          </div>

          <div className="apple-footer-column">
            <h4 className="apple-footer-heading">Support</h4>
            <ul className="apple-footer-links">
              <li><a href="#help">Help Center</a></li>
              <li><a href="#safety">Delivery Safety</a></li>
              <li><a href="#contact">Contact Us</a></li>
            </ul>
          </div>

          <div className="apple-footer-column">
            <h4 className="apple-footer-heading">About</h4>
            <ul className="apple-footer-links">
              <li><a href="#about">About Us</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#newsroom">Newsroom</a></li>
            </ul>
          </div>
        </nav>

        <div className="apple-footer-divider" />

        {/* Legal and Copyright Bar */}
        <div className="apple-footer-legal-bar">
          <div className="apple-legal-left">
            <span>
              Copyright &copy; {new Date().getFullYear()} Drone Food Inc. All rights reserved.
            </span>
          </div>

          <ul className="apple-legal-links">
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
            <li><a href="#legal">Legal</a></li>
          </ul>

          <div className="apple-legal-country">
            <span>Vietnam</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
