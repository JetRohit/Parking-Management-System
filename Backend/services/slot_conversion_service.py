TOLERANCE = 0.0001


# ========================================
# RECTANGLE HELPERS
# ========================================

def get_slot_rectangle(slot):
    x = float(slot["x_position"])
    y = float(slot["y_position"])
    width = float(slot["slot_width"])
    length = float(slot["slot_length"])

    return {
        "left": x,
        "top": y,
        "right": x + width,
        "bottom": y + length,
    }


def rectangles_are_adjacent(first_slot, second_slot):
    """
    Two slots are adjacent when they share part of an edge.
    Corner-only contact is not considered adjacency.
    """

    first = get_slot_rectangle(first_slot)
    second = get_slot_rectangle(second_slot)

    touches_horizontally = (
        abs(first["right"] - second["left"]) < TOLERANCE
        or abs(second["right"] - first["left"]) < TOLERANCE
    )

    vertical_overlap = (
        first["top"] < second["bottom"] - TOLERANCE
        and second["top"] < first["bottom"] - TOLERANCE
    )

    if touches_horizontally and vertical_overlap:
        return True

    touches_vertically = (
        abs(first["bottom"] - second["top"]) < TOLERANCE
        or abs(second["bottom"] - first["top"]) < TOLERANCE
    )

    horizontal_overlap = (
        first["left"] < second["right"] - TOLERANCE
        and second["left"] < first["right"] - TOLERANCE
    )

    return touches_vertically and horizontal_overlap


def slots_are_connected(slots):
    """
    Every slot in the group must belong to one connected
    physical region.
    """

    if not slots:
        return False

    visited = {slots[0]["id"]}
    changed = True

    while changed:
        changed = False

        for slot in slots:
            if slot["id"] in visited:
                continue

            for visited_slot in slots:
                if visited_slot["id"] not in visited:
                    continue

                if rectangles_are_adjacent(
                    slot,
                    visited_slot,
                ):
                    visited.add(slot["id"])
                    changed = True
                    break

    return len(visited) == len(slots)


def get_combined_rectangle(slots):
    rectangles = [
        get_slot_rectangle(slot)
        for slot in slots
    ]

    left = min(
        rectangle["left"]
        for rectangle in rectangles
    )

    top = min(
        rectangle["top"]
        for rectangle in rectangles
    )

    right = max(
        rectangle["right"]
        for rectangle in rectangles
    )

    bottom = max(
        rectangle["bottom"]
        for rectangle in rectangles
    )

    return {
        "x_position": left,
        "y_position": top,
        "width": right - left,
        "length": bottom - top,
    }


def slots_form_complete_rectangle(slots):
    """
    Make sure the slots completely cover their bounding
    rectangle without gaps or overlapping areas.
    """

    if not slots:
        return False

    combined = get_combined_rectangle(slots)

    bounding_area = (
        combined["width"]
        * combined["length"]
    )

    slot_area = sum(
        float(slot["slot_width"])
        * float(slot["slot_length"])
        for slot in slots
    )

    if abs(
        bounding_area - slot_area
    ) >= TOLERANCE:
        return False

    # Active parking slots should never overlap.
    # Check this explicitly before accepting the region.
    for index, first_slot in enumerate(slots):
        first = get_slot_rectangle(first_slot)

        for second_slot in slots[index + 1:]:
            second = get_slot_rectangle(second_slot)

            overlap_width = min(
                first["right"],
                second["right"],
            ) - max(
                first["left"],
                second["left"],
            )

            overlap_length = min(
                first["bottom"],
                second["bottom"],
            ) - max(
                first["top"],
                second["top"],
            )

            if (
                overlap_width > TOLERANCE
                and overlap_length > TOLERANCE
            ):
                return False

    return True


# ========================================
# RECTANGLE SEARCH
# ========================================

def slot_is_inside_rectangle(slot, rectangle):
    """
    Check whether a complete slot is inside the candidate
    physical rectangle.
    """

    slot_rectangle = get_slot_rectangle(slot)

    left = rectangle["x_position"]
    top = rectangle["y_position"]
    right = left + rectangle["width"]
    bottom = top + rectangle["length"]

    return (
        slot_rectangle["left"] >= left - TOLERANCE
        and slot_rectangle["top"] >= top - TOLERANCE
        and slot_rectangle["right"] <= right + TOLERANCE
        and slot_rectangle["bottom"] <= bottom + TOLERANCE
    )


def rectangles_match(first, second):
    return (
        abs(
            first["x_position"]
            - second["x_position"]
        ) < TOLERANCE
        and abs(
            first["y_position"]
            - second["y_position"]
        ) < TOLERANCE
        and abs(
            first["width"]
            - second["width"]
        ) < TOLERANCE
        and abs(
            first["length"]
            - second["length"]
        ) < TOLERANCE
    )


