import { useState } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import apiRequest from "../../services/api";

function VehicleExit() {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cleanedVehicleNumber = vehicleNumber.trim().toUpperCase();
  const isVehicleNumberValid = cleanedVehicleNumber.length === 10;

  function clearResults() {
    setPreview(null);
    setMessage("");
    setError("");
  }

  async function parseResponse(response) {
    const data = await response.json();

    if (!response.ok) {
      const detail = data.detail;
      throw new Error(
        typeof detail === "string" ? detail : "Request failed."
      );
    }

    return data;
  }

  async function handlePreview(event) {
    event.preventDefault();

    if (!isVehicleNumberValid || loading || confirming) return;

    clearResults();
    setLoading(true);

    try {
      const response = await apiRequest("/vehicle-exit/preview", {
        method: "POST",
        body: JSON.stringify({
          vehicle_number: cleanedVehicleNumber,
        }),
      });

      setPreview(await parseResponse(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCashPayment() {
    if (!preview || confirming || loading) return;

    setError("");
    setMessage("");
    setConfirming(true);

    try {
      const response = await apiRequest("/vehicle-exit", {
        method: "POST",
        body: JSON.stringify({
          vehicle_number: preview.vehicle_number,
          cash_received: true,
        }),
      });

      await parseResponse(response);

      setMessage("Payment Successful");
      setPreview(null);
      setVehicleNumber("");
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setConfirming(false);
    }
  }

  function displayTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div>
      <div className="page-header centered-form-header">
        <h1>Vehicle Exit</h1>
        <p>
          Calculate parking charges and collect cash before
          releasing the slot.
        </p>
      </div>

      <form className="content-form" onSubmit={handlePreview}>
        <Input
          label="Vehicle Registration Number"
          name="exitVehicleNumber"
          value={vehicleNumber}
          onChange={(event) => {
            setVehicleNumber(
              event.target.value.toUpperCase().slice(0, 10)
            );
            clearResults();
          }}
          placeholder="Example: TS09AB1234"
          autoComplete="off"
          required
        />

        {vehicleNumber !== "" && !isVehicleNumberValid && (
          <p className="password-error">
            Vehicle registration number must be exactly
            10 characters.
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        {message && <p className="form-success">{message}</p>}

        <Button
          type="submit"
          disabled={
            !isVehicleNumberValid || loading || confirming
          }
        >
          {loading
            ? "Calculating..."
            : "Calculate Parking Charge"}
        </Button>
      </form>

      {preview && (
        <div
          className="content-form"
          style={{ marginTop: "20px" }}
        >
          <h2>Cash Payment Details</h2>

          <p>
            <strong>Vehicle:</strong> {preview.vehicle_number}
          </p>

          <p>
            <strong>Vehicle Type:</strong> {preview.vehicle_type}
          </p>

          <p>
            <strong>Parking Slot:</strong> {preview.slot_number}
          </p>

          <p>
            <strong>Entry Time:</strong>{" "}
            {displayTime(preview.entry_time)}
          </p>

          <p>
            <strong>Charge Calculated At:</strong>{" "}
            {displayTime(preview.calculated_at)}
          </p>

          <p>
            <strong>Duration:</strong>{" "}
            {preview.duration_minutes} minutes
          </p>

          <p>
            <strong>Payment Method:</strong> CASH
          </p>

          <p>
            <strong>Amount Due:</strong>{" "}
            ₹{Number(preview.amount).toFixed(2)}
          </p>

          <p>
            Charges may increase if the next half-hour
            billing period begins before confirmation.
          </p>

          <Button
            type="button"
            onClick={handleCashPayment}
            disabled={confirming || loading}
          >
            {confirming
              ? "Confirming Payment..."
              : "Confirm Cash Received & Register Exit"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default VehicleExit;