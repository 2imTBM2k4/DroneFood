import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext, RESTAURANT_ROLES } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const isAllowed = user && RESTAURANT_ROLES.includes(user.role);
  if (!isAllowed) return <Navigate to="/login" replace />;

  if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;