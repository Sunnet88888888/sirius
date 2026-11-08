from fastapi import UploadFile
from src.services.utils.upload_content import upload_file


async def upload_thumbnail(thumbnail_file: UploadFile, org_uuid: str, course_id: int) -> str:
    """Upload a course thumbnail image with file validation."""
    return await upload_file(
        file=thumbnail_file,
        directory=f"courses/{course_id}/thumbnails",
        type_of_dir="orgs",
        uuid=org_uuid,
        allowed_types=["image", "video"],
        filename_prefix="thumbnail",
    )


async def upload_about_image(image_file: UploadFile, org_uuid: str, course_uuid: str) -> str:
    """Upload an image used inside a course's About text (images only)."""
    return await upload_file(
        file=image_file,
        directory=f"courses/{course_uuid}/about",
        type_of_dir="orgs",
        uuid=org_uuid,
        allowed_types=["image"],
        filename_prefix="about",
        max_size=10 * 1024 * 1024,
    )
