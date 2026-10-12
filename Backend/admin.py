from pwdlib import PasswordHash
from database import get_database_connection

password_hash = PasswordHash.recommended()

username = "admin"
password = "admin123"
role = "admin"

hashed_password = password_hash.hash(password)

connection = get_database_connection()
cursor = connection.cursor()

sql = """
INSERT INTO users (username, password, role)
VALUES (%s, %s, %s)
"""

values = (username, hashed_password, role)

cursor.execute(sql, values)

connection.commit()

cursor.close()
connection.close()

print("Admin created successfully")