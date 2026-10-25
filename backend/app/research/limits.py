"""Bound intake before multipart/JSON parsing, including chunked request bodies."""
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.research.extraction import MAX_UPLOAD_BYTES

# Allow multipart boundaries/metadata, but never buffer arbitrary-sized requests.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024


class ResearchIntakeLimit:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        path = scope.get("path", "")
        limited = (scope["type"] == "http" and scope.get("method") == "POST"
                   and path.startswith("/research/cases/") and "/documents/" in path)
        if not limited:
            await self.app(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > MAX_REQUEST_BYTES:
                response = JSONResponse({"detail": "Intake request is too large. Documents must be 10 MiB or smaller (64 KiB metadata allowance)."}, status_code=413)
                await response(scope, receive, send)
                return
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
