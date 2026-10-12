import { useEffect, useState } from "react";
import apiRequest from "../../services/api";

function ParkingSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSlots() {
      try {
        const response = await apiRequest("/slots");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load parking slots.");
        }

        if (active) {
          setSlots(data.slots);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSlots();

    const interval = setInterval(loadSlots, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const activeSlots = slots.filter(
    (slot) => slot.is_active !== false && slot.is_active !== 0
  );

  const availableCount = activeSlots.filter(
    (slot) => slot.status === "available"
  ).length;

  const occupiedCount = activeSlots.filter(
    (slot) => slot.status === "occupied"
  ).length;

  function renderSlots(type) {
    const filteredSlots = activeSlots.filter(
      (slot) => slot.slot_type === type
    );

    return (
      <section className="slot-section">
        <h2>
          {type} Slots ({filteredSlots.length})
        </h2>

        <div className="slots-grid">
          {filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className={`parking-slot ${
                slot.status === "occupied"
                  ? "occupied"
                  : "available"
              }`}
              title={`${slot.slot_number} - ${slot.status}`}
            >
              {slot.slot_number}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loading) {
    return <p>Loading parking slots...</p>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Parking Slots</h1>
        <p>Live parking slot availability.</p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="parking-summary">
        <div className="summary-card">
          <h3>Total Slots</h3>
          <strong>{activeSlots.length}</strong>
        </div>

        <div className="summary-card">
          <h3>Available Slots</h3>
          <strong>{availableCount}</strong>
        </div>

        <div className="summary-card">
          <h3>Occupied Slots</h3>
          <strong>{occupiedCount}</strong>
        </div>
      </div>

      <div className="slot-legend">
        <span>
          <span className="legend-dot available" />
          Available
        </span>

        <span>
          <span className="legend-dot occupied" />
          Occupied
        </span>
      </div>

      {renderSlots("Bike")}
      {renderSlots("Car")}
      {renderSlots("Minivan")}
    </div>
  );
}

export default ParkingSlots;