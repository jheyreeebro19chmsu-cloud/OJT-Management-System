from channels.generic.websocket import AsyncJsonWebsocketConsumer


class PendingRequestsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # Expect instructor_id as query param or as part of path
        instructor_id = self.scope.get('url_route', {}).get('kwargs', {}).get('instructor_id')
        if not instructor_id:
            # try query string
            qs = self.scope.get('query_string', b'').decode()
            params = dict([p.split('=') for p in qs.split('&') if '=' in p]) if qs else {}
            instructor_id = params.get('instructor_id')

        if not instructor_id:
            await self.close(code=4001)
            return

        self.group_name = f"instructor_{instructor_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def pending_requests_update(self, event):
        # event should contain 'count' and optional 'action'
        await self.send_json({'count': event.get('count', 0), 'action': event.get('action')})
