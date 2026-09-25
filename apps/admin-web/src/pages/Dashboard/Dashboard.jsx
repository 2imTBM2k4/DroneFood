import React, { useEffect, useState } from "react";
import { Users, Store, CheckCircle2, DollarSign } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import "./Dashboard.css";
import { formatVND } from "../../../../shared/utils/money";

const Dashboard = ({ url }) => {
  const [stats, setStats] = useState({});
  const [period, setPeriod] = useState("day");
  const [revenueData, setRevenueData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  const fetchStats = async () => {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const response = await axios.get(
        `${url}/api/user/stats?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setStats(response.data.data);

        // Format data cho revenue chart
        const formattedRevenue =
          response.data.data.revenue?.map((item) => ({
            date: item._id,
            revenue: item.totalRevenue,
          })) || [];
        setRevenueData(formattedRevenue);

        const formattedCompleted =
          response.data.data.completedSeries?.map((item) => ({
            date: item._id,
            count: item.count,
          })) || [];
        setCompletedData(formattedCompleted);

        // Tạo dữ liệu cho biểu đồ tròn order status
        // Giả sử bạn có API để lấy số lượng order theo status
        const orderStatusResponse = await axios.get(
          `${url}/api/order/status-stats`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (orderStatusResponse.data.success) {
          setOrderStatusData(orderStatusResponse.data.data);
        } else {
          // Fallback data nếu API không có
          setOrderStatusData([
            { name: "Pending", value: 15 },
            { name: "Preparing", value: 25 },
            { name: "Delivering", value: 35 },
            { name: "Delivered", value: 20 },
            { name: "Cancelled", value: 5 },
          ]);
        }
      } else {
        toast.error("Error fetching stats");
      }
    } catch (error) {
      console.error("Dashboard error:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Tính tổng thu nhập admin (20% từ tất cả order delivered)
  const adminRevenue =
    stats.revenue?.reduce((total, item) => total + item.totalRevenue, 0) || 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard Overview</h1>
        <p>Welcome back! Here's your platform performance summary.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total-users">
          <div className="stat-icon">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-number">{stats.userCount || 0}</p>
            <span className="stat-label">Registered accounts</span>
          </div>
        </div>

        <div className="stat-card total-restaurants">
          <div className="stat-icon">
            <Store size={22} />
          </div>
          <div className="stat-content">
            <h3>Total Restaurants</h3>
            <p className="stat-number">{stats.restaurantCount || 0}</p>
            <span className="stat-label">Active partners</span>
          </div>
        </div>

        <div className="stat-card completed-orders">
          <div className="stat-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <h3>Completed Orders</h3>
            <p className="stat-number">{stats.completedOrdersCount || 0}</p>
            <span className="stat-label">Successfully delivered</span>
          </div>
        </div>

        <div className="stat-card admin-revenue">
          <div className="stat-icon">
            <DollarSign size={22} />
          </div>
          <div className="stat-content">
            <h3>Admin Revenue</h3>
            <p className="stat-number">{formatVND(adminRevenue)}</p>
            <span className="stat-label">Total earnings</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Biểu đồ cột - Revenue */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Admin Revenue ({period})</h3>
            <select onChange={(e) => setPeriod(e.target.value)} value={period}>
              <option value="day">By Day</option>
              <option value="month">By Month</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [formatVND(value), "Revenue"]} />
              <Legend />
              <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Biểu đồ tròn - Order Status */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Order Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, "Orders"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional Line Chart */}
      <div className="chart-card full-width">
        <div className="chart-header">
          <h3>Revenue Trend</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
              <Tooltip formatter={(value) => [formatVND(value), "Revenue"]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#8884d8"
              strokeWidth={2}
              activeDot={{ r: 8 }}
              name="Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Completed Orders Trend */}
      <div className="chart-card full-width">
        <div className="chart-header">
          <h3>Completed Orders ({period})</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={completedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value) => [value, "Orders"]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#4CAF50"
              strokeWidth={2}
              activeDot={{ r: 6 }}
              name="Completed"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
