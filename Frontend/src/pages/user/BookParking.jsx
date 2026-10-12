
import { useMemo, useState } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import apiRequest from "../../services/api";

const PARKING_RATES = {
  Bike: { firstHour: 20, extraHalfHour: 10 },
  Car: { firstHour: 50, extraHalfHour: 25 },
  Minivan: { firstHour: 70, extraHalfHour: 35 },
};

const RATE_DETAILS = [
  { type: "Bike", symbol: "🏍", background: "#eff6ff" },
  { type: "Car", symbol: "🚗", background: "#ecfdf5" },
  { type: "Minivan", symbol: "🚐", background: "#f5f3ff" },
];

const MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0")
);

function BookParking() {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("Car");
  const [bookingDate, setBookingDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("00");
  const [startPeriod, setStartPeriod] = useState("AM");

  const [duration, setDuration] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("0");

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase();
  const isVehicleNumberValid = normalizedVehicleNumber.length === 10;

  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  function resetAvailability() {
    setSlots([]);
    setSelectedSlot(null);
    setAvailabilityChecked(false);
    setError("");
    setSuccess("");
  }

  function handleVehicleNumberChange(event) {
    setVehicleNumber(event.target.value.toUpperCase().slice(0, 10));
    resetAvailability();
  }

  function getDurationMinutes() {
    if (duration === "") return 0;

    if (duration !== "custom") {
      return Number(duration) * 60;
    }

    const hours = Number(customHours || 0);
    const minutes = Number(customMinutes || 0);
    return hours * 60 + minutes;
  }

  function getBookingStartDateTime() {
    if (!bookingDate || !startHour || !startMinute || !startPeriod) {
      return null;
    }

    let hour = Number(startHour);

    if (startPeriod === "AM" && hour === 12) hour = 0;
    if (startPeriod === "PM" && hour !== 12) hour += 12;

    const [year, month, day] = bookingDate.split("-").map(Number);

    return new Date(
      year,
      month - 1,
      day,
      hour,
      Number(startMinute),
      0,
      0
    );
  }

  function getBookingEndDateTime() {
    const bookingStart = getBookingStartDateTime();
    const minutes = getDurationMinutes();

    if (!bookingStart || minutes <= 0) return null;

    return new Date(bookingStart.getTime() + minutes * 60000);
  }

  const bookingStartDateTime = getBookingStartDateTime();
  const bookingEndDateTime = getBookingEndDateTime();
  const durationMinutes = getDurationMinutes();

  // Display-only estimate. The backend calculates the final exit charge.
  const estimatedCharge = useMemo(() => {
    if (durationMinutes <= 0) return null;

    const rate = PARKING_RATES[vehicleType];
    if (!rate) return null;

    const extraMinutes = Math.max(0, durationMinutes - 60);
    const extraBlocks = Math.ceil(extraMinutes / 30);

    return rate.firstHour + extraBlocks * rate.extraHalfHour;
  }, [durationMinutes, vehicleType]);

  function formatForBackend(date) {
    if (!date) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  function formatDisplayDateTime(date) {
    if (!date) return "";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const isTimeValid =
    bookingStartDateTime !== null &&
    bookingEndDateTime !== null &&
    bookingEndDateTime > bookingStartDateTime;

  const isSearchValid =
    isVehicleNumberValid && vehicleType !== "" && isTimeValid;

  async function handleCheckAvailability(event) {
    event.preventDefault();

    if (!isSearchValid || checkingAvailability) return;

    setError("");
    setSuccess("");
    setSlots([]);
    setSelectedSlot(null);
    setAvailabilityChecked(false);
    setCheckingAvailability(true);

    try {
      const response = await apiRequest("/bookings/available-slots", {
        method: "POST",
        body: JSON.stringify({
          vehicle_type: vehicleType,
          booking_start: formatForBackend(bookingStartDateTime),
          booking_end: formatForBackend(bookingEndDateTime),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to check slot availability."
        );
      }

      setSlots(data.slots || []);
      setAvailabilityChecked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleBooking() {
    if (!selectedSlot || booking) return;

    setError("");
    setSuccess("");
    setBooking(true);

    try {
      const response = await apiRequest("/bookings", {
        method: "POST",
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          vehicle_number: normalizedVehicleNumber,
          vehicle_type: vehicleType,
          booking_start: formatForBackend(bookingStartDateTime),
          booking_end: formatForBackend(bookingEndDateTime),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to create booking.");
      }

      setSuccess(
        `Booking confirmed. Your parking slot is ${data.slot_number}.`
      );

      setSlots((currentSlots) =>
        currentSlots.map((slot) =>
          slot.id === selectedSlot.id
            ? { ...slot, availability: "occupied" }
            : slot
        )
      );

      setSelectedSlot(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  }

  const availableSlotCount = slots.filter(
    (slot) => slot.availability === "available"
  ).length;

  return (
    <div>
      <style>{`
        .booking-rates-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
          gap: 24px;
          align-items: start;
        }

        .booking-rates-layout > * {
          min-width: 0;
        }

        .booking-rates-layout .auth-form {
          width: 100%;
          max-width: none;
        }

        .booking-rates-panel {
          padding: 24px;
          background: #f8fbff;
          border-radius: 16px;
          border: 1px solid #e8eef7;
        }

        .booking-rates-panel h2 {
          margin: 0 0 20px;
          font-size: 21px;
          color: #10203b;
        }

        .booking-rate-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px;
          border-radius: 13px;
          margin-bottom: 14px;
        }

        .booking-rate-icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 25px;
          background: #ffffffb8;
          border-radius: 50%;
        }

        .booking-rate-info {
          flex: 1;
          min-width: 0;
        }

        .booking-rate-info h3 {
          font-size: 17px;
          margin: 0 0 10px;
          color: #152238;
        }

        .booking-rate-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          margin-top: 8px;
          color: #334155;
        }

        .booking-rate-line strong {
          color: #111827;
          white-space: nowrap;
        }

        .booking-rates-notice {
          margin-top: 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #fff6e5;
          border-radius: 12px;
          color: #6b4808;
          font-size: 14px;
          line-height: 1.6;
        }

        .booking-rates-notice span:first-child {
          font-size: 20px;
          line-height: 1.2;
        }

        .booking-estimate {
          margin-top: 16px;
          padding: 17px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #dce7f7;
        }

        .booking-estimate-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .booking-estimate-row strong {
          color: #2563eb;
          font-size: 24px;
        }

        .booking-estimate p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 1050px) {
          .booking-rates-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page-header">
        <h1>Book Parking</h1>
        <p>
          Select your vehicle and booking time to find a parking slot.
        </p>
      </div>

      <section className="management-section">
        <div className="booking-rates-layout">
          <div>
            <h2>Booking Details</h2>

            <form
              className="auth-form"
              onSubmit={handleCheckAvailability}
            >
              <Input
                label="Vehicle Number"
                name="vehicleNumber"
                value={vehicleNumber}
                onChange={handleVehicleNumberChange}
                placeholder="TS09AB1234"
                maxLength={10}
                required
              />

              {vehicleNumber.length > 0 &&
                !isVehicleNumberValid && (
                  <p className="form-error">
                    Vehicle number must be exactly 10 characters.
                  </p>
                )}

              <div className="form-group">
                <label className="form-label" htmlFor="vehicleType">
                  Vehicle Type
                </label>

                <select
                  id="vehicleType"
                  className="form-input"
                  value={vehicleType}
                  onChange={(event) => {
                    setVehicleType(event.target.value);
                    resetAvailability();
                  }}
                >
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="Minivan">Minivan</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bookingDate">
                  Booking Date
                </label>

                <input
                  id="bookingDate"
                  name="bookingDate"
                  type="date"
                  className="form-input"
                  value={bookingDate}
                  min={today}
                  onChange={(event) => {
                    setBookingDate(event.target.value);
                    resetAvailability();
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Time</label>

                <div className="parking-time-row">
                  <select
                    className="form-input"
                    value={startHour}
                    onChange={(event) => {
                      setStartHour(event.target.value);
                      resetAvailability();
                    }}
                    required
                  >
                    <option value="">Hour</option>
                    {Array.from(
                      { length: 12 },
                      (_, index) => index + 1
                    ).map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-input"
                    value={startMinute}
                    onChange={(event) => {
                      setStartMinute(event.target.value);
                      resetAvailability();
                    }}
                  >
                    {MINUTES.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-input"
                    value={startPeriod}
                    onChange={(event) => {
                      setStartPeriod(event.target.value);
                      resetAvailability();
                    }}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Parking Duration
                </label>

                <div className="duration-options">
                  {["1", "2", "3", "4"].map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      className={
                        duration === hours
                          ? "duration-button duration-button-active"
                          : "duration-button"
                      }
                      onClick={() => {
                        setDuration(hours);
                        setCustomHours("");
                        setCustomMinutes("0");
                        resetAvailability();
                      }}
                    >
                      {hours} {hours === "1" ? "Hour" : "Hours"}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={
                      duration === "custom"
                        ? "duration-button duration-button-active"
                        : "duration-button"
                    }
                    onClick={() => {
                      setDuration("custom");
                      resetAvailability();
                    }}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {duration === "custom" && (
                <div className="form-group">
                  <label className="form-label">
                    Custom Duration
                  </label>

                  <div className="parking-time-row">
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      placeholder="Hours"
                      value={customHours}
                      onChange={(event) => {
                        setCustomHours(event.target.value);
                        resetAvailability();
                      }}
                    />

                    <select
                      className="form-input"
                      value={customMinutes}
                      onChange={(event) => {
                        setCustomMinutes(event.target.value);
                        resetAvailability();
                      }}
                    >
                      {MINUTES.map((minute) => (
                        <option
                          key={minute}
                          value={Number(minute)}
                        >
                          {Number(minute)} Minutes
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {bookingEndDateTime && (
                <div className="parking-time-summary">
                  <span>Booking Ends</span>
                  <strong>
                    {formatDisplayDateTime(bookingEndDateTime)}
                  </strong>
                </div>
              )}

              {duration !== "" && durationMinutes <= 0 && (
                <p className="form-error">
                  Parking duration must be greater than 0 minutes.
                </p>
              )}

              {error && <p className="form-error">{error}</p>}
              {success && (
                <p className="form-success">{success}</p>
              )}

              <Button
                type="submit"
                disabled={!isSearchValid || checkingAvailability}
              >
                {checkingAvailability
                  ? "Checking..."
                  : "Check Availability"}
              </Button>
            </form>
          </div>

          <aside className="booking-rates-panel">
            <h2>Parking Rates</h2>

            {RATE_DETAILS.map((item) => {
              const rate = PARKING_RATES[item.type];

              return (
                <div
                  key={item.type}
                  className="booking-rate-card"
                  style={{ background: item.background }}
                >
                  <div className="booking-rate-icon">
                    {item.symbol}
                  </div>

                  <div className="booking-rate-info">
                    <h3>{item.type}</h3>

                    <div className="booking-rate-line">
                      <span>First hour</span>
                      <strong>₹{rate.firstHour}</strong>
                    </div>

                    <div className="booking-rate-line">
                      <span>Additional 30 minutes</span>
                      <strong>₹{rate.extraHalfHour}</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="booking-rates-notice">
              <span aria-hidden="true">ⓘ</span>
              <span>
                Additional charges apply if the vehicle stays
                beyond the selected parking duration.
              </span>
            </div>

            {estimatedCharge !== null && (
              <div className="booking-estimate">
                <div className="booking-estimate-row">
                  <span>Estimated Parking Charge</span>
                  <strong>₹{estimatedCharge}</strong>
                </div>
                <p>
                  For {vehicleType}, based on the selected
                  parking duration. Final charges depend on
                  actual parking time.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>

      {availabilityChecked && (
        <section
          className="management-section"
          style={{ marginTop: "24px" }}
        >
          <h2>Parking Slots</h2>

          {slots.length === 0 ? (
            <p className="management-note">
              No parking slots found for this vehicle type.
            </p>
          ) : (
            <>
              <p className="management-note">
                {availableSlotCount} available{" "}
                {vehicleType.toLowerCase()}{" "}
                {availableSlotCount === 1 ? "slot" : "slots"}{" "}
                for the selected period.
              </p>

              <div className="booking-slots-grid">
                {slots.map((slot) => {
                  const isAvailable =
                    slot.availability === "available";

                  const isSelected =
                    selectedSlot?.id === slot.id;

                  return (
                    <button
                      type="button"
                      key={slot.id}
                      disabled={!isAvailable}
                      className={[
                        "booking-slot",
                        isAvailable
                          ? "booking-slot-available"
                          : "booking-slot-occupied",
                        isSelected
                          ? "booking-slot-selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        if (isAvailable) {
                          setSelectedSlot(slot);
                          setError("");
                        }
                      }}
                    >
                      {slot.slot_number}
                    </button>
                  );
                })}
              </div>

              <div className="slot-legend">
                <div className="slot-legend-item">
                  <span className="slot-legend-dot slot-legend-available" />
                  <span>Available</span>
                </div>

                <div className="slot-legend-item">
                  <span className="slot-legend-dot slot-legend-occupied" />
                  <span>Unavailable</span>
                </div>
              </div>

              {availableSlotCount === 0 && (
                <p className="form-error">
                  No parking slots are available for the
                  selected period.
                </p>
              )}

              {selectedSlot && (
                <div className="booking-confirm">
                  <p>
                    Selected slot:{" "}
                    <strong>{selectedSlot.slot_number}</strong>
                  </p>

                  {estimatedCharge !== null && (
                    <p>
                      Estimated charge:{" "}
                      <strong>₹{estimatedCharge}</strong>
                    </p>
                  )}

                  <Button
                    type="button"
                    onClick={handleBooking}
                    disabled={booking}
                  >
                    {booking
                      ? "Confirming..."
                      : "Confirm Booking"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default BookParking;
