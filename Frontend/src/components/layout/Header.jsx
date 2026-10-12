import { Bell, Menu, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Header({ onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="header-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-controls="main-navigation"
        >
          <Menu size={24} strokeWidth={1.8} />
        </button>
      </div>

      <div className="header-brand">
        PMS
      </div>

      <div className="header-actions">
        {isAdmin && (
          <button
            type="button"
            className="header-icon-button"
            onClick={() => navigate("/admin/notifications")}
            aria-label="Notifications"
          >
            <Bell size={21} strokeWidth={1.8} />
          </button>
        )}

        <div className="header-profile">
          <div className="profile-icon">
            <User size={20} strokeWidth={1.8} />
          </div>

          <span className="profile-role">
            {user?.username}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;