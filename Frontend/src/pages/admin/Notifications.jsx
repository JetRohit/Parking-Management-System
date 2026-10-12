import { Bell } from "lucide-react";

function Notifications() {
  return (
    <div>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>View and manage employee requests.</p>
      </div>

      <div className="empty-state">
        <Bell size={32} strokeWidth={1.6} />

        <h2>No notifications</h2>

        <p>Employee password reset requests will appear here.</p>
      </div>
    </div>
  );
}

export default Notifications;