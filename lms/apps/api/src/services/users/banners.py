from fastapi import UploadFile
from src.services.utils.upload_content import upload_file

MAX_BANNER_BYTES = 5 * 1024 * 1024


async def upload_banner(banner_file: UploadFile, user_uuid: str) -> str:
    """Upload user profile banner."""
    return await upload_file(
        file=banner_file,
        directory="banners",
        type_of_dir="users",
        uuid=user_uuid,
        allowed_types=["image"],
        filename_prefix="banner",
        max_size=MAX_BANNER_BYTES,
    )
