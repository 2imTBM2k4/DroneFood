import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useContext(AuthContext); // MỚI: Lấy isLoading

  // MỚI: Nếu đang loading (init auth), hiển thị spinner thay vì redirect
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div> {/* Có thể thay bằng spinner component */}
      </div>
    );
  }

  // Nếu không loading và có user: render children
  // Nếu không loading và không user: redirect
  return user ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;