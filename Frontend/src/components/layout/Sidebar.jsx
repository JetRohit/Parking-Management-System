import {
  LayoutDashboard,
  UserPlus,
  SquareParking,
  LogIn,
  LogOut,
  CalendarPlus,
  ClipboardList,
  X,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const adminLinks = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Create Employee",
      path: "/admin/create-employee",
      icon: UserPlus,
    },
    {
      name: "Parking Slots",
      path: "/admin/parking-slots",
      icon: SquareParking,
    },
  ];

  const employeeLinks = [
    {
      name: "Dashboard",
      path: "/employee/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Vehicle Entry",
      path: "/employee/vehicle-entry",
      icon: LogIn,
    },
    {
      name: "Vehicle Exit",
      path: "/employee/vehicle-exit",
      icon: LogOut,
    },
  ];

  const userLinks = [
    {
      name: "Dashboard",
      path: "/user/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Book Parking",
      path: "/user/book-parking",
      icon: CalendarPlus,
    },
    {
      name: "My Bookings",
      path: "/user/bookings",
      icon: ClipboardList,
    },
  ];

  const links =
    user?.role === "admin"
      ? adminLinks
      : user?.role === "employee"
      ? employeeLinks
      : userLinks;

  async function handleLogout() {
    try {
      await logout();
      onClose();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${
          isOpen ? "sidebar-overlay-open" : ""
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`app-sidebar ${
          isOpen ? "app-sidebar-open" : ""
        }`}
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <span className="sidebar-title">
            Menu
          </span>

          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </div>

        <nav className="sidebar-navigation">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={onClose}
                className={({ isActive }) =>
                  isActive
                    ? "sidebar-link sidebar-link-active"
                    : "sidebar-link"
                }
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{link.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span>Logout</span>
        </button>
      </aside>
    </>
  );
}

export default Sidebar;