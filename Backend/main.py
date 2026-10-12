from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pwdlib import PasswordHash

from auth import (
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    get_authenticated_user,
    require_admin,
)

from database import get_database_connection

from routes.parking import router as parking_router
from routes.slot_management import router as slot_management_router
from routes.bookings import router as bookings_router


# ========================================
# FASTAPI APPLICATION
# ========================================

app = FastAPI()


# ========================================
# CORS CONFIGURATION
# ========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# ROUTERS
# ========================================

app.include_router(parking_router)
app.include_router(slot_management_router)
app.include_router(bookings_router)


# ========================================
# PASSWORD HASHING
# ========================================

password_hash = PasswordHash.recommended()


# ========================================
# REQUEST MODELS
# ========================================

class LoginRequest(BaseModel):
    username: str
    password: str


class EmployeeCreate(BaseModel):
    username: str
    password: str


class UserRegister(BaseModel):
    username: str
    password: str


# ========================================
# USER REGISTRATION
# ========================================

@app.post("/register")
def register_user(data: UserRegister):

    username = data.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username is required"
        )

    if not data.password:
        raise HTTPException(
            status_code=400,
            detail="Password is required"
        )

    hashed_password = password_hash.hash(
        data.password
    )

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users
                (username, password, role)
            VALUES
                (%s, %s, %s)
            """,
            (
                username,
                hashed_password,
                "user"
            )
        )

        connection.commit()

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    finally:
        cursor.close()
        connection.close()

    return {
        "message": "Registration successful",
        "username": username,
        "role": "user"
    }


# ========================================
# LOGIN
# ========================================

@app.post("/login")
def login(data: LoginRequest, response: Response):

    connection = get_database_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM users WHERE username = %s",
            (data.username,)
        )

        user = cursor.fetchone()

    finally:
        cursor.close()
        connection.close()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not password_hash.verify(
        data.password,
        user["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    token_data = {
        "user_id": user["id"],
        "sub": user["username"],
        "role": user["role"],
        "exp": (
            datetime.now(timezone.utc)
            + timedelta(minutes=30)
        )
    }

    token = jwt.encode(
        token_data,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=True if __import__("os").getenv("RENDER") else False,
        max_age=1800
    )

    return {
        "message": "Login successful",
        "username": user["username"],
        "role": user["role"]
    }


# ========================================
# CURRENT USER
# ========================================

@app.get("/me")
def get_current_user(request: Request):

    user = get_authenticated_user(request)

    return {
        "username": user["sub"],
        "role": user["role"]
    }


# ========================================
# LOGOUT
# ========================================

@app.post("/logout")
def logout(response: Response):

    response.delete_cookie(
        key="access_token"
    )

    return {
        "message": "Logout successful"
    }


# ========================================
# ADMIN
# ========================================

@app.get("/admin")
def admin_only(request: Request):

    user = require_admin(request)

    return {
        "message": "Welcome Admin",
        "username": user["sub"]
    }


# ========================================
# CREATE EMPLOYEE
# ========================================

@app.post("/employees")
def create_employee(
    data: EmployeeCreate,
    request: Request
):

    require_admin(request)

    hashed_password = password_hash.hash(
        data.password
    )

    connection = get_database_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users
                (username, password, role)
            VALUES
                (%s, %s, %s)
            """,
            (
                data.username,
                hashed_password,
                "employee"
            )
        )

        connection.commit()

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    finally:
        cursor.close()
        connection.close()

    return {
        "message": "Employee created successfully",
        "username": data.username,
        "role": "employee"
    }


# ========================================
# REACT FRONTEND CONFIGURATION
# ========================================

FRONTEND_DIST = (
    Path(__file__).resolve().parent.parent
    / "Frontend"
    / "dist"
)


# ========================================
# SERVE REACT STATIC FILES
# ========================================

if FRONTEND_DIST.is_dir():

    ASSETS_DIR = FRONTEND_DIST / "assets"

    if ASSETS_DIR.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=ASSETS_DIR),
            name="assets"
        )

    # ========================================
    # REACT HOME PAGE
    # ========================================

    @app.get("/", include_in_schema=False)
    def serve_frontend():

        return FileResponse(
            FRONTEND_DIST / "index.html"
        )


    # ========================================
    # REACT CLIENT-SIDE ROUTING
    # ========================================

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_react_routes(full_path: str):

        requested_file = (
            FRONTEND_DIST / full_path
        ).resolve()

        if (
            requested_file.is_relative_to(
                FRONTEND_DIST.resolve()
            )
            and requested_file.is_file()
        ):
            return FileResponse(requested_file)

        return FileResponse(
            FRONTEND_DIST / "index.html"
        )


# ========================================
# FALLBACK WHEN FRONTEND IS NOT BUILT
# ========================================

else:

    @app.get("/")
    def home():

        return {
            "message": "Parking Management System API is running",
            "frontend": "React build not found"
        }