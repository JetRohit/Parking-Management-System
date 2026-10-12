from datetime import datetime
from decimal import Decimal
from math import ceil

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_authenticated_user, require_employee
from database import get_database_connection


router = APIRouter()


# ========================================
# REQUEST MODELS
# ========================================

class VehicleEntryAvailabilityRequest(BaseModel):
    vehicle_number: str
    vehicle_type: str
    entry_time: datetime
    expected_exit_time: datetime


class VehicleEntryRequest(BaseModel):
    vehicle_number: str
    vehicle_type: str
    slot_id: int | None = None
    entry_time: datetime
    expected_exit_time: datetime


class VehicleExitRequest(BaseModel):
    vehicle_number: str


class CashPaymentRequest(BaseModel):
    vehicle_number: str
    cash_received: bool = False


# ========================================
# HELPER FUNCTIONS
# ========================================

def normalize_vehicle_number(vehicle_number: str):
    vehicle_number = vehicle_number.strip().upper()

    if len(vehicle_number) != 10:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vehicle registration number must be "
                "exactly 10 characters"
            ),
        )

    return vehicle_number


def normalize_vehicle_type(vehicle_type: str):
    vehicle_type = vehicle_type.strip().title()

    allowed_vehicle_types = [
        "Bike",
        "Car",
        "Minivan",
    ]

    if vehicle_type not in allowed_vehicle_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle type",
        )

    return vehicle_type


def validate_entry_not_in_future(entry_time: datetime):
    """
    Prevent employees from registering future vehicle entries.
    Future customer bookings remain allowed.
    """

    if entry_time.tzinfo is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Entry time must be a local date and time "
                "without a timezone offset"
            ),
        )

    if entry_time > datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Vehicle entry time cannot be in the future",
        )


def validate_parking_period(
    entry_time: datetime,
    expected_exit_time: datetime,
):
    if expected_exit_time <= entry_time:
        raise HTTPException(
            status_code=400,
            detail=(
                "Expected exit date and time must be "
                "after entry date and time"
            ),
        )


# ========================================
# GET PARKING SLOTS
# ========================================

