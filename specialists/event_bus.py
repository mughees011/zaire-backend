'''Simple asynchronous publish/subscribe event bus used by new Professor‑Mode services.

Usage:
    from backend.event_bus import EventBus
    bus = EventBus.get_instance()
    bus.subscribe('AttentionAlert', my_handler)
    await bus.publish('AttentionAlert', {'reason': 'gaze_off', 'duration': 32})
'''

import asyncio
from collections import defaultdict
from typing import Callable, Any, Coroutine, List

class EventBus:
    _instance = None

    def __init__(self):
        self._subscribers: defaultdict[str, List[Callable[[Any], Coroutine[Any, Any, None]]]] = defaultdict(list)
        self._queue: asyncio.Queue = asyncio.Queue()
        self._running = False

    @classmethod
    def get_instance(cls) -> "EventBus":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def subscribe(self, event_type: str, handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
        """Register an async handler for a given event_type."""
        self._subscribers[event_type].append(handler)

    async def publish(self, event_type: str, payload: Any) -> None:
        """Enqueue an event for processing by background dispatcher."""
        await self._queue.put((event_type, payload))

    async def _dispatcher(self) -> None:
        while self._running:
            event_type, payload = await self._queue.get()
            handlers = self._subscribers.get(event_type, [])
            for handler in handlers:
                # fire‑and‑forget each handler
                asyncio.create_task(handler(payload))
            self._queue.task_done()

    async def start(self) -> None:
        if not self._running:
            self._running = True
            asyncio.create_task(self._dispatcher())

    async def stop(self) -> None:
        self._running = False
        await self._queue.join()
