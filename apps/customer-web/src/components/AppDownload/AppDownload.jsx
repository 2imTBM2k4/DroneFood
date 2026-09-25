import './AppDownload.css';
import { assets } from '../../assets/assets';

const AppDownload = () => {
  return (
    <div className="apple-app-download" id="app-download">
      <div className="apple-app-download-inner">
        <h2 className="apple-app-headline">
          Get the Drone Food app
        </h2>
        <p className="apple-app-lead">
          Follow your delivery in real time, from kitchen takeoff to doorstep drop.
        </p>

        <div className="apple-app-download-platforms">
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="apple-store-badge-link"
          >
            <img src={assets.app_store} alt="Download on the App Store" />
          </a>
          <a
            href="https://play.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="apple-store-badge-link"
          >
            <img src={assets.play_store} alt="Get it on Google Play" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default AppDownload;
