import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import AdminLayout from "../layouts/AdminLayout";
import EmployeeLayout from "../layouts/EmployeeLayout";
import UserLayout from "../layouts/UserLayout/UserLayout";

import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Register from "../pages/auth/Register";

import AdminDashboard from "../pages/admin/AdminDashboard";
import CreateEmployee from "../pages/admin/CreateEmployee";
import ParkingSlots from "../pages/admin/ParkingSlots";
import EditSlots from "../pages/admin/EditSlots";
import Notifications from "../pages/admin/Notifications";

import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import VehicleEntry from "../pages/employee/VehicleEntry";
import VehicleExit from "../pages/employee/VehicleExit";

import UserDashboard from "../pages/user/UserDashboard";
import BookParking from "../pages/user/BookParking";
import MyBookings from "../pages/user/MyBookings";


function AppRoutes() {
  const { user, loading } = useAuth();


  if (loading) {
    return (
      <div className="app-loading">
        Loading...
      </div>
    );
  }


  function getDashboardPath() {
    if (user?.role === "admin") {
      return "/admin/dashboard";
    }

    if (user?.role === "employee") {
      return "/employee/dashboard";
    }

    return "/user/dashboard";
  }


  return (
    <Routes>

      {/* ========================================
          LOGIN / HOME
      ======================================== */}

      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={getDashboardPath()}
              replace
            />
          ) : (
            <Login />
          )
        }
      />


      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={getDashboardPath()}
              replace
            />
          ) : (
            <Login />
          )
        }
      />


      {/* ========================================
          USER REGISTRATION
      ======================================== */}

      <Route
        path="/user/register"
        element={
          user ? (
            <Navigate
              to={getDashboardPath()}
              replace
            />
          ) : (
            <Register />
          )
        }
      />


      {/* ========================================
          FORGOT PASSWORD
      ======================================== */}

      <Route
        path="/forgot-password"
        element={
          user ? (
            <Navigate
              to={getDashboardPath()}
              replace
            />
          ) : (
            <ForgotPassword />
          )
        }
      />


      {/* ========================================
          ADMIN
      ======================================== */}

      {user?.role === "admin" && (
        <Route
          path="/admin"
          element={<AdminLayout />}
        >

          <Route
            index
            element={
              <Navigate
                to="dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="create-employee"
            element={<CreateEmployee />}
          />

          <Route
            path="parking-slots"
            element={<ParkingSlots />}
          />

          <Route
            path="edit-slots"
            element={<EditSlots />}
          />

          <Route
            path="notifications"
            element={<Notifications />}
          />

        </Route>
      )}


      {/* ========================================
          EMPLOYEE
      ======================================== */}

      {user?.role === "employee" && (
        <Route
          path="/employee"
          element={<EmployeeLayout />}
        >

          <Route
            index
            element={
              <Navigate
                to="dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<EmployeeDashboard />}
          />

          <Route
            path="vehicle-entry"
            element={<VehicleEntry />}
          />

          <Route
            path="vehicle-exit"
            element={<VehicleExit />}
          />

        </Route>
      )}


      {/* ========================================
          USER
      ======================================== */}

      {user?.role === "user" && (
        <Route
          path="/user"
          element={<UserLayout />}
        >

          <Route
            index
            element={
              <Navigate
                to="dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<UserDashboard />}
          />

          <Route
            path="book-parking"
            element={<BookParking />}
          />

          <Route
            path="bookings"
            element={<MyBookings />}
          />

        </Route>
      )}


      {/* ========================================
          FALLBACK
      ======================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}


export default AppRoutes;