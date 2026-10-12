import { useEffect, useState } from "react";
import apiRequest from "../../services/api";


function EmployeeDashboard() {
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
          data.detail ||
            "Failed to load parking slots."
        );
      }

      setSlots(data.slots || []);

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


  const bikeSlots = slots.filter(
    (slot) => slot.slot_type === "Bike"
  );


  const carSlots = slots.filter(
    (slot) => slot.slot_type === "Car"
  );


  const minivanSlots = slots.filter(
    (slot) => slot.slot_type === "Minivan"
  );


  function renderSlots(slotList) {
    return (
      <div className="booking-slots-grid">

        {slotList.map((slot) => {

          const isAvailable =
            slot.status === "available";

          return (
            <div
              key={slot.id}
              className={
                `booking-slot ${
                  isAvailable
                    ? "booking-slot-available"
                    : "booking-slot-occupied"
                }`
              }
            >
              {slot.slot_number}
            </div>
          );
        })}

      </div>
    );
  }


  return (
    <div>

      <div className="page-header">
        <h1>Dashboard</h1>

        <p>
          View the current status of parking slots.
        </p>
      </div>


      {error && (
        <p className="form-error">
          {error}
        </p>
      )}


      {/* ========================================
          SLOT SUMMARY
      ======================================== */}

      <div className="slot-summary">

        <div className="summary-item">

          <span className="summary-label">
            Total Slots
          </span>

          <strong>
            {loading ? "--" : totalSlots}
          </strong>

        </div>


        <div className="summary-item">

          <span className="summary-label">
            Available Slots
          </span>

          <strong>
            {loading ? "--" : availableSlots}
          </strong>

        </div>


        <div className="summary-item">

          <span className="summary-label">
            Occupied Slots
          </span>

          <strong>
            {loading ? "--" : occupiedSlots}
          </strong>

        </div>

      </div>


      {/* ========================================
          PARKING SLOT DISPLAY
      ======================================== */}

      {!loading && (
        <>

          <section
            className="management-section"
            style={{ marginTop: "32px" }}
          >

            <h2>Bike Slots</h2>

            {bikeSlots.length > 0 ? (
              renderSlots(bikeSlots)
            ) : (
              <p className="management-note">
                No Bike slots found.
              </p>
            )}

          </section>


          <section
            className="management-section"
            style={{ marginTop: "24px" }}
          >

            <h2>Car Slots</h2>

            {carSlots.length > 0 ? (
              renderSlots(carSlots)
            ) : (
              <p className="management-note">
                No Car slots found.
              </p>
            )}

          </section>


          <section
            className="management-section"
            style={{ marginTop: "24px" }}
          >

            <h2>Minivan Slots</h2>

            {minivanSlots.length > 0 ? (
              renderSlots(minivanSlots)
            ) : (
              <p className="management-note">
                No Minivan slots found.
              </p>
            )}

          </section>


          <div className="slot-legend">

            <div className="slot-legend-item">

              <span
                className="
                  slot-legend-dot
                  slot-legend-available
                "
              />

              <span>Available</span>

            </div>


            <div className="slot-legend-item">

              <span
                className="
                  slot-legend-dot
                  slot-legend-occupied
                "
              />

              <span>Occupied</span>

            </div>

          </div>

        </>
      )}

    </div>
  );
}


export default EmployeeDashboard;