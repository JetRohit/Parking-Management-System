import { useEffect, useState } from "react";
import apiRequest from "../../services/api";


function EditSlots() {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [conversionOptions, setConversionOptions] = useState([]);

  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [convertingType, setConvertingType] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  useEffect(() => {
    fetchSlots();
  }, []);


  async function fetchSlots() {
    try {
      setLoadingSlots(true);
      setError("");

      const response = await apiRequest("/slots");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load parking slots."
        );
      }

      setSlots(data.slots || []);

    } catch (error) {
      setError(error.message);

    } finally {
      setLoadingSlots(false);
    }
  }


  async function handleSlotSelect(slot) {
    if (slot.status !== "available") {
      return;
    }

    setSelectedSlot(slot);
    setConversionOptions([]);
    setError("");
    setSuccess("");
    setLoadingOptions(true);

    try {
      const response = await apiRequest(
        `/slot-management/${slot.id}/conversion-options`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to load conversion options."
        );
      }

      setConversionOptions(
        data.conversion_options || []
      );

    } catch (error) {
      setError(error.message);

    } finally {
      setLoadingOptions(false);
    }
  }


  async function handleConvert(option) {
    if (!selectedSlot) {
      return;
    }

    const confirmed = window.confirm(
      `Convert ${selectedSlot.slot_number} to ${option.target_type}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setConvertingType(option.target_type);
      setError("");
      setSuccess("");

      const response = await apiRequest(
        "/slot-management/convert",
        {
          method: "POST",
          body: JSON.stringify({
            slot_id: selectedSlot.id,
            target_type: option.target_type,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to convert parking slot."
        );
      }

      const createdSlotNumbers = (
        data.created_slots || []
      )
        .map((slot) => slot.slot_number)
        .join(", ");

      setSuccess(
        createdSlotNumbers
          ? `Conversion completed successfully. New slot(s): ${createdSlotNumbers}.`
          : "Conversion completed successfully."
      );

      setSelectedSlot(null);
      setConversionOptions([]);

      await fetchSlots();

    } catch (error) {
      setError(error.message);

    } finally {
      setConvertingType(null);
    }
  }


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
      <div className="slots-grid">
        {slotList.map((slot) => {
          const isAvailable =
            slot.status === "available";

          const isSelected =
            selectedSlot?.id === slot.id;

          return (
            <button
              type="button"
              key={slot.id}
              className={`parking-slot ${
                isSelected ? "selected-slot" : ""
              }`}
              disabled={
                !isAvailable ||
                convertingType !== null
              }
              onClick={() => handleSlotSelect(slot)}
            >
              <span>{slot.slot_number}</span>

              <small>
                {isAvailable
                  ? "Available"
                  : "Occupied"}
              </small>
            </button>
          );
        })}
      </div>
    );
  }


  function getSourceSlotNames(option) {
    return (option.source_slots || [])
      .map((slot) => slot.slot_number)
      .join(", ");
  }


  return (
    <div>
      <div className="page-header">
        <h1>Edit / Add Slots</h1>

        <p>
          Select an available parking slot to view
          valid conversion options.
        </p>
      </div>


      {error && (
        <p className="form-error">
          {error}
        </p>
      )}


      {success && (
        <p
          style={{
            padding: "12px 16px",
            marginBottom: "20px",
            background: "#ecfdf5",
            borderRadius: "8px",
          }}
        >
          {success}
        </p>
      )}


      {loadingSlots ? (
        <p>Loading parking slots...</p>
      ) : (
        <div className="slot-management">

          <section className="management-section">
            <h2>Bike Slots</h2>

            <p>
              Select an available Bike slot.
            </p>

            {renderSlots(bikeSlots)}
          </section>


          <section className="management-section">
            <h2>Car Slots</h2>

            <p>
              Select an available Car slot.
            </p>

            {renderSlots(carSlots)}
          </section>


          <section className="management-section">
            <h2>Minivan Slots</h2>

            <p>
              Select an available Minivan slot.
            </p>

            {renderSlots(minivanSlots)}
          </section>

        </div>
      )}


      {selectedSlot && (
        <div
          style={{
            marginTop: "32px",
            padding: "24px",
            background: "#ffffff",
            borderRadius: "12px",
          }}
        >
          <h2>
            Conversion Options for{" "}
            {selectedSlot.slot_number}
          </h2>

          <p>
            Current type:{" "}
            <strong>
              {selectedSlot.slot_type}
            </strong>
          </p>


          {loadingOptions && (
            <p>
              Checking available physical space...
            </p>
          )}


          {!loadingOptions &&
            conversionOptions.length === 0 && (
              <p className="management-note">
                No valid conversion is currently
                available for this slot.
              </p>
            )}


          {!loadingOptions &&
            conversionOptions.map((option) => (
              <div
                key={option.target_type}
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                }}
              >
                <h3>
                  Convert to {option.target_type}
                </h3>


                <p>
                  Conversion type:{" "}
                  <strong>
                    {option.conversion_mode === "combine"
                      ? "Combine slots"
                      : "Split slot"}
                  </strong>
                </p>


                <p>
                  Target slot size:{" "}
                  <strong>
                    {option.required_width} m ×{" "}
                    {option.required_length} m
                  </strong>
                </p>


                <p>
                  Source slot(s):{" "}
                  <strong>
                    {getSourceSlotNames(option)}
                  </strong>
                </p>


                <p>
                  New slots created:{" "}
                  <strong>
                    {option.resulting_slot_count}
                  </strong>
                </p>


                <button
                  type="button"
                  disabled={
                    convertingType !== null
                  }
                  onClick={() =>
                    handleConvert(option)
                  }
                >
                  {convertingType ===
                  option.target_type
                    ? "Converting..."
                    : `Convert to ${option.target_type}`}
                </button>
              </div>
            ))}
        </div>
      )}


      <p className="management-note">
        Occupied parking spaces cannot be used
        for slot conversion.
      </p>
    </div>
  );
}


export default EditSlots;