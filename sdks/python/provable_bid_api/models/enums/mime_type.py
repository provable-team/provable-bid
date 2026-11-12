from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class MimeType(str, Enum):
    IMAGE_JPEG = "image/jpeg"
    TEXT_HTML = "text/html"

    __str__ = str.__str__


MimeTypeOrStr: TypeAlias = Annotated[MimeType | str, open_enum_validator(MimeType)]