@router.get("/slots")
def get_parking_slots(request: Request):
    get_authenticated_user(request)

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                slot_number,
                slot_type,
                status
            FROM parking_slots
            WHERE is_active = TRUE
            ORDER BY id
            """
        )

        slots = cursor.fetchall()

        return {
            "total_slots": len(slots),
            "slots": slots,
        }

    finally:
        cursor.close()
        connection.close()


# ========================================
# CHECK VEHICLE ENTRY AVAILABILITY
# EMPLOYEE ONLY
# ========================================

@router.post("/vehicle-entry/available-slots")
def get_vehicle_entry_available_slots(
    data: VehicleEntryAvailabilityRequest,
    request: Request,
):
    require_employee(request)

    vehicle_number = normalize_vehicle_number(
        data.vehicle_number
    )

    vehicle_type = normalize_vehicle_type(
        data.vehicle_type
    )

    validate_parking_period(
        data.entry_time,
        data.expected_exit_time,
    )

    validate_entry_not_in_future(data.entry_time)

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # VEHICLE MUST NOT ALREADY BE PARKED

        cursor.execute(
            """
            SELECT id
            FROM parking_records
            WHERE vehicle_number = %s
              AND status = 'parked'
            LIMIT 1
            """,
            (vehicle_number,),
        )

        existing_vehicle = cursor.fetchone()

        if existing_vehicle is not None:
            raise HTTPException(
                status_code=400,
                detail="Vehicle is already parked",
            )

        # CHECK WHETHER VEHICLE HAS AN ACTIVE BOOKING

        cursor.execute(
            """
            SELECT
                b.id AS booking_id,
                b.slot_id,
                b.vehicle_number,
                b.vehicle_type,
                b.booking_start,
                b.booking_end,
                ps.slot_number,
                ps.slot_type,
                ps.status AS slot_status,
                ps.is_active
            FROM bookings b
            JOIN parking_slots ps
                ON b.slot_id = ps.id
            WHERE b.vehicle_number = %s
              AND b.status = 'booked'
              AND b.booking_start <= %s
              AND b.booking_end > %s
            ORDER BY b.booking_start ASC
            LIMIT 1
            """,
            (
                vehicle_number,
                data.entry_time,
                data.entry_time,
            ),
        )

        booking = cursor.fetchone()

        # BOOKED VEHICLE

        if booking is not None:
            if booking["vehicle_type"] != vehicle_type:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vehicle type does not match "
                        "the booking"
                    ),
                )

            if not booking["is_active"]:
                raise HTTPException(
                    status_code=409,
                    detail="Reserved parking slot is inactive",
                )

            if booking["slot_status"] != "available":
                return {
                    "entry_type": "booking",
                    "booking_id": booking["booking_id"],
                    "booking_start": booking["booking_start"],
                    "booking_end": booking["booking_end"],
                    "slots": [
                        {
                            "id": booking["slot_id"],
                            "slot_number": booking["slot_number"],
                            "slot_type": booking["slot_type"],
                            "availability": "occupied",
                            "reserved": True,
                        }
                    ],
                }

            return {
                "entry_type": "booking",
                "booking_id": booking["booking_id"],
                "booking_start": booking["booking_start"],
                "booking_end": booking["booking_end"],
                "slots": [
                    {
                        "id": booking["slot_id"],
                        "slot_number": booking["slot_number"],
                        "slot_type": booking["slot_type"],
                        "availability": "available",
                        "reserved": True,
                    }
                ],
            }

        # WALK-IN AVAILABILITY

        cursor.execute(
            """
            SELECT
                ps.id,
                ps.slot_number,
                ps.slot_type,
                CASE
                    WHEN ps.status = 'occupied'
                    THEN 'occupied'

                    WHEN EXISTS (
                        SELECT 1
                        FROM bookings b
                        WHERE b.slot_id = ps.id
                          AND b.status IN (
                              'booked',
                              'checked_in'
                          )
                          AND b.booking_start < %s
                          AND b.booking_end > %s
                    )
                    THEN 'reserved'

                    WHEN EXISTS (
                        SELECT 1
                        FROM parking_records pr
                        WHERE pr.slot_id = ps.id
                          AND pr.status = 'parked'
                          AND pr.entry_time < %s
                          AND pr.expected_exit_time > %s
                    )
                    THEN 'occupied'

                    ELSE 'available'
                END AS availability

            FROM parking_slots ps

            WHERE ps.slot_type = %s
              AND ps.is_active = TRUE

            ORDER BY ps.id
            """,
            (
                data.expected_exit_time,
                data.entry_time,
                data.expected_exit_time,
                data.entry_time,
                vehicle_type,
            ),
        )

        slots = cursor.fetchall()

        return {
            "entry_type": "walk_in",
            "entry_time": data.entry_time,
            "expected_exit_time": data.expected_exit_time,
            "slots": slots,
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to check parking availability",
        )

    finally:
        cursor.close()
        connection.close()


# ========================================
# VEHICLE ENTRY
# EMPLOYEE ONLY
# ========================================

@router.post("/vehicle-entry")
def vehicle_entry(
    data: VehicleEntryRequest,
    request: Request,
):
    require_employee(request)

    vehicle_number = normalize_vehicle_number(
        data.vehicle_number
    )

    vehicle_type = normalize_vehicle_type(
        data.vehicle_type
    )

    validate_parking_period(
        data.entry_time,
        data.expected_exit_time,
    )

    validate_entry_not_in_future(data.entry_time)

    # Use actual physical check-in time.
    actual_entry_time = datetime.now()

    validate_parking_period(
        actual_entry_time,
        data.expected_exit_time,
    )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # CHECK WHETHER VEHICLE IS ALREADY PARKED

        cursor.execute(
            """
            SELECT id
            FROM parking_records
            WHERE vehicle_number = %s
              AND status = 'parked'
            LIMIT 1
            FOR UPDATE
            """,
            (vehicle_number,),
        )

        existing_vehicle = cursor.fetchone()

        if existing_vehicle is not None:
            raise HTTPException(
                status_code=400,
                detail="Vehicle is already parked",
            )

        # CHECK FOR ACTIVE BOOKING

        cursor.execute(
            """
            SELECT
                b.id AS booking_id,
                b.slot_id,
                b.vehicle_number,
                b.vehicle_type,
                b.booking_start,
                b.booking_end,
                ps.slot_number,
                ps.slot_type,
                ps.status AS slot_status,
                ps.is_active

            FROM bookings b

            JOIN parking_slots ps
                ON b.slot_id = ps.id

            WHERE b.vehicle_number = %s
              AND b.status = 'booked'
              AND b.booking_start <= %s
              AND b.booking_end > %s

            ORDER BY b.booking_start ASC

            LIMIT 1
            FOR UPDATE
            """,
            (
                vehicle_number,
                actual_entry_time,
                actual_entry_time,
            ),
        )

        booking = cursor.fetchone()

        # BOOKED VEHICLE ENTRY

        if booking is not None:
            if booking["vehicle_type"] != vehicle_type:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Vehicle type does not match "
                        "the booking"
                    ),
                )

            if not booking["is_active"]:
                raise HTTPException(
                    status_code=409,
                    detail="Reserved parking slot is inactive",
                )

            if booking["slot_status"] != "available":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Reserved parking slot is "
                        "currently occupied"
                    ),
                )

            expected_exit_time = booking["booking_end"]

            cursor.execute(
                """
                INSERT INTO parking_records
                (
                    vehicle_number,
                    vehicle_type,
                    slot_id,
                    entry_time,
                    expected_exit_time,
                    status
                )
                VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'parked'
                )
                """,
                (
                    vehicle_number,
                    vehicle_type,
                    booking["slot_id"],
                    actual_entry_time,
                    expected_exit_time,
                ),
            )

            cursor.execute(
                """
                UPDATE parking_slots
                SET status = 'occupied'
                WHERE id = %s
                  AND is_active = TRUE
                """,
                (booking["slot_id"],),
            )

            cursor.execute(
                """
                UPDATE bookings
                SET status = 'checked_in'
                WHERE id = %s
                """,
                (booking["booking_id"],),
            )

            connection.commit()

            return {
                "message": (
                    "Booked vehicle checked in successfully"
                ),
                "vehicle_number": vehicle_number,
                "vehicle_type": vehicle_type,
                "slot_number": booking["slot_number"],
                "entry_type": "booking",
                "booking_id": booking["booking_id"],
                "entry_time": actual_entry_time,
                "expected_exit_time": expected_exit_time,
            }

        # WALK-IN VEHICLE

        if data.slot_id is None:
            raise HTTPException(
                status_code=400,
                detail="Please select a parking slot",
            )

        # LOCK SELECTED SLOT

        cursor.execute(
            """
            SELECT
                id,
                slot_number,
                slot_type,
                status,
                is_active
            FROM parking_slots
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (data.slot_id,),
        )

        slot = cursor.fetchone()

        if slot is None:
            raise HTTPException(
                status_code=404,
                detail="Parking slot not found",
            )

        if not slot["is_active"]:
            raise HTTPException(
                status_code=409,
                detail="Selected parking slot is inactive",
            )

        if slot["slot_type"] != vehicle_type:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Selected slot does not match "
                    "the vehicle type"
                ),
            )

        if slot["status"] != "available":
            raise HTTPException(
                status_code=409,
                detail="Selected parking slot is occupied",
            )

        # CHECK ONLINE BOOKING CONFLICT

        cursor.execute(
            """
            SELECT
                id,
                booking_start,
                booking_end
            FROM bookings
            WHERE slot_id = %s
              AND status IN (
                  'booked',
                  'checked_in'
              )
              AND booking_start < %s
              AND booking_end > %s
            LIMIT 1
            FOR UPDATE
            """,
            (
                data.slot_id,
                data.expected_exit_time,
                actual_entry_time,
            ),
        )

        booking_conflict = cursor.fetchone()

        if booking_conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Selected slot is reserved during "
                    "the requested parking period"
                ),
            )

        # CHECK ACTIVE PARKING PERIOD CONFLICT

        cursor.execute(
            """
            SELECT
                id,
                entry_time,
                expected_exit_time
            FROM parking_records
            WHERE slot_id = %s
              AND status = 'parked'
              AND entry_time < %s
              AND expected_exit_time > %s
            LIMIT 1
            FOR UPDATE
            """,
            (
                data.slot_id,
                data.expected_exit_time,
                actual_entry_time,
            ),
        )

        parking_conflict = cursor.fetchone()

        if parking_conflict is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Selected slot is unavailable during "
                    "the requested parking period"
                ),
            )

        # CREATE WALK-IN PARKING RECORD

        cursor.execute(
            """
            INSERT INTO parking_records
            (
                vehicle_number,
                vehicle_type,
                slot_id,
                entry_time,
                expected_exit_time,
                status
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                'parked'
            )
            """,
            (
                vehicle_number,
                vehicle_type,
                data.slot_id,
                actual_entry_time,
                data.expected_exit_time,
            ),
        )

        # OCCUPY SELECTED SLOT

        cursor.execute(
            """
            UPDATE parking_slots
            SET status = 'occupied'
            WHERE id = %s
              AND is_active = TRUE
            """,
            (data.slot_id,),
        )

        connection.commit()

        return {
            "message": "Vehicle entry registered successfully",
            "vehicle_number": vehicle_number,
            "vehicle_type": vehicle_type,
            "slot_number": slot["slot_number"],
            "entry_type": "walk_in",
            "entry_time": actual_entry_time,
            "expected_exit_time": data.expected_exit_time,
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to register vehicle entry",
        )

    finally:
        cursor.close()
        connection.close()


