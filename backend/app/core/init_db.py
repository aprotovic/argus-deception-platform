"""Database initialization and default seeding logic."""

from sqlalchemy import select, text
from app.config import settings
from app.core.security import hash_password
from app.database import AsyncSessionLocal
from app.logging_config import logger
from app.models.decoy_service import DecoyService
from app.models.user import User


async def init_default_data() -> None:
    """Ensure default administrator, analyst, and decoy services exist in the database."""
    try:
        async with AsyncSessionLocal() as session:
            # 0. Safe schema update for user lockout and reset token columns
            for col, col_def in [
                ("failed_login_attempts", "INTEGER DEFAULT 0"),
                ("locked_until", "DATETIME"),
                ("reset_token", "VARCHAR(128)"),
                ("reset_token_expires_at", "DATETIME"),
            ]:
                try:
                    await session.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_def}"))
                    await session.commit()
                except Exception:
                    # Column already exists or table freshly created
                    await session.rollback()

            # 1. Administrator user
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
                logger.info(f"Auto-seeded Administrator user: {settings.ADMIN_USERNAME}")

            # 2. SOC Analyst user
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
                logger.info(f"Auto-seeded SOC Analyst user: {analyst_name}")

            # 3. Default Decoy Service Profile
            stmt = select(DecoyService).where(DecoyService.name == "Nexis Defense Core Portal")
            res = await session.execute(stmt)
            decoy = res.scalars().first()
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
                logger.info(f"Auto-seeded Default Decoy Profile: {decoy.name}")

            await session.commit()
    except Exception as e:
        logger.error(f"Error during default database initialization: {e}")
