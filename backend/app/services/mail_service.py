from __future__ import annotations

from io import BytesIO

from fastapi_mail import FastMail, MessageSchema, MessageType
from starlette.datastructures import Headers, UploadFile

from app.services.mail_config import get_mail_config


async def send_report_email(
    to_email: str,
    subject: str,
    html_body: str,
    pdf_bytes: bytes,
    filename: str,
) -> None:
    attachment = UploadFile(
        filename=filename,
        file=BytesIO(pdf_bytes),
        headers=Headers({"content-type": "application/pdf"}),
    )

    message = MessageSchema(
        subject=subject,
        recipients=[to_email],
        body=html_body,
        subtype=MessageType.html,
        attachments=[attachment],
    )

    fm = FastMail(get_mail_config())
    await fm.send_message(message)
