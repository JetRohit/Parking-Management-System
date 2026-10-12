import { useEffect, useState } from "react";
import { SquareParking, CircleCheck, Car } from "lucide-react";
import apiRequest from "../../services/api";

function AdminDashboard() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchParkingSlots();
  }, []);

  async function fetchParkingSlots() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest("/slots");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load parking information."
        );
      }

      setSlots(data.slots);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const totalSlots = slots.length;

  const availableSlots = slots.filter(
    (slot) => slot.status === "available"
  ).length;

  const occupiedSlots = slots.filter(
    (slot) => slot.status === "occupied"
  ).length;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Current parking availability and occupancy.</p>
      </div>

      {error && (
        <p className="form-error">{error}</p>
      )}

      <div className="slot-summary">
        <div className="summary-item">
          <SquareParking size={24} strokeWidth={1.8} />

          <span className="summary-label">
            Total Slots
          </span>

          <strong>
            {loading ? "--" : totalSlots}
          </strong>
        </div>

        <div className="summary-item">
          <CircleCheck size={24} strokeWidth={1.8} />

          <span className="summary-label">
            Available Slots
          </span>

          <strong>
            {loading ? "--" : availableSlots}
          </strong>
        </div>

        <div className="summary-item">
          <Car size={24} strokeWidth={1.8} />

          <span className="summary-label">
            Occupied Slots
          </span>

          <strong>
            {loading ? "--" : occupiedSlots}
          </strong>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;