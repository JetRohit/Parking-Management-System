import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BACKEND_DIR))

from database import get_database_connection


SLOT_LAYOUT = {
    "Bike": {
        "prefix": "B",
        "count": 10,
        "slots_per_row": 5,
        "width": 1.0,
        "length": 2.5,
    },

    "Car": {
        "prefix": "C",
        "count": 30,
        "slots_per_row": 15,
        "width": 2.5,
        "length": 5.0,
    },

    "Minivan": {
        "prefix": "M",
        "count": 10,
        "slots_per_row": 5,
        "width": 3.0,
        "length": 6.0,
    },
}


def migrate_slot_coordinates():
    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        updated_slots = 0

        for config in SLOT_LAYOUT.values():
            prefix = config["prefix"]
            count = config["count"]
            slots_per_row = config["slots_per_row"]
            width = config["width"]
            length = config["length"]

            for number in range(1, count + 1):
                slot_number = f"{prefix}{number:02d}"

                zero_based_number = number - 1

                row = zero_based_number // slots_per_row
                column = zero_based_number % slots_per_row

                x_position = column * width
                y_position = row * length

                cursor.execute(
                    """
                    UPDATE parking_slots
                    SET
                        x_position = %s,
                        y_position = %s,
                        slot_width = %s,
                        slot_length = %s
                    WHERE slot_number = %s
                    """,
                    (
                        x_position,
                        y_position,
                        width,
                        length,
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

        print("Slot coordinate migration completed successfully.")
        print(f"Updated slots: {updated_slots}")

    except Exception as error:
        connection.rollback()
        print(f"Migration failed: {error}")

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    migrate_slot_coordinates()