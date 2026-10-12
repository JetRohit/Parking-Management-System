from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import require_admin
from database import get_database_connection
from parking_config import SLOT_DIMENSIONS
from services.slot_conversion_service import (
    calculate_split_layout,
    find_conversion_space,
)


router = APIRouter(
    prefix="/slot-management",
    tags=["Slot Management"],
)


class SlotConversionRequest(BaseModel):
    slot_id: int
    target_type: str


# ========================================
# HELPERS
# ========================================

def get_next_slot_numbers(
    cursor,
    slot_type,
    count,
):
    prefixes = {
        "Bike": "B",
        "Car": "C",
        "Minivan": "M",
    }

    prefix = prefixes[slot_type]

    cursor.execute(
        """
        SELECT
            MAX(
                CAST(
                    SUBSTRING(slot_number, 2)
                    AS UNSIGNED
                )
            ) AS maximum_number
        FROM parking_slots
        WHERE slot_number LIKE %s
        """,
        (f"{prefix}%",),
    )

    result = cursor.fetchone()

    maximum_number = (
        result["maximum_number"]
        if result["maximum_number"] is not None
        else 0
    )

    return [
        f"{prefix}{number:02d}"
        for number in range(
            maximum_number + 1,
            maximum_number + count + 1,
        )
    ]


def get_selected_slot(
    cursor,
    slot_id,
    lock=False,
):
    lock_clause = "FOR UPDATE" if lock else ""

    cursor.execute(
        f"""
        SELECT
            ps.id,
            ps.slot_number,
            ps.slot_type,
            ps.status,
            ps.zone,
            ps.zone_id,
            ps.x_position,
            ps.y_position,
            ps.slot_width,
            ps.slot_length,
            ps.is_active,
            pz.zone_name,
            pz.zone_width,
            pz.zone_length
        FROM parking_slots ps
        JOIN parking_zones pz
            ON ps.zone_id = pz.id
        WHERE ps.id = %s
          AND ps.is_active = TRUE
        {lock_clause}
        """,
        (slot_id,),
    )

    return cursor.fetchone()


def get_active_zone_slots(
    cursor,
    zone_id,
    lock=False,
):
    lock_clause = "FOR UPDATE" if lock else ""

    cursor.execute(
        f"""
        SELECT
            id,
            slot_number,
            slot_type,
            status,
            zone,
            zone_id,
            x_position,
            y_position,
            slot_width,
            slot_length,
            is_active
        FROM parking_slots
        WHERE zone_id = %s
          AND is_active = TRUE
        ORDER BY id
        {lock_clause}
        """,
        (zone_id,),
    )

    return cursor.fetchall()


def build_conversion_option(
    selected_slot,
    zone_slots,
    target_type,
):
    if target_type not in SLOT_DIMENSIONS:
        return None

    if target_type == selected_slot["slot_type"]:
        return None

    target_width = float(
        SLOT_DIMENSIONS[target_type]["width"]
    )

    target_length = float(
        SLOT_DIMENSIONS[target_type]["length"]
    )

    selected_width = float(
        selected_slot["slot_width"]
    )

    selected_length = float(
        selected_slot["slot_length"]
    )

    selected_area = (
        selected_width
        * selected_length
    )

    target_area = (
        target_width
        * target_length
    )

    # ====================================
    # BIGGER -> SMALLER
    # ====================================

    if target_area < selected_area:
        rectangle = {
            "x_position": float(
                selected_slot["x_position"]
            ),
            "y_position": float(
                selected_slot["y_position"]
            ),
            "width": selected_width,
            "length": selected_length,
        }

        split_layout = calculate_split_layout(
            rectangle=rectangle,
            target_width=target_width,
            target_length=target_length,
        )

        if split_layout is None:
            return None

        return {
            "target_type": target_type,
            "conversion_mode": "split",
            "required_width": target_width,
            "required_length": target_length,
            "source_slots": [
                {
                    "id": selected_slot["id"],
                    "slot_number": (
                        selected_slot["slot_number"]
                    ),
                    "slot_type": (
                        selected_slot["slot_type"]
                    ),
                }
            ],
            "resulting_slot_count": (
                split_layout["slot_count"]
            ),
            "resulting_slots": (
                split_layout["slots"]
            ),
            "rotated": split_layout["rotated"],
        }

    # ====================================
    # SMALLER -> BIGGER
    # ====================================

    conversion_space = find_conversion_space(
        selected_slot=selected_slot,
        zone_slots=zone_slots,
        required_width=target_width,
        required_length=target_length,
    )

    if conversion_space is None:
        return None

    slots_used = conversion_space["slots"]
    rectangle = conversion_space["rectangle"]

    combined_area = (
        rectangle["width"]
        * rectangle["length"]
    )

    if abs(
        combined_area - target_area
    ) > 0.0001:
        return None

    return {
        "target_type": target_type,
        "conversion_mode": "combine",
        "required_width": target_width,
        "required_length": target_length,
        "source_slots": [
            {
                "id": slot["id"],
                "slot_number": slot["slot_number"],
                "slot_type": slot["slot_type"],
            }
            for slot in sorted(
                slots_used,
                key=lambda item: item["id"],
            )
        ],
        "resulting_slot_count": 1,
        "resulting_space": {
            "x_position": rectangle["x_position"],
            "y_position": rectangle["y_position"],
            "width": rectangle["width"],
            "length": rectangle["length"],
        },
    }


