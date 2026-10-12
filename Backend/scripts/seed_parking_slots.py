import sys
from pathlib import Path


# Add Backend folder to Python's import path.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BACKEND_DIR))

from database import get_database_connection


INITIAL_SLOT_CONFIGURATION = {
    "Bike": {
        "prefix": "B",
        "count": 10,
        "zone": "A",
        "slots_per_row": 5
    },

    "Car": {
        "prefix": "C",
        "count": 30,
        "zone": "B",
        "slots_per_row": 15
    },

    "Minivan": {
        "prefix": "M",
        "count": 10,
        "zone": "C",
        "slots_per_row": 5
    }
}


def seed_parking_slots():
    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            "SELECT COUNT(*) FROM parking_slots"
        )

        existing_slot_count = cursor.fetchone()[0]

        if existing_slot_count > 0:
            print(
                "Parking slots already exist. "
                f"Current slot count: {existing_slot_count}"
            )
            return

        slots = []

        for slot_type, config in INITIAL_SLOT_CONFIGURATION.items():
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

                slots.append(
                    (
                        slot_number,
                        slot_type,
                        "available",
                        zone,
                        layout_row,
                        layout_column
                    )
                )

        insert_query = """
            INSERT INTO parking_slots
                (
                    slot_number,
                    slot_type,
                    status,
                    zone,
                    layout_row,
                    layout_column
                )
            VALUES
                (%s, %s, %s, %s, %s, %s)
        """

        cursor.executemany(
            insert_query,
            slots
        )

        connection.commit()

        print("Parking slots seeded successfully.")
        print(f"Total slots: {len(slots)}")

        for slot_type, config in INITIAL_SLOT_CONFIGURATION.items():
            print(
                f"{slot_type}: {config['count']}"
            )

    except Exception as error:
        connection.rollback()

        print(
            f"Failed to seed parking slots: {error}"
        )

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    seed_parking_slots()