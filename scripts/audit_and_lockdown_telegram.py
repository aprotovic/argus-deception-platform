"""Audit existing Telegram accounts and enforce administrator-only lockdown in the database."""

import asyncio
import uuid
from datetime import datetime, timezone
import sqlite3
from app.config import settings
from app.database import AsyncSessionLocal, engine, Base
from app.models.telegram_user import TelegramUser
from app.models.audit_log import AuditLog
from sqlalchemy import select


async def run_lockdown():
    # 1. Ensure table schema is created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    admin_id = settings.telegram_admin_numeric_id
    if not admin_id:
        raise RuntimeError("FAIL CLOSED: TELEGRAM_ADMIN_ID is missing or not a valid numeric ID.")

    print(f"Verified Administrator Telegram Numeric ID: {admin_id}")

    # Previously subscribed or known chat IDs to audit and revoke
    historical_ids = ["6110551799", "1145042590"]

    async with AsyncSessionLocal() as session:
        # Audit & Upsert Administrator Account
        stmt = select(TelegramUser).where(TelegramUser.telegram_id == admin_id)
        result = await session.execute(stmt)
        admin_user = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if not admin_user:
            admin_user = TelegramUser(
                id=uuid.uuid4(),
                telegram_id=admin_id,
                username="administrator",
                role="admin",
                status="approved",
                is_subscribed=True,
                registered_at=now,
                approved_by=admin_id,
                approved_at=now,
            )
            session.add(admin_user)
            print(f"Registered Admin account: {admin_id} (Role: admin, Status: approved, Subscribed: True)")
        else:
            admin_user.role = "admin"
            admin_user.status = "approved"
            admin_user.is_subscribed = True
            admin_user.approved_by = admin_id
            admin_user.approved_at = now
            admin_user.revoked_at = None
            admin_user.revoked_by = None
            print(f"Updated Admin account: {admin_id} (Role: admin, Status: approved, Subscribed: True)")

        # Audit & Revoke all non-admin accounts
        revoked_count = 0
        for non_admin_id in historical_ids:
            if non_admin_id == admin_id:
                continue

            q = select(TelegramUser).where(TelegramUser.telegram_id == non_admin_id)
            res = await session.execute(q)
            user_obj = res.scalar_one_or_none()

            if not user_obj:
                user_obj = TelegramUser(
                    id=uuid.uuid4(),
                    telegram_id=non_admin_id,
                    username=None,
                    role="user",
                    status="revoked",
                    is_subscribed=False,
                    registered_at=now,
                    revoked_by=admin_id,
                    revoked_at=now,
                )
                session.add(user_obj)
            else:
                user_obj.role = "user"
                user_obj.status = "revoked"
                user_obj.is_subscribed = False
                user_obj.revoked_by = admin_id
                user_obj.revoked_at = now

            revoked_count += 1
            print(f"Revoked non-admin Telegram ID: {non_admin_id} (Status: revoked, Subscribed: False)")

        # Revoke any other user in the database who is not the admin
        all_q = select(TelegramUser).where(TelegramUser.telegram_id != admin_id)
        all_res = await session.execute(all_q)
        for other_user in all_res.scalars().all():
            if other_user.telegram_id not in historical_ids:
                other_user.status = "revoked"
                other_user.is_subscribed = False
                other_user.revoked_by = admin_id
                other_user.revoked_at = now
                revoked_count += 1
                print(f"Revoked existing database Telegram user: {other_user.telegram_id}")

        # Record audit log entry
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            user_id=None,
            action="TELEGRAM_SECURITY_LOCKDOWN",
            target_type="TELEGRAM_ACCESS_CONTROL",
            target_id=admin_id,
            ip_address="127.0.0.1",
            user_agent="ARGUS_INTERNAL_LOCKDOWN",
            details={
                "admin_id": admin_id,
                "accounts_revoked": revoked_count,
                "action": "Administrator lockdown enforced. Non-admin users revoked.",
                "timestamp": now.isoformat(),
            },
            timestamp=now,
        )
        session.add(audit_entry)

        await session.commit()
        print(f"Lockdown complete. Total non-admin accounts revoked: {revoked_count}")


if __name__ == "__main__":
    asyncio.run(run_lockdown())
