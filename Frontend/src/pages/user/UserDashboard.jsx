import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import apiRequest from "../../services/api";


function UserDashboard() {
  const navigate = useNavigate();

  const [currentBooking, setCurrentBooking] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    loadCurrentBooking();
  }, []);


  async function loadCurrentBooking() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(
        "/bookings/my-bookings"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load booking."
        );
      }


      const activeBookings =
        (data.bookings || [])
          .filter(
            (booking) =>
              booking.status === "booked" ||
              booking.status === "checked_in"
          )
          .sort(
            (a, b) =>
              new Date(a.booking_start) -
              new Date(b.booking_start)
          );


      setCurrentBooking(
        activeBookings.length > 0
          ? activeBookings[0]
          : null
      );

    } catch (error) {
      setError(error.message);

    } finally {
      setLoading(false);
    }
  }


  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString();
  }


  return (
    <div>

      <div className="page-header">
        <h1>User Dashboard</h1>

        <p>
          Manage your parking bookings.
        </p>
      </div>


      <section className="management-section">

        <h2>Current Booking</h2>


        {loading ? (
          <p className="management-note">
            Loading booking...
          </p>

        ) : error ? (
          <p className="form-error">
            {error}
          </p>

        ) : currentBooking ? (
          <div>

            <p>
              Slot:{" "}
              <strong>
                {currentBooking.slot_number}
              </strong>
            </p>


            <p>
              Vehicle Number:{" "}
              <strong>
                {currentBooking.vehicle_number}
              </strong>
            </p>


            <p>
              Vehicle Type:{" "}
              <strong>
                {currentBooking.vehicle_type}
              </strong>
            </p>


            <p>
              Start:{" "}
              <strong>
                {formatDateTime(
                  currentBooking.booking_start
                )}
              </strong>
            </p>


            <p>
              End:{" "}
              <strong>
                {formatDateTime(
                  currentBooking.booking_end
                )}
              </strong>
            </p>


            <p>
              Status:{" "}
              <strong>
                {currentBooking.status}
              </strong>
            </p>


            <Button
              type="button"
              onClick={() =>
                navigate("/user/bookings")
              }
            >
              View Booking
            </Button>

          </div>

        ) : (
          <div>

            <p className="management-note">
              No current bookings.
            </p>


            <Button
              type="button"
              onClick={() =>
                navigate("/user/book-parking")
              }
            >
              Book Parking
            </Button>

          </div>
        )}

      </section>

    </div>
  );
}


export default UserDashboard;