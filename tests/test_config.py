from sqlalchemy.engine import make_url

from app.config import Settings


def test_sql_authentication_url_uses_sql_credentials() -> None:
    settings = Settings(
        database_url=None,
        db_host="localhost",
        db_port=1433,
        db_instance=None,
        db_name="MyGateSociety",
        db_authentication="sql",
        db_user="sa",
        db_password="SecretPassword!",
        db_driver="ODBC Driver 18 for SQL Server",
        db_trust_server_certificate="yes",
    )

    url = make_url(settings.sqlalchemy_database_url)

    assert url.drivername == "mssql+pyodbc"
    assert url.username == "sa"
    assert url.password == "SecretPassword!"
    assert url.host == "localhost"
    assert url.port == 1433
    assert url.database == "MyGateSociety"
    assert url.query["driver"] == "ODBC Driver 18 for SQL Server"
    assert url.query["TrustServerCertificate"] == "yes"
    assert "Trusted_Connection" not in url.query


def test_windows_authentication_url_uses_named_instance_and_trusted_connection() -> None:
    settings = Settings(
        database_url=None,
        db_host="localhost",
        db_port=1433,
        db_instance="SQLEXPRESS",
        db_name="MyGateSociety",
        db_authentication="windows",
        db_user="ignored",
        db_password="ignored",
        db_driver="ODBC Driver 18 for SQL Server",
        db_trust_server_certificate="yes",
    )

    url = make_url(settings.sqlalchemy_database_url)

    assert url.drivername == "mssql+pyodbc"
    assert url.username is None
    assert url.password is None
    assert url.host == "localhost\\SQLEXPRESS"
    assert url.port is None
    assert url.database == "MyGateSociety"
    assert url.query["driver"] == "ODBC Driver 18 for SQL Server"
    assert url.query["Trusted_Connection"] == "yes"
    assert url.query["TrustServerCertificate"] == "yes"


def test_db_server_accepts_full_ssms_named_instance() -> None:
    settings = Settings(
        database_url=None,
        db_server="ATCHYUT2026\\ATCHYUT3446",
        db_host="ignored",
        db_port=1433,
        db_instance=None,
        db_name="MyGateSociety",
        db_authentication="sql",
        db_user="sa",
        db_password="SecretPassword!",
        db_driver="ODBC Driver 18 for SQL Server",
        db_trust_server_certificate="yes",
    )

    url = make_url(settings.sqlalchemy_database_url)

    assert url.drivername == "mssql+pyodbc"
    assert url.username == "sa"
    assert url.password == "SecretPassword!"
    assert url.host == "ATCHYUT2026\\ATCHYUT3446"
    assert url.port is None
    assert url.database == "MyGateSociety"
    assert url.query["driver"] == "ODBC Driver 18 for SQL Server"
    assert url.query["TrustServerCertificate"] == "yes"
