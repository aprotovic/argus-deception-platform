"""Database seeding script for initializing administrative users and default decoy service."""

import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select
from app.config import settings
from app.core.security import hash_password
from app.database import AsyncSessionLocal, Base, engine
from app.models.decoy_service import DecoyService
from app.models.user import User


async def seed():
    print("[*] Starting ARGUS database seeding...")
    
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed Administrator
        stmt = select(User).where(User.username == settings.ADMIN_USERNAME)
        res = await session.execute(stmt)
        admin = res.scalar_one_or_none()
        
        if not admin:
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            print(f"[+] Created Administrator user: {settings.ADMIN_USERNAME}")
        else:
            print(f"[*] Administrator user {settings.ADMIN_USERNAME} already exists.")

        # 2. Seed SOC Analyst
        analyst_name = "analyst"
        stmt = select(User).where(User.username == analyst_name)
        res = await session.execute(stmt)
        analyst = res.scalar_one_or_none()
        
        if not analyst:
            analyst = User(
                username=analyst_name,
                email="analyst@argus-defense.local",
                hashed_password=hash_password(settings.ANALYST_PASSWORD),
                role="analyst",
                is_active=True,
            )
            session.add(analyst)
            print(f"[+] Created SOC Analyst user: {analyst_name}")

        # 3. Seed Default Decoy Service Profile
        stmt = select(DecoyService).where(DecoyService.name == "Nexis Defense Core Portal")
        res = await session.execute(stmt)
        decoy = res.scalar_one_or_none()

        if not decoy:
            decoy = DecoyService(
                name="Nexis Defense Core Portal",
                portal_type="defense_contractor_portal",
                description="Simulated perimeter portal for contractor credential trapping and diagnostic quarantine.",
                port=8080,
                banner_title="Nexis Cloud Infrastructure & Defense Systems",
                config_metadata={"theme": "dark_tactical", "version": "4.2.1-sec"},
            )
            session.add(decoy)
            print(f"[+] Created Default Decoy Profile: {decoy.name}")

        await session.commit()
    
    await engine.dispose()
    print("[OK] Seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
