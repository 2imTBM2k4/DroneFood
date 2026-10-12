import { getDashboardSnapshot } from "../services/adminDashboardService.js";

export const getDashboard = async (req, res) => {
  try {
    const result = await getDashboardSnapshot(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
