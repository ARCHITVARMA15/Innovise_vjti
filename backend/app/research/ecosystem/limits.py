"""Limit ecosystem JSON bodies before the framework buffers/parses them."""
from starlette.responses import JSONResponse

MAX_BODY_BYTES = 64 * 1024


class EcosystemIntakeLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if not (scope['type'] == 'http' and scope.get('method') == 'POST'
                and scope.get('path', '').startswith('/research/cases/') and '/ecosystem/' in scope.get('path', '')):
            await self.app(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            body.extend(message.get('body', b''))
            if len(body) > MAX_BODY_BYTES:
                await JSONResponse({'detail': 'Ecosystem requests must be 64 KiB or smaller.'}, status_code=413)(scope, receive, send)
                return
            if not message.get('more_body', False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)
