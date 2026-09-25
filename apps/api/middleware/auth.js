import jwt from "jsonwebtoken";
import userModel from "../models/userModel.cjs";
import Restaurant from "../models/restaurantModel.cjs";

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not Authorized. Login Again" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is undefined!");
    return res
      .status(500)
      .json({ success: false, message: "Server config error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === "refresh") {
      return res
        .status(401)
        .json({ success: false, message: "Cannot use refresh token for authentication" });
    }

    const user = await userModel
      .findById(decoded.id)
      .select("name email role restaurantId phone address locked balance")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.locked) {
      return res.status(403).json({
        success: false,
        message: "Your account is locked. Contact admin.",
      });
    }

    // Ensure restaurantId is string
    if (user.restaurantId) {
      user.restaurantId = user.restaurantId.toString();
    }

    // Check restaurant lock for restaurant owners
    if (user.role === "restaurant_owner" && user.restaurantId) {
      const restaurant = await Restaurant.findById(user.restaurantId)
        .select("isLocked")
        .lean();

      if (!restaurant) {
        return res
          .status(404)
          .json({ success: false, message: "Restaurant not found" });
      }

      if (restaurant.isLocked) {
        return res.status(403).json({
          success: false,
          message: "Your restaurant is pending admin approval.",
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid Token" });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token Expired" });
    }

    return res.status(401).json({ success: false, message: "Invalid Token" });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userModel
        .findById(decoded.id)
        .select("name email role restaurantId phone address locked balance")
        .lean();

      if (user && !user.locked) {
        // Check restaurant lock for restaurant owners
        if (user.role === "restaurant_owner" && user.restaurantId) {
          const restaurant = await Restaurant.findById(user.restaurantId)
            .select("isLocked")
            .lean();

          if (restaurant && restaurant.isLocked) {
            return next(); // Skip setting user if restaurant is locked
          }
        }

        if (user.restaurantId) {
          user.restaurantId = user.restaurantId.toString();
        }
        req.user = user;
      }
    } catch (error) {
      // Silently fail for optional auth
    }
  }

  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized: Insufficient permissions" });
    }
    next();
  };
};

export { protect, optionalAuth, authorize };
