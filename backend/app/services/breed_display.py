"""Shared helper for rendering a pet's breed string from its mix_type
and associated Breed rows. Used by every response that exposes a
human-readable breed field."""

from typing import Iterable, Protocol


class _BreedLike(Protocol):
    name: str


def breed_display(
    mix_type: str | None,
    breeds: Iterable[_BreedLike] | None,
    species: str = "dog",
) -> str:
    names = [b.name for b in (breeds or [])]
    # Species-specific wording for the unknown/mixed cases.
    mutt = "Moggie" if species == "cat" else "Mystery mutt"
    mixed_label = "Domestic mix" if species == "cat" else "Mixed breed"

    if mix_type == "mystery_mutt" or not mix_type:
        if names:
            return f"{mutt} ({', '.join(names)})" if mix_type == "mystery_mutt" else ", ".join(names)
        return mutt

    if not names:
        if mix_type == "mixed":
            return mixed_label
        return "Unknown"

    if mix_type == "purebred":
        return names[0]

    if mix_type == "cross":
        return " \u00d7 ".join(names)  # e.g. "Golden Retriever × Poodle"

    if mix_type == "mixed":
        return f"{' / '.join(names)} mix"

    return ", ".join(names)
