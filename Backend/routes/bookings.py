from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import require_user
from database import get_database_connection


router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


class AvailabilityRequest(BaseModel):
    vehicle_type: str
    booking_start: datetime
    booking_end: datetime


class BookingCreate(BaseModel):
    slot_id: int
    vehicle_number: str
    vehicle_type: str
    booking_start: datetime
    booking_end: datetime


ALLOWED_VEHICLE_TYPES = {
    "Bike",
    "Car",
    "Minivan",
}


def validate_booking_times(
    booking_start: datetime,
    booking_end: datetime,
):
    if booking_end <= booking_start:
        raise HTTPException(
            status_code=400,
            detail="Booking end time must be after start time",
        )

    if booking_start < datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Booking cannot start in the past",
        )


def normalize_vehicle_type(vehicle_type: str):
    normalized = vehicle_type.strip().title()

    if normalized not in ALLOWED_VEHICLE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle type",
        )

    return normalized


# ========================================
# CHECK SLOT AVAILABILITY
# ========================================

@router.post("/available-slots")
def get_available_slots(
    data: AvailabilityRequest,
    request: Request,
):
    require_user(request)

    vehicle_type = normalize_vehicle_type(
        data.vehicle_type
    )

    validate_booking_times(
        data.booking_start,
        data.booking_end,
    )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                ps.id,
                ps.slot_number,
                ps.slot_type,
                ps.status,
                ps.zone_id,
                ps.x_position,
                ps.y_position,
                ps.slot_width,
                ps.slot_length,

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
                    THEN 'occupied'

                    ELSE 'available'
                END AS availability

            FROM parking_slots ps

            WHERE ps.slot_type = %s
              AND ps.is_active = TRUE

            ORDER BY ps.id
            """,
            (
                data.booking_end,
                data.booking_start,
                vehicle_type,
            ),
        )

        slots = cursor.fetchall()

        return {
            "vehicle_type": vehicle_type,
            "booking_start": data.booking_start,
            "booking_end": data.booking_end,
            "slots": slots,
        }

    finally:
        cursor.close()
        connection.close()


# ========================================
# CREATE BOOKING
# ========================================

@router.post("")
def create_booking(
    data: BookingCreate,
    request: Request,
):
    user = require_user(request)

    vehicle_number = (
        data.vehicle_number
        .strip()
        .upper()
    )

    vehicle_type = normalize_vehicle_type(
        data.vehicle_type
    )

    if len(vehicle_number) != 10:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vehicle registration number must be "
                "exactly 10 characters"
            ),
        )

    validate_booking_times(
        data.booking_start,
        data.booking_end,
    )

    user_id = user.get("user_id")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="User ID missing from authentication token",
        )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
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
                detail="Parking slot is not active",
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
                detail="Parking slot is currently occupied",
            )

        cursor.execute(
            """
            SELECT id
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
                data.booking_end,
                data.booking_start,
            ),
        )

        overlapping_booking = cursor.fetchone()

        if overlapping_booking is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This slot is already booked "
                    "for the selected time"
                ),
            )

        cursor.execute(
            """
            SELECT id
            FROM bookings
            WHERE user_id = %s
              AND vehicle_number = %s
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
                user_id,
                vehicle_number,
                data.booking_end,
                data.booking_start,
            ),
        )

        existing_vehicle_booking = cursor.fetchone()

        if existing_vehicle_booking is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This vehicle already has "
                    "an overlapping booking"
                ),
            )

        cursor.execute(
            """
            INSERT INTO bookings
                (
                    user_id,
                    slot_id,
                    vehicle_number,
                    vehicle_type,
                    booking_start,
                    booking_end,
                    status
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'booked'
                )
            """,
            (
                user_id,
                data.slot_id,
                vehicle_number,
                vehicle_type,
                data.booking_start,
                data.booking_end,
            ),
        )

        booking_id = cursor.lastrowid

        connection.commit()

        return {
            "message": "Booking created successfully",
            "booking_id": booking_id,
            "slot_number": slot["slot_number"],
            "vehicle_number": vehicle_number,
            "vehicle_type": vehicle_type,
            "booking_start": data.booking_start,
            "booking_end": data.booking_end,
            "status": "booked",
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to create booking",
        )

    finally:
        cursor.close()
        connection.close()


# ========================================
# MY BOOKINGS
# ========================================

@router.get("/my-bookings")
def get_my_bookings(
    request: Request,
):
    user = require_user(request)

    user_id = user.get("user_id")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="User ID missing from authentication token",
        )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                b.id,
                b.vehicle_number,
                b.vehicle_type,
                b.booking_start,
                b.booking_end,
                b.status,
                b.created_at,
                ps.slot_number,
                ps.zone_id,
                ps.x_position,
                ps.y_position
            FROM bookings b
            JOIN parking_slots ps
                ON b.slot_id = ps.id
            WHERE b.user_id = %s
            ORDER BY b.booking_start DESC
            """,
            (user_id,),
        )

        bookings = cursor.fetchall()

        return {
            "bookings": bookings,
        }

    finally:
        cursor.close()
        connection.close()


# ========================================
# CANCEL BOOKING
# ========================================

@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    request: Request,
):
    user = require_user(request)

    user_id = user.get("user_id")

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="User ID missing from authentication token",
        )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                slot_id,
                booking_start,
                booking_end,
                status
            FROM bookings
            WHERE id = %s
              AND user_id = %s
            FOR UPDATE
            """,
            (
                booking_id,
                user_id,
            ),
        )

        booking = cursor.fetchone()

        if booking is None:
            raise HTTPException(
                status_code=404,
                detail="Booking not found",
            )

        if booking["status"] != "booked":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only active bookings can be cancelled"
                ),
            )

        cursor.execute(
            """
            UPDATE bookings
            SET status = 'cancelled'
            WHERE id = %s
            """,
            (booking_id,),
        )

        connection.commit()

        return {
            "message": "Booking cancelled successfully",
            "booking_id": booking_id,
            "status": "cancelled",
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to cancel booking",
        )

    finally:
        cursor.close()
        connection.close()