# ========================================
# VEHICLE EXIT AND CASH PAYMENT
# EMPLOYEE ONLY
# ========================================

HOURLY_RATES = {
    "Bike": Decimal("20.00"),
    "Car": Decimal("50.00"),
    "Minivan": Decimal("70.00"),
}


def calculate_parking_charge(
    vehicle_type,
    entry_time,
    exit_time,
):
    """
    Charge the full first hour.
    Every started additional 30 minutes costs
    half the hourly rate.
    """

    elapsed_seconds = (
        exit_time - entry_time
    ).total_seconds()

    if elapsed_seconds < 0:
        raise HTTPException(
            status_code=409,
            detail="Parking entry time is in the future",
        )

    hourly_rate = HOURLY_RATES.get(vehicle_type)

    if hourly_rate is None:
        raise HTTPException(
            status_code=409,
            detail="Unsupported vehicle type",
        )

    extra_seconds = max(
        0,
        elapsed_seconds - 3600,
    )

    additional_blocks = ceil(
        extra_seconds / 1800
    )

    amount = (
        hourly_rate
        + additional_blocks * (hourly_rate / 2)
    )

    duration_minutes = ceil(
        elapsed_seconds / 60
    )

    return (
        amount,
        duration_minutes,
        additional_blocks,
    )


