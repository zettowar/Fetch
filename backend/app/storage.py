import os
import uuid
from pathlib import Path

from app.config import settings


class LocalStorage:
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return key

    async def get(self, key: str) -> bytes:
        file_path = self.base_path / key
        return file_path.read_bytes()

    async def delete(self, key: str) -> None:
        file_path = self.base_path / key
        if file_path.exists():
            file_path.unlink()

    def url(self, key: str) -> str:
        return f"/api/v1/photos/file/{key}"


def generate_storage_key(content_type: str) -> str:
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(
        content_type, ".jpg"
    )
    return f"{uuid.uuid4()}{ext}"


def get_storage() -> LocalStorage:
    # PHASE2: add S3Storage class and switch based on settings.STORAGE_BACKEND
    return LocalStorage(settings.STORAGE_LOCAL_PATH)