def find_conversion_space(
    selected_slot,
    zone_slots,
    required_width,
    required_length,
):
    """
    Find an exact rectangular region containing the selected
    slot that can become one target slot.

    Instead of testing every possible combination of slots,
    candidate rectangles are created from the boundaries of
    the existing available slots.
    """

    available_slots = [
        slot
        for slot in zone_slots
        if (
            slot["status"] == "available"
            and slot.get("is_active", True)
        )
    ]

    selected_slot = next(
        (
            slot
            for slot in available_slots
            if slot["id"] == selected_slot["id"]
        ),
        None,
    )

    if selected_slot is None:
        return None

    selected_rectangle = get_slot_rectangle(
        selected_slot
    )

    orientations = [
        (
            float(required_width),
            float(required_length),
        )
    ]

    rotated_orientation = (
        float(required_length),
        float(required_width),
    )

    if rotated_orientation != orientations[0]:
        orientations.append(rotated_orientation)

    # Candidate positions come from real slot boundaries.
    x_boundaries = set()
    y_boundaries = set()

    for slot in available_slots:
        rectangle = get_slot_rectangle(slot)

        x_boundaries.add(rectangle["left"])
        x_boundaries.add(rectangle["right"])

        y_boundaries.add(rectangle["top"])
        y_boundaries.add(rectangle["bottom"])

    valid_candidates = []

    for width, length in orientations:

        for left in x_boundaries:
            right = left + width

            # Candidate must use an existing boundary.
            if not any(
                abs(right - boundary) < TOLERANCE
                for boundary in x_boundaries
            ):
                continue

            for top in y_boundaries:
                bottom = top + length

                if not any(
                    abs(bottom - boundary) < TOLERANCE
                    for boundary in y_boundaries
                ):
                    continue

                # Selected slot must be completely inside.
                if not (
                    selected_rectangle["left"]
                    >= left - TOLERANCE
                    and selected_rectangle["top"]
                    >= top - TOLERANCE
                    and selected_rectangle["right"]
                    <= right + TOLERANCE
                    and selected_rectangle["bottom"]
                    <= bottom + TOLERANCE
                ):
                    continue

                candidate = {
                    "x_position": left,
                    "y_position": top,
                    "width": width,
                    "length": length,
                }

                slots_in_candidate = [
                    slot
                    for slot in available_slots
                    if slot_is_inside_rectangle(
                        slot,
                        candidate,
                    )
                ]

                if not slots_in_candidate:
                    continue

                if not any(
                    slot["id"] == selected_slot["id"]
                    for slot in slots_in_candidate
                ):
                    continue

                if not slots_are_connected(
                    slots_in_candidate
                ):
                    continue

                if not slots_form_complete_rectangle(
                    slots_in_candidate
                ):
                    continue

                actual_rectangle = (
                    get_combined_rectangle(
                        slots_in_candidate
                    )
                )

                if not rectangles_match(
                    actual_rectangle,
                    candidate,
                ):
                    continue

                valid_candidates.append(
                    {
                        "slots": slots_in_candidate,
                        "rectangle": candidate,
                    }
                )

    if not valid_candidates:
        return None

    # Prefer the solution involving the fewest source slots.
    valid_candidates.sort(
        key=lambda candidate: (
            len(candidate["slots"]),
            candidate["rectangle"]["y_position"],
            candidate["rectangle"]["x_position"],
        )
    )

    return valid_candidates[0]


# ========================================
# BIGGER -> SMALLER
# ========================================

def calculate_split_layout(
    rectangle,
    target_width,
    target_length,
):
    """
    Split one rectangular physical space into complete
    target slots.

    No leftover physical strips are allowed.
    """

    space_x = float(
        rectangle["x_position"]
    )

    space_y = float(
        rectangle["y_position"]
    )

    space_width = float(
        rectangle["width"]
    )

    space_length = float(
        rectangle["length"]
    )

    orientations = [
        {
            "width": float(target_width),
            "length": float(target_length),
            "rotated": False,
        }
    ]

    rotated = {
        "width": float(target_length),
        "length": float(target_width),
        "rotated": True,
    }

    if (
        rotated["width"]
        != orientations[0]["width"]
        or rotated["length"]
        != orientations[0]["length"]
    ):
        orientations.append(rotated)

    valid_layouts = []

    for orientation in orientations:

        slot_width = orientation["width"]
        slot_length = orientation["length"]

        columns_float = (
            space_width / slot_width
        )

        rows_float = (
            space_length / slot_length
        )

        columns = round(columns_float)
        rows = round(rows_float)

        if columns <= 0 or rows <= 0:
            continue

        # Require exact tiling.
        if abs(
            columns * slot_width
            - space_width
        ) >= TOLERANCE:
            continue

        if abs(
            rows * slot_length
            - space_length
        ) >= TOLERANCE:
            continue

        new_slots = []

        for row in range(rows):
            for column in range(columns):

                new_slots.append(
                    {
                        "x_position": (
                            space_x
                            + column * slot_width
                        ),
                        "y_position": (
                            space_y
                            + row * slot_length
                        ),
                        "width": slot_width,
                        "length": slot_length,
                    }
                )

        valid_layouts.append(
            {
                "rotated": orientation["rotated"],
                "rows": rows,
                "columns": columns,
                "slot_count": len(new_slots),
                "slots": new_slots,
            }
        )

    if not valid_layouts:
        return None

    valid_layouts.sort(
        key=lambda layout: (
            -layout["slot_count"],
            layout["rotated"],
        )
    )

    return valid_layouts[0]