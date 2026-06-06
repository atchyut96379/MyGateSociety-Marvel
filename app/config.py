from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    app_name: str = "MyGate Society API"
    app_env: str = "development"
    auto_create_tables: bool = True

    database_url: str | None = None
    db_host: str = "localhost"
    db_port: int = 1433
    db_instance: str | None = None
    db_name: str = "MyGateSociety"
    db_authentication: Literal["sql", "windows"] = "sql"
    db_user: str = "sa"
    db_password: str = Field(default="YourStrong!Passw0rd", repr=False)
    db_driver: str = "ODBC Driver 18 for SQL Server"
    db_trust_server_certificate: str = "yes"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url

        host = self.db_host
        port: int | None = self.db_port
        if self.db_instance:
            host = f"{host}\\{self.db_instance}"
            port = None

        query = {
            "driver": self.db_driver,
            "TrustServerCertificate": self.db_trust_server_certificate,
        }
        username: str | None = self.db_user
        password: str | None = self.db_password
        if self.db_authentication == "windows":
            query["Trusted_Connection"] = "yes"
            username = None
            password = None

        return URL.create(
            "mssql+pyodbc",
            username=username,
            password=password,
            host=host,
            port=port,
            database=self.db_name,
            query=query,
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
