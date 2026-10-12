import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BACKEND_DIR))

from database import get_database_connection


SLOT_LAYOUT = {
    "Bike": {
        "prefix": "B",
        "count": 10,
        "zone": "A",
        "slots_per_row": 5,
    },

    "Car": {
        "prefix": "C",
        "count": 30,
        "zone": "B",
        "slots_per_row": 15,
    },

    "Minivan": {
        "prefix": "M",
        "count": 10,
        "zone": "C",
        "slots_per_row": 5,
    },
}


def migrate_slot_positions():
    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        updated_slots = 0

        for config in SLOT_LAYOUT.values():
            prefix = config["prefix"]
            count = config["count"]
            zone = config["zone"]
            slots_per_row = config["slots_per_row"]

            for number in range(1, count + 1):
                slot_number = f"{prefix}{number:02d}"

                layout_row = (
                    (number - 1) // slots_per_row
                ) + 1

                layout_column = (
                    (number - 1) % slots_per_row
                ) + 1

                cursor.execute(
                    """
                    UPDATE parking_slots
                    SET
                        zone = %s,
                        layout_row = %s,
                        layout_column = %s
                    WHERE slot_number = %s
                    """,
                    (
                        zone,
                        layout_row,
                        layout_column,
                        slot_number,
                    ),
                )

                updated_slots += cursor.rowcount

        if updated_slots != 50:
            connection.rollback()

            raise RuntimeError(
                "Migration expected to update 50 slots, "
                f"but updated {updated_slots}. "
                "No changes were saved."
            )

        connection.commit()

        print("Slot layout migration completed successfully.")
        print(f"Updated slots: {updated_slots}")

    except Exception as error:
        connection.rollback()
        print(f"Migration failed: {error}")

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    migrate_slot_positions()