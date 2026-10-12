
import { useMemo, useState } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import apiRequest from "../../services/api";

const MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0")
);

function VehicleEntry() {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  const [entryDate, setEntryDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [startMinute, setStartMinute] = useState("00");
  const [startPeriod, setStartPeriod] = useState("AM");

  const [duration, setDuration] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("0");

  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  const [availabilityChecked, setAvailabilityChecked] =
    useState(false);

  const [checkingAvailability, setCheckingAvailability] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const cleanedVehicleNumber =
    vehicleNumber.trim().toUpperCase();

  const isVehicleNumberValid =
    cleanedVehicleNumber.length === 10;

  // DATE HELPERS

  const today = useMemo(() => {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  // DURATION

  function getDurationMinutes() {
    if (duration === "") {
      return 0;
    }

    if (duration !== "custom") {
      return Number(duration) * 60;
    }

    const hours = Number(customHours || 0);
    const minutes = Number(customMinutes || 0);

    return hours * 60 + minutes;
  }

  // ENTRY DATE/TIME

  function getEntryDateTime() {
    if (
      !entryDate ||
      !startHour ||
      !startMinute ||
      !startPeriod
    ) {
      return null;
    }

    let hour = Number(startHour);

    if (startPeriod === "AM" && hour === 12) {
      hour = 0;
    }

    if (startPeriod === "PM" && hour !== 12) {
      hour += 12;
    }

    const [year, month, day] =
      entryDate.split("-").map(Number);

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

  // EXPECTED EXIT DATE/TIME

  function getExpectedExitDateTime() {
    const entry = getEntryDateTime();
    const durationMinutes = getDurationMinutes();

    if (!entry || durationMinutes <= 0) {
      return null;
    }

    return new Date(
      entry.getTime() +
      durationMinutes * 60 * 1000
    );
  }

  const entryDateTime = getEntryDateTime();

  const expectedExitDateTime =
    getExpectedExitDateTime();

  // FORMAT FOR BACKEND

  function formatForBackend(date) {
    if (!date) {
      return "";
    }

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const hour = String(
      date.getHours()
    ).padStart(2, "0");

    const minute = String(
      date.getMinutes()
    ).padStart(2, "0");

    const second = String(
      date.getSeconds()
    ).padStart(2, "0");

    return (
      `${year}-${month}-${day}` +
      `T${hour}:${minute}:${second}`
    );
  }

  // DISPLAY DATE/TIME

  function formatDisplayDateTime(date) {
    if (!date) {
      return "";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // RESET AVAILABILITY

  function resetAvailability() {
    setSlots([]);
    setSelectedSlotId(null);
    setAvailabilityChecked(false);
    setMessage("");
    setError("");
  }

  // FORM VALIDATION

  const durationMinutes = getDurationMinutes();

  const isTimeValid =
    entryDateTime !== null &&
    expectedExitDateTime !== null &&
    expectedExitDateTime > entryDateTime;

  const canCheckAvailability =
    isVehicleNumberValid &&
    vehicleType !== "" &&
    isTimeValid;

  // CHECK AVAILABLE SLOTS

  async function handleCheckAvailability(event) {
    event.preventDefault();

    if (
      !canCheckAvailability ||
      checkingAvailability
    ) {
      return;
    }

    setError("");
    setMessage("");
    setSelectedSlotId(null);
    setCheckingAvailability(true);

    try {
      const response = await apiRequest(
        "/vehicle-entry/available-slots",
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_number: cleanedVehicleNumber,
            vehicle_type: vehicleType,
            entry_time:
              formatForBackend(entryDateTime),
            expected_exit_time:
              formatForBackend(expectedExitDateTime),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to check parking availability."
        );
      }

      setSlots(data.slots || []);
      setAvailabilityChecked(true);

      if (
        data.entry_type === "booking" &&
        data.slots?.length === 1 &&
        data.slots[0].availability === "available"
      ) {
        setSelectedSlotId(data.slots[0].id);
      }
    } catch (error) {
      setSlots([]);
      setAvailabilityChecked(false);
      setError(error.message);
    } finally {
      setCheckingAvailability(false);
    }
  }

  // REGISTER VEHICLE ENTRY

  async function handleVehicleEntry() {
    if (
      !canCheckAvailability ||
      selectedSlotId === null ||
      submitting
    ) {
      return;
    }

    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await apiRequest(
        "/vehicle-entry",
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_number: cleanedVehicleNumber,
            vehicle_type: vehicleType,
            slot_id: selectedSlotId,
            entry_time:
              formatForBackend(entryDateTime),
            expected_exit_time:
              formatForBackend(expectedExitDateTime),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Vehicle entry failed."
        );
      }

      setMessage(
        `${data.message}. Slot: ${data.slot_number}`
      );

      setVehicleNumber("");
      setVehicleType("");

      setEntryDate("");
      setStartHour("");
      setStartMinute("00");
      setStartPeriod("AM");

      setDuration("");
      setCustomHours("");
      setCustomMinutes("0");

      setSlots([]);
      setSelectedSlotId(null);
      setAvailabilityChecked(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // AVAILABLE SLOT COUNT

  const availableSlotCount = slots.filter(
    (slot) => slot.availability === "available"
  ).length;

  return (
    <div>
      <div className="page-header centered-form-header">
        <h1>Vehicle Entry</h1>

        <p>
          Register a vehicle entering the parking area.
        </p>
      </div>

      <form
        className="content-form"
        onSubmit={handleCheckAvailability}
      >
        {/* VEHICLE NUMBER */}

        <Input
          label="Vehicle Registration Number"
          name="vehicleNumber"
          value={vehicleNumber}
          onChange={(event) => {
            setVehicleNumber(
              event.target.value
                .toUpperCase()
                .slice(0, 10)
            );

            resetAvailability();
          }}
          placeholder="Example: TS09AB1234"
          autoComplete="off"
          required
        />

        {vehicleNumber !== "" &&
          !isVehicleNumberValid && (
            <p className="password-error">
              Vehicle registration number must be
              exactly 10 characters.
            </p>
          )}

        {/* VEHICLE TYPE */}

        <div className="form-group">
          <label
            className="form-label"
            htmlFor="vehicleType"
          >
            Vehicle Type
          </label>

          <select
            id="vehicleType"
            name="vehicleType"
            className="form-input"
            value={vehicleType}
            onChange={(event) => {
              setVehicleType(event.target.value);
              resetAvailability();
            }}
            required
          >
            <option value="">
              Select vehicle type
            </option>

            <option value="Bike">
              Bike
            </option>

            <option value="Car">
              Car
            </option>

            <option value="Minivan">
              Minivan
            </option>
          </select>
        </div>

        {/* ENTRY DATE */}

        <div className="form-group">
          <label
            className="form-label"
            htmlFor="entryDate"
          >
            Entry Date
          </label>

          <input
            id="entryDate"
            type="date"
            className="form-input"
            value={entryDate}
            min={today}
            onChange={(event) => {
              setEntryDate(event.target.value);
              resetAvailability();
            }}
            required
          />
        </div>

        {/* START TIME */}

        <div className="form-group">
          <label className="form-label">
            Entry Time
          </label>

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
              <option value="">
                Hour
              </option>

              {Array.from(
                { length: 12 },
                (_, index) => index + 1
              ).map((hour) => (
                <option
                  key={hour}
                  value={hour}
                >
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
                <option
                  key={minute}
                  value={minute}
                >
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

        {/* DURATION */}

        <div className="form-group">
          <label className="form-label">
            Expected Parking Duration
          </label>

          <div className="duration-options">
            {["1", "2", "3", "4"].map(
              (hours) => (
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
                  {hours}{" "}
                  {hours === "1"
                    ? "Hour"
                    : "Hours"}
                </button>
              )
            )}

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

        {/* CUSTOM DURATION */}

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
                  setCustomHours(
                    event.target.value
                  );

                  resetAvailability();
                }}
              />

              <select
                className="form-input"
                value={customMinutes}
                onChange={(event) => {
                  setCustomMinutes(
                    event.target.value
                  );

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

        {/* EXPECTED EXIT */}

        {expectedExitDateTime && (
          <div className="parking-time-summary">
            <span>
              Expected Exit
            </span>

            <strong>
              {formatDisplayDateTime(
                expectedExitDateTime
              )}
            </strong>
          </div>
        )}

        {duration !== "" &&
          durationMinutes <= 0 && (
            <p className="form-error">
              Parking duration must be greater
              than 0 minutes.
            </p>
          )}

        {/* ERRORS */}

        {error && (
          <p className="form-error">
            {error}
          </p>
        )}

        {message && (
          <p className="form-success">
            {message}
          </p>
        )}

        {/* CHECK AVAILABILITY */}

        <Button
          type="submit"
          disabled={
            !canCheckAvailability ||
            checkingAvailability
          }
        >
          {checkingAvailability
            ? "Checking..."
            : "Check Available Slots"}
        </Button>
      </form>

      {/* SLOT SELECTION */}

      {availabilityChecked && (
        <div className="vehicle-entry-slots">
          <div className="page-header">
            <h2>Select Parking Slot</h2>

            <p>
              {availableSlotCount} available{" "}
              {vehicleType.toLowerCase()}{" "}
              {availableSlotCount === 1
                ? "slot"
                : "slots"}{" "}
              for the selected period.
            </p>
          </div>

          <div className="booking-slots-grid">
            {slots.map((slot) => {
              const isAvailable =
                slot.availability ===
                "available";

              const isSelected =
                selectedSlotId === slot.id;

              return (
                <button
                  key={slot.id}
                  type="button"
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
                      setSelectedSlotId(
                        slot.id
                      );

                      setMessage("");
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
              Available
            </div>

            <div className="slot-legend-item">
              <span className="slot-legend-dot slot-legend-occupied" />
              Unavailable
            </div>
          </div>

          {availableSlotCount === 0 && (
            <p className="form-error">
              No parking slots are available
              for the selected period.
            </p>
          )}

          {selectedSlotId !== null && (
            <div className="booking-confirm">
              <p>
                Selected Slot:{" "}
                <strong>
                  {
                    slots.find(
                      (slot) =>
                        slot.id ===
                        selectedSlotId
                    )?.slot_number
                  }
                </strong>
              </p>

              <Button
                type="button"
                disabled={submitting}
                onClick={handleVehicleEntry}
              >
                {submitting
                  ? "Registering..."
                  : "Register Vehicle Entry"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VehicleEntry;
