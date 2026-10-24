"""Integration tests for user profile updates and admin user management."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_profile_update_and_password_change(client: AsyncClient):
    # Log in as test_analyst
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_analyst", "password": "AnalystPass123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update own profile
    update_res = await client.put(
        "/api/v1/users/me",
        json={"username": "analyst_updated", "email": "analyst_updated@argus.local"},
        headers=headers,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["username"] == "analyst_updated"
    assert updated_data["email"] == "analyst_updated@argus.local"

    # 2. Change password with incorrect current password -> fails
    bad_pw = await client.put(
        "/api/v1/users/me/password",
        json={"current_password": "WrongPassword", "new_password": "NewSecret123!", "confirm_password": "NewSecret123!"},
        headers=headers,
    )
    assert bad_pw.status_code == 400

    # 3. Change password with mismatched confirmation -> fails
    mismatch_pw = await client.put(
        "/api/v1/users/me/password",
        json={"current_password": "AnalystPass123!", "new_password": "NewSecret123!", "confirm_password": "DifferentSecret!"},
        headers=headers,
    )
    assert mismatch_pw.status_code == 400

    # 4. Valid password change
    good_pw = await client.put(
        "/api/v1/users/me/password",
        json={"current_password": "AnalystPass123!", "new_password": "NewSecret123!", "confirm_password": "NewSecret123!"},
        headers=headers,
    )
    assert good_pw.status_code == 200

    # 5. Log in with new credentials
    relogin = await client.post(
        "/api/v1/auth/login",
        json={"username": "analyst_updated", "password": "NewSecret123!"},
    )
    assert relogin.status_code == 200


@pytest.mark.asyncio
async def test_admin_user_crud_and_rbac(client: AsyncClient):
    # Log in as test_admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List users
    users_res = await client.get("/api/v1/users", headers=admin_headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 1

    # 2. Create new analyst
    create_res = await client.post(
        "/api/v1/users",
        json={
            "username": "new_soc_analyst",
            "email": "new_soc@argus.local",
            "password": "SecurePassword123!",
            "role": "analyst",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    created_user = create_res.json()
    new_user_id = created_user["id"]
    assert created_user["role"] == "analyst"

    # 3. Non-admin cannot create or list users
    analyst_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "new_soc_analyst", "password": "SecurePassword123!"},
    )
    analyst_token = analyst_login.json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    forbidden_list = await client.get("/api/v1/users", headers=analyst_headers)
    assert forbidden_list.status_code == 403

    forbidden_create = await client.post(
        "/api/v1/users",
        json={"username": "hacker", "email": "hacker@evil.com", "password": "password123", "role": "admin"},
        headers=analyst_headers,
    )
    assert forbidden_create.status_code == 403

    # 4. Admin updates user role to admin
    role_res = await client.put(
        f"/api/v1/users/{new_user_id}/role",
        json={"role": "admin"},
        headers=admin_headers,
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "admin"

    # 5. Admin deactivates user
    status_res = await client.put(
        f"/api/v1/users/{new_user_id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["is_active"] is False

    # Deactivated user cannot log in
    deactivated_login = await client.post(
        "/api/v1/auth/login",
        json={"username": "new_soc_analyst", "password": "SecurePassword123!"},
    )
    assert deactivated_login.status_code == 403

    # 6. Admin deletes user
    del_res = await client.delete(f"/api/v1/users/{new_user_id}", headers=admin_headers)
    assert del_res.status_code == 204