def get_active_parking_record(
    cursor,
    vehicle_number,
    lock=False,
):
    locking_clause = "FOR UPDATE" if lock else ""

    cursor.execute(
        f"""
        SELECT
            pr.id,
            pr.slot_id,
            pr.vehicle_number,
            pr.vehicle_type,
            pr.entry_time,
            pr.expected_exit_time,
            ps.slot_number

        FROM parking_records pr

        JOIN parking_slots ps
            ON ps.id = pr.slot_id

        WHERE pr.vehicle_number = %s
          AND pr.status = 'parked'

        ORDER BY pr.id DESC

        LIMIT 1
        {locking_clause}
        """,
        (vehicle_number,),
    )

    record = cursor.fetchone()

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle is not currently parked",
        )

    return record


def get_overtime_details(record, exit_time):
    expected = record["expected_exit_time"]

    if expected is None:
        return False, 0

    overtime_seconds = max(
        0,
        (exit_time - expected).total_seconds(),
    )

    overtime_minutes = ceil(
        overtime_seconds / 60
    )

    return (
        overtime_minutes > 0,
        overtime_minutes,
    )


# ========================================
# PREVIEW PARKING CHARGE
# DOES NOT RELEASE THE SLOT
# ========================================

@router.post("/vehicle-exit/preview")
def preview_vehicle_exit(
    data: VehicleExitRequest,
    request: Request,
):
    require_employee(request)

    vehicle_number = normalize_vehicle_number(
        data.vehicle_number
    )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        record = get_active_parking_record(
            cursor,
            vehicle_number,
        )

        calculated_at = datetime.now()

        (
            amount,
            duration_minutes,
            additional_blocks,
        ) = calculate_parking_charge(
            record["vehicle_type"],
            record["entry_time"],
            calculated_at,
        )

        (
            overstayed,
            overtime_minutes,
        ) = get_overtime_details(
            record,
            calculated_at,
        )

        return {
            "vehicle_number": record["vehicle_number"],
            "vehicle_type": record["vehicle_type"],
            "slot_number": record["slot_number"],
            "entry_time": record["entry_time"],
            "expected_exit_time": record["expected_exit_time"],
            "calculated_at": calculated_at,
            "duration_minutes": duration_minutes,
            "additional_half_hours": additional_blocks,
            "amount": float(amount),
            "payment_method": "CASH",
            "overstayed": overstayed,
            "overtime_minutes": overtime_minutes,
            "note": (
                "Final charge is recalculated when "
                "cash payment is confirmed."
            ),
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to calculate parking charge",
        )

    finally:
        cursor.close()
        connection.close()


