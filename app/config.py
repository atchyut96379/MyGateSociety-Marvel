from functools import lru_cache

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
    db_name: str = "MyGateSociety"
    db_user: str = "sa"
    db_password: str = Field(default="YourStrong!Passw0rd", repr=False)
    db_driver: str = "ODBC Driver 18 for SQL Server"
    db_trust_server_certificate: str = "yes"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url

        return URL.create(
            "mssql+pyodbc",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            query={
                "driver": self.db_driver,
                "TrustServerCertificate": self.db_trust_server_certificate,
            },
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
