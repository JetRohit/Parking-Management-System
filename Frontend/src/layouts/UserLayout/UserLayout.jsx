import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";

function UserLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">

      <Header
        onMenuClick={() =>
          setMenuOpen(true)
        }
      />

      <Sidebar
        isOpen={menuOpen}
        onClose={() =>
          setMenuOpen(false)
        }
      />

      <main className="app-content">
        <Outlet />
      </main>

    </div>
  );
}

export default UserLayout;