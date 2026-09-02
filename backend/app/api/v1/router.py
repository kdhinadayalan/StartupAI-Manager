from fastapi import APIRouter

from app.api.v1 import auth, workspaces, projects, tasks, ai, finance, marketing, research, risks, dashboard, notifications

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(projects.router)
api_router.include_router(tasks.router)
api_router.include_router(ai.router)
api_router.include_router(finance.router)
api_router.include_router(marketing.router)
api_router.include_router(research.router)
api_router.include_router(risks.router)
api_router.include_router(dashboard.router)
api_router.include_router(notifications.router)