# ========================================
# READ CONVERSION OPTIONS
# ========================================

@router.get("/{slot_id}/conversion-options")
def get_conversion_options(
    slot_id: int,
    request: Request,
):
    require_admin(request)

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        selected_slot = get_selected_slot(
            cursor,
            slot_id,
        )

        if selected_slot is None:
            raise HTTPException(
                status_code=404,
                detail="Active parking slot not found",
            )

        if selected_slot["status"] != "available":
            raise HTTPException(
                status_code=409,
                detail="Occupied slots cannot be converted",
            )

        zone_slots = get_active_zone_slots(
            cursor,
            selected_slot["zone_id"],
        )

        conversion_options = []

        for target_type in SLOT_DIMENSIONS:
            option = build_conversion_option(
                selected_slot=selected_slot,
                zone_slots=zone_slots,
                target_type=target_type,
            )

            if option is not None:
                conversion_options.append(option)

        return {
            "selected_slot": {
                "id": selected_slot["id"],
                "slot_number": (
                    selected_slot["slot_number"]
                ),
                "slot_type": (
                    selected_slot["slot_type"]
                ),
                "status": selected_slot["status"],
                "zone": selected_slot["zone_name"],
                "width": float(
                    selected_slot["slot_width"]
                ),
                "length": float(
                    selected_slot["slot_length"]
                ),
            },
            "conversion_options": conversion_options,
        }

    finally:
        cursor.close()
        connection.close()


# ========================================
# PERFORM CONVERSION
# ========================================

