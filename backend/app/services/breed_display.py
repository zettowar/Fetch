"""Shared helper for rendering a dog's breed string from its mix_type
and associated Breed rows. Used by every response that exposes a
human-readable breed field."""

from typing import Iterable, Protocol


class _BreedLike(Protocol):
    name: str


def breed_display(mix_type: str | None, breeds: Iterable[_BreedLike] | None) -> str:
    names = [b.name for b in (breeds or [])]

    if mix_type == "mystery_mutt" or not mix_type:
        if names:
            return f"Mystery mutt ({', '.join(names)})" if mix_type == "mystery_mutt" else ", ".join(names)
        return "Mystery mutt"

    if not names:
        if mix_type == "mixed":
            return "Mixed breed"
        return "Unknown"

    if mix_type == "purebred":
        return names[0]

    if mix_type == "cross":
        return " \u00d7 ".join(names)  # e.g. "Golden Retriever × Poodle"

    if mix_type == "mixed":
        return f"{' / '.join(names)} mix"

    return ", ".join(names)
