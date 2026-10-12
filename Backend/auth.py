import os

import jwt
from dotenv import load_dotenv
from fastapi import HTTPException, Request


load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"


def get_authenticated_user(request: Request):
    token = request.cookies.get("access_token")

    if token is None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


def require_admin(request: Request):
    user = get_authenticated_user(request)

    if user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return user


def require_employee(request: Request):
    user = get_authenticated_user(request)

    if user["role"] != "employee":
        raise HTTPException(
            status_code=403,
            detail="Employee access required"
        )

    return user


def require_user(request: Request):
    user = get_authenticated_user(request)

    if user["role"] != "user":
        raise HTTPException(
            status_code=403,
            detail="User access required"
        )

    return user