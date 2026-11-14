"""Validation helpers shared by request schemas."""

from pydantic import BaseModel


def reject_explicit_nulls(model: BaseModel, *fields: str) -> None:
    """Refuse `{"field": null}` for fields whose column is NOT NULL.

    PATCH schemas type every field `X | None = None` so that "not sent" can be
    told apart from a value, and the routers apply `model_dump(exclude_unset=
    True)`. That leaves a third case nobody meant to allow: a client sending an
    explicit null. For a nullable column that is how you clear it; for a
    required one it reached the database and came back as a 500.

    Call from a `model_validator(mode="after")`.
    """
    for field in fields:
        if field in model.model_fields_set and getattr(model, field) is None:
            raise ValueError(f"{field} cannot be null")
