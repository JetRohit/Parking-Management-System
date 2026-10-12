import mysql.connector
def get_database_connection():
    connection = mysql.connector.connect(
        host = "localhost",
        user = "root",
        password = "2001",
        database = "parking_management_system"
    )
    return connection