@router.post("/convert")
def convert_parking_slot(
    data: SlotConversionRequest,
    request: Request,
):
    require_admin(request)

    target_type = data.target_type.strip().title()

    if target_type not in SLOT_DIMENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid target slot type",
        )

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        # ----------------------------------------
        # Lock selected slot
        # ----------------------------------------

        selected_slot = get_selected_slot(
            cursor,
            data.slot_id,
            lock=True,
        )

        if selected_slot is None:
            raise HTTPException(
                status_code=404,
                detail="Active parking slot not found",
            )

        if selected_slot["status"] != "available":
            raise HTTPException(
                status_code=409,
                detail="Occupied slots cannot be converted",
            )

        if selected_slot["slot_type"] == target_type:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Selected slot already has "
                    "that slot type"
                ),
            )

        # ----------------------------------------
        # Lock current active zone layout
        # ----------------------------------------

        zone_slots = get_active_zone_slots(
            cursor,
            selected_slot["zone_id"],
            lock=True,
        )

        # Recalculate after locking.
        # We never trust the old frontend preview.
        option = build_conversion_option(
            selected_slot=selected_slot,
            zone_slots=zone_slots,
            target_type=target_type,
        )

        if option is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This conversion is no longer "
                    "available"
                ),
            )

        source_ids = [
            slot["id"]
            for slot in option["source_slots"]
        ]

        # ----------------------------------------
        # Final availability check
        # ----------------------------------------

        placeholders = ", ".join(
            ["%s"] * len(source_ids)
        )

        cursor.execute(
            f"""
            SELECT
                id,
                slot_number,
                status,
                is_active
            FROM parking_slots
            WHERE id IN ({placeholders})
            FOR UPDATE
            """,
            tuple(source_ids),
        )

        locked_sources = cursor.fetchall()

        if len(locked_sources) != len(source_ids):
            raise HTTPException(
                status_code=409,
                detail="Required parking slots changed",
            )

        for source in locked_sources:
            if (
                source["status"] != "available"
                or not source["is_active"]
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "One or more required slots "
                        "are no longer available"
                    ),
                )

        # ----------------------------------------
        # CREATE CONVERSION HISTORY
        # ----------------------------------------

        cursor.execute(
            """
            INSERT INTO slot_conversions
                (
                    from_slot_type,
                    to_slot_type,
                    zone_id
                )
            VALUES
                (%s, %s, %s)
            """,
            (
                selected_slot["slot_type"],
                target_type,
                selected_slot["zone_id"],
            ),
        )

        conversion_id = cursor.lastrowid

        for source_id in source_ids:
            cursor.execute(
                """
                INSERT INTO slot_conversion_sources
                    (conversion_id, slot_id)
                VALUES
                    (%s, %s)
                """,
                (
                    conversion_id,
                    source_id,
                ),
            )

        # ----------------------------------------
        # DEACTIVATE OLD SLOT MARKINGS
        # ----------------------------------------

        cursor.execute(
            f"""
            UPDATE parking_slots
            SET is_active = FALSE
            WHERE id IN ({placeholders})
            """,
            tuple(source_ids),
        )

        # ----------------------------------------
        # DETERMINE NEW SLOT GEOMETRY
        # ----------------------------------------

        if option["conversion_mode"] == "combine":
            result_geometries = [
                option["resulting_space"]
            ]

        else:
            result_geometries = (
                option["resulting_slots"]
            )

        # ----------------------------------------
        # GENERATE NEW SLOT NUMBERS
        # ----------------------------------------

        new_slot_numbers = get_next_slot_numbers(
            cursor=cursor,
            slot_type=target_type,
            count=len(result_geometries),
        )

        created_slots = []

        # ----------------------------------------
        # CREATE NEW ACTIVE SLOT MARKINGS
        # ----------------------------------------

        for slot_number, geometry in zip(
            new_slot_numbers,
            result_geometries,
        ):
            cursor.execute(
                """
                INSERT INTO parking_slots
                    (
                        slot_number,
                        slot_type,
                        status,
                        zone,
                        layout_row,
                        layout_column,
                        zone_id,
                        x_position,
                        y_position,
                        slot_width,
                        slot_length,
                        is_active
                    )
                VALUES
                    (
                        %s,
                        %s,
                        'available',
                        %s,
                        NULL,
                        NULL,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        TRUE
                    )
                """,
                (
                    slot_number,
                    target_type,
                    selected_slot["zone_name"],
                    selected_slot["zone_id"],
                    geometry["x_position"],
                    geometry["y_position"],
                    geometry["width"],
                    geometry["length"],
                ),
            )

            new_slot_id = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO slot_conversion_results
                    (conversion_id, slot_id)
                VALUES
                    (%s, %s)
                """,
                (
                    conversion_id,
                    new_slot_id,
                ),
            )

            created_slots.append(
                {
                    "id": new_slot_id,
                    "slot_number": slot_number,
                    "slot_type": target_type,
                    "status": "available",
                    "x_position": (
                        geometry["x_position"]
                    ),
                    "y_position": (
                        geometry["y_position"]
                    ),
                    "width": geometry["width"],
                    "length": geometry["length"],
                }
            )

        # ----------------------------------------
        # SAVE EVERYTHING TOGETHER
        # ----------------------------------------

        connection.commit()

        return {
            "message": (
                "Parking slot conversion "
                "completed successfully"
            ),
            "conversion_id": conversion_id,
            "conversion_mode": (
                option["conversion_mode"]
            ),
            "from_slot_type": (
                selected_slot["slot_type"]
            ),
            "to_slot_type": target_type,
            "source_slots": (
                option["source_slots"]
            ),
            "created_slots": created_slots,
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to complete slot conversion",
        )

    finally:
        cursor.close()
        connection.close()