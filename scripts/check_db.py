from pathlib import Path
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402


def main() -> int:
    settings = get_settings()
    url = make_url(settings.sqlalchemy_database_url)

    print("Checking database connection...")
    print(f"Driver: {url.query.get('driver', 'not set')}")
    print(f"Authentication: {settings.db_authentication}")
    print(f"DB_SERVER: {settings.db_server or 'not set'}")
    print(f"DB_INSTANCE: {settings.db_instance or 'not set'}")
    print(f"Host: {url.host or 'not set'}")
    print(f"Port: {url.port or 'default/named instance'}")
    print(f"Database: {url.database or 'not set'}")

    try:
        import pyodbc

        print(f"Installed ODBC drivers: {', '.join(pyodbc.drivers()) or 'none found'}")
    except Exception as exc:
        print(f"Could not list ODBC drivers: {exc}")

    try:
        engine = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            if url.drivername.startswith("mssql"):
                row = connection.execute(text("SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name")).one()
                print(f"Connected server: {row.server_name}")
                print(f"Connected database: {row.database_name}")
    except Exception as exc:
        print("\nDatabase connection failed.")
        print(f"Error: {exc}")
        print("\nCommon fixes:")
        print("- Confirm the SQL Server service is running.")
        print("- Confirm DB_SERVER or DB_HOST/DB_INSTANCE matches the Server name shown in SSMS.")
        print("- Confirm the ODBC driver in DB_DRIVER is installed.")
        print("- If using localhost:1433, enable TCP/IP for SQL Server and restart the service.")
        print("- If the password contains # or special characters, wrap it in double quotes in .env.")
        return 1

    print("\nDatabase connection OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
