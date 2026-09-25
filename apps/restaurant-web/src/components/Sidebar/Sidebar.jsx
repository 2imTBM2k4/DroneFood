import React from 'react';
import './Sidebar.css';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, ClipboardList } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className='sidebar'>
      <nav className="sidebar-nav">
        <NavLink to='/dashboard' className="sidebar-item">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to='/list' className="sidebar-item">
          <UtensilsCrossed size={20} />
          <span>Menu Items</span>
        </NavLink>
        <NavLink to='/orders' className="sidebar-item">
          <ClipboardList size={20} />
          <span>Orders</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
