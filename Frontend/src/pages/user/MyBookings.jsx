import { useEffect, useState } from "react";
import Button from "../../components/common/Button";
import apiRequest from "../../services/api";


function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cancellingId, setCancellingId] =
    useState(null);

  const [extendingBookingId, setExtendingBookingId] =
    useState(null);

  const [extensionHours, setExtensionHours] =
    useState("");

  const [customExtensionHours, setCustomExtensionHours] =
    useState("");

  const [extending, setExtending] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  useEffect(() => {
    fetchBookings();
  }, []);


  // ========================================
  // FETCH BOOKINGS
  // ========================================

  async function fetchBookings() {
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
            "Unable to load bookings."
        );
      }

      setBookings(data.bookings || []);

    } catch (error) {
      setError(error.message);

    } finally {
      setLoading(false);
    }
  }


  // ========================================
  // CANCEL BOOKING
  // ========================================

  async function handleCancel(bookingId) {
    setError("");
    setSuccess("");
    setCancellingId(bookingId);

    try {
      const response = await apiRequest(
        `/bookings/${bookingId}/cancel`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to cancel booking."
        );
      }

      setSuccess(
        "Booking cancelled successfully."
      );

      await fetchBookings();

    } catch (error) {
      setError(error.message);

    } finally {
      setCancellingId(null);
    }
  }


  // ========================================
  // OPEN EXTENSION PANEL
  // ========================================

  function openExtension(bookingId) {
    setExtendingBookingId(bookingId);
    setExtensionHours("");
    setCustomExtensionHours("");
    setError("");
    setSuccess("");
  }


  // ========================================
  // CLOSE EXTENSION PANEL
  // ========================================

  function closeExtension() {
    setExtendingBookingId(null);
    setExtensionHours("");
    setCustomExtensionHours("");
    setError("");
  }


  // ========================================
  // GET FINAL EXTENSION HOURS
  // ========================================

  function getFinalExtensionHours() {
    if (extensionHours === "") {
      return 0;
    }

    if (extensionHours === "custom") {
      return Number(
        customExtensionHours || 0
      );
    }

    return Number(extensionHours);
  }


  // ========================================
  // CALCULATE NEW END TIME
  // ========================================

  function getExtendedEndTime(booking) {
    const hours = getFinalExtensionHours();

    if (
      !booking ||
      hours <= 0
    ) {
      return null;
    }

    const currentEnd =
      new Date(booking.booking_end);

    return new Date(
      currentEnd.getTime() +
        hours * 60 * 60 * 1000
    );
  }


  // ========================================
  // EXTEND BOOKING
  // ========================================

  async function handleExtend(booking) {
    const hours =
      getFinalExtensionHours();

    if (hours <= 0 || extending) {
      return;
    }

    setError("");
    setSuccess("");
    setExtending(true);

    try {
      const response = await apiRequest(
        `/bookings/${booking.id}/extend`,
        {
          method: "POST",

          body: JSON.stringify({
            extension_hours: hours,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to extend booking."
        );
      }

      setSuccess(
        `Booking for slot ${booking.slot_number} extended successfully.`
      );

      setExtendingBookingId(null);
      setExtensionHours("");
      setCustomExtensionHours("");

      await fetchBookings();

    } catch (error) {
      setError(error.message);

    } finally {
      setExtending(false);
    }
  }


  // ========================================
  // FORMAT DATE/TIME
  // ========================================

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    );
  }


  return (
    <div>

      <div className="page-header">

        <h1>My Bookings</h1>

        <p>
          View and manage your parking bookings.
        </p>

      </div>


      {error && (
        <p className="form-error">
          {error}
        </p>
      )}


      {success && (
        <p className="form-success">
          {success}
        </p>
      )}


      {loading ? (

        <p>Loading bookings...</p>

      ) : bookings.length === 0 ? (

        <section className="management-section">

          <p className="management-note">
            No current bookings.
          </p>

        </section>

      ) : (

        <div>

          {bookings.map((booking) => {

            const extensionOpen =
              extendingBookingId ===
              booking.id;

            const newEndTime =
              extensionOpen
                ? getExtendedEndTime(
                    booking
                  )
                : null;

            const canExtend =
              booking.status === "booked" ||
              booking.status === "checked_in";


            return (
              <section
                className="management-section"
                key={booking.id}
                style={{
                  marginBottom: "20px",
                }}
              >

                <h2>
                  Slot {booking.slot_number}
                </h2>


                <p>
                  Vehicle Number:{" "}

                  <strong>
                    {booking.vehicle_number}
                  </strong>
                </p>


                <p>
                  Vehicle Type:{" "}

                  <strong>
                    {booking.vehicle_type}
                  </strong>
                </p>


                <p>
                  Start:{" "}

                  <strong>
                    {formatDateTime(
                      booking.booking_start
                    )}
                  </strong>
                </p>


                <p>
                  End:{" "}

                  <strong>
                    {formatDateTime(
                      booking.booking_end
                    )}
                  </strong>
                </p>


                <p>
                  Status:{" "}

                  <strong>
                    {booking.status}
                  </strong>
                </p>


                {/* =================================
                    BOOKING ACTIONS
                ================================= */}

                <div className="booking-actions">

                  {booking.status === "booked" && (
                    <Button
                      type="button"
                      disabled={
                        cancellingId ===
                        booking.id
                      }
                      onClick={() =>
                        handleCancel(
                          booking.id
                        )
                      }
                    >
                      {cancellingId ===
                      booking.id
                        ? "Cancelling..."
                        : "Cancel Booking"}
                    </Button>
                  )}


                  {canExtend &&
                    !extensionOpen && (
                      <Button
                        type="button"
                        onClick={() =>
                          openExtension(
                            booking.id
                          )
                        }
                      >
                        Extend Booking
                      </Button>
                    )}

                </div>


                {/* =================================
                    EXTENSION PANEL
                ================================= */}

                {extensionOpen && (
                  <div className="booking-extension">

                    <h3>
                      Extend Booking
                    </h3>


                    <p>
                      Current End:{" "}

                      <strong>
                        {formatDateTime(
                          booking.booking_end
                        )}
                      </strong>
                    </p>


                    <div className="duration-options">

                      {["1", "2", "3"].map(
                        (hours) => (
                          <button
                            key={hours}
                            type="button"
                            className={
                              extensionHours ===
                              hours
                                ? "duration-button duration-button-active"
                                : "duration-button"
                            }
                            onClick={() => {
                              setExtensionHours(
                                hours
                              );

                              setCustomExtensionHours(
                                ""
                              );

                              setError("");
                            }}
                          >
                            +{hours}{" "}
                            {hours === "1"
                              ? "Hour"
                              : "Hours"}
                          </button>
                        )
                      )}


                      <button
                        type="button"
                        className={
                          extensionHours ===
                          "custom"
                            ? "duration-button duration-button-active"
                            : "duration-button"
                        }
                        onClick={() => {
                          setExtensionHours(
                            "custom"
                          );

                          setError("");
                        }}
                      >
                        Custom
                      </button>

                    </div>


                    {extensionHours ===
                      "custom" && (
                      <div className="form-group">

                        <label
                          className="form-label"
                          htmlFor={`custom-extension-${booking.id}`}
                        >
                          Extension Hours
                        </label>

                        <input
                          id={`custom-extension-${booking.id}`}
                          type="number"
                          className="form-input"
                          min="0.25"
                          step="0.25"
                          placeholder="Example: 1.5"
                          value={
                            customExtensionHours
                          }
                          onChange={(event) => {
                            setCustomExtensionHours(
                              event.target.value
                            );

                            setError("");
                          }}
                        />

                      </div>
                    )}


                    {newEndTime && (
                      <div className="parking-time-summary">

                        <span>
                          New End Time
                        </span>

                        <strong>
                          {formatDateTime(
                            newEndTime
                          )}
                        </strong>

                      </div>
                    )}


                    <div className="booking-actions">

                      <Button
                        type="button"
                        disabled={
                          getFinalExtensionHours() <=
                            0 ||
                          extending
                        }
                        onClick={() =>
                          handleExtend(
                            booking
                          )
                        }
                      >
                        {extending
                          ? "Checking..."
                          : "Confirm Extension"}
                      </Button>


                      <Button
                        type="button"
                        disabled={extending}
                        onClick={
                          closeExtension
                        }
                      >
                        Close
                      </Button>

                    </div>

                  </div>
                )}

              </section>
            );
          })}

        </div>

      )}

    </div>
  );
}


export default MyBookings;