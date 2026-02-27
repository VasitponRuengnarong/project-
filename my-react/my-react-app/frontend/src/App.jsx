import React from "react";
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// --- Components ---
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MainLayout from "./MainLayout";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import UserDashboard from "./components/dashboard/UserDashboard";
import ProductManagement from "./components/management/ProductManagement";
import BorrowReturn from "./components/borrow/BorrowReturn";
import History from "./components/borrow/BorrowHistory";
import UserProfile from "./components/profile/UserProfile";
import MemberManagement from "./components/management/MemberManagement";
import ApprovalPage from "./components/management/ApprovalPage";
import ActivityLogPage from "./components/management/ActivityLogPage";
import AccessDenied from "./components/ui/AccessDenied";
import NotificationHistory from "./components/notifications/NotificationHistory";

import "./GlobalStyles.css";

import { NotificationProvider } from "./context/NotificationContext";

const DashboardResolver = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user?.role === "Admin") {
    return <AdminDashboard />;
  }
  return <UserDashboard />;
};

function App() {
  return (
    <NotificationProvider>
      <Router>
        <Routes>
          {/* --- Public Routes (เข้าได้ไม่ต้อง Login) --- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* --- Protected Routes (ต้อง Login + มี Sidebar/Header) --- */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["Admin", "User", "Staff", "Manager"]}
              >
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Route ลูกเหล่านี้จะไปโผล่ใน <Outlet /> ของ MainLayout */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardResolver />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="approvals" element={<ApprovalPage />} />
            <Route path="logs" element={<ActivityLogPage />} />
            <Route path="members" element={<MemberManagement />} />
            <Route path="borrow" element={<BorrowReturn />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="notifications" element={<NotificationHistory />} />

            {/* Catch All: หน้าที่ไม่เจอในระบบ ให้แสดง 404 */}
            <Route
              path="*"
              element={
                <div className="p-10 text-center">
                  <h1>404 Page Not Found</h1>
                </div>
              }
            />
          </Route>
        </Routes>
      </Router>
    </NotificationProvider>
  );
}

export default App;