# ========================================
# CONFIRM CASH PAYMENT AND VEHICLE EXIT
# ========================================

@router.post("/vehicle-exit")
def vehicle_exit(
    data: CashPaymentRequest,
    request: Request,
):
    require_employee(request)

    vehicle_number = normalize_vehicle_number(
        data.vehicle_number
    )

    if data.cash_received is not True:
        raise HTTPException(
            status_code=400,
            detail=(
                "Confirm that cash has been received "
                "before completing vehicle exit"
            ),
        )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # LOCK ACTIVE PARKING RECORD

        record = get_active_parking_record(
            cursor,
            vehicle_number,
            lock=True,
        )

        exit_time = datetime.now()

        (
            amount,
            duration_minutes,
            _,
        ) = calculate_parking_charge(
            record["vehicle_type"],
            record["entry_time"],
            exit_time,
        )

        (
            overstayed,
            overtime_minutes,
        ) = get_overtime_details(
            record,
            exit_time,
        )

        # PREVENT DUPLICATE COMPLETED PAYMENT

        cursor.execute(
            """
            SELECT id
            FROM payments
            WHERE parking_record_id = %s
              AND payment_status = 'COMPLETED'
            LIMIT 1
            """,
            (record["id"],),
        )

        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Parking payment already completed",
            )

        # SAVE CASH PAYMENT

        cursor.execute(
            """
            INSERT INTO payments
            (
                parking_record_id,
                amount,
                payment_method,
                payment_status,
                paid_at
            )
            VALUES
            (
                %s,
                %s,
                'CASH',
                'COMPLETED',
                %s
            )
            """,
            (
                record["id"],
                amount,
                exit_time,
            ),
        )

        payment_id = cursor.lastrowid

        # MARK PARKING RECORD AS EXITED

        cursor.execute(
            """
            UPDATE parking_records
            SET
                status = 'exited',
                exit_time = %s
            WHERE id = %s
              AND status = 'parked'
            """,
            (
                exit_time,
                record["id"],
            ),
        )

        if cursor.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail="Parking session already closed",
            )

        # RELEASE PHYSICAL PARKING SLOT

        cursor.execute(
            """
            UPDATE parking_slots
            SET status = 'available'
            WHERE id = %s
              AND status = 'occupied'
            """,
            (record["slot_id"],),
        )

        if cursor.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail="Parking slot status is inconsistent",
            )

        # COMPLETE ASSOCIATED BOOKING

        cursor.execute(
            """
            UPDATE bookings
            SET status = 'completed'
            WHERE slot_id = %s
              AND vehicle_number = %s
              AND status = 'checked_in'
            """,
            (
                record["slot_id"],
                vehicle_number,
            ),
        )

        # SAVE ALL CHANGES TOGETHER

        connection.commit()

        return {
            "message": (
                "Cash payment received and vehicle "
                "exit registered successfully"
            ),
            "payment_id": payment_id,
            "payment_status": "COMPLETED",
            "payment_method": "CASH",
            "amount": float(amount),
            "vehicle_number": record["vehicle_number"],
            "vehicle_type": record["vehicle_type"],
            "slot_number": record["slot_number"],
            "entry_time": record["entry_time"],
            "expected_exit_time": record["expected_exit_time"],
            "actual_exit_time": exit_time,
            "duration_minutes": duration_minutes,
            "overstayed": overstayed,
            "overtime_minutes": overtime_minutes,
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to complete cash payment "
                "and vehicle exit"
            ),
        )

    finally:
        cursor.close()
        connection.close()