from contextlib import asynccontextmanager
from app.analyst_watch.service import watch_lifespan
from .workflow import AutomationManager

@asynccontextmanager
async def automation_lifespan(app):
    async with watch_lifespan(app):
        manager=AutomationManager(app.state.analysis_manager.store.store,app.state.analysis_manager)
        manager.startup();app.state.automation_manager=manager
        try:yield
        finally:await manager.shutdown()
