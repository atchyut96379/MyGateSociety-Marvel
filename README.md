# MyGate Society

A deployable MyGate-style society management API built with Python, FastAPI, SQLAlchemy, and SQL Server.

## Implemented workflows

- Admin setup for towers/flats, gates, and security guards
- Resident registration by flat/unit
- Resident-created visitor invitations with generated gate codes
- Security check-in for pre-approved visitors
- Manual visitor entry that waits for resident approval or denial
- Visitor check-out at the gate
- Delivery entry, OTP validation, and resident handoff
- Resident complaint creation and maintenance status tracking
- Health endpoint for cloud load balancers

## Tech stack

- Python 3.11+
- FastAPI
- SQLAlchemy
- SQL Server through `mssql+pyodbc`
- Docker and Docker Compose

## Local setup

1. Create an environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows Command Prompt, use:

   ```cmd
   copy .env.example .env
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start the API and SQL Server:

   ```bash
   docker compose up --build
   ```

   If Docker reports that it cannot connect to `dockerDesktopLinuxEngine`, open Docker Desktop and wait
   until it says the engine is running. You can confirm Docker is ready with:

   ```cmd
   docker version
   docker info
   ```

3. Open the API documentation:

   - Swagger UI: <http://localhost:8000/docs>
   - Health check: <http://localhost:8000/health>

The app creates database tables on startup when `AUTO_CREATE_TABLES=true`.

## Run without Docker

Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

On Windows Command Prompt:

```cmd
py -3 -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

On Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

Point the app at SQL Server using either `DATABASE_URL` or the `DB_*` variables in `.env`, then run:

```bash
uvicorn app.main:app --reload
```

For a quick local smoke test without SQL Server, use SQLite:

```cmd
set DATABASE_URL=sqlite+pysqlite:///./local-dev.db
set AUTO_CREATE_TABLES=true
uvicorn app.main:app --reload
```

PowerShell equivalent:

```powershell
$env:DATABASE_URL = "sqlite+pysqlite:///./local-dev.db"
$env:AUTO_CREATE_TABLES = "true"
uvicorn app.main:app --reload
```

## SQL Server configuration

You can provide one full URL:

```env
DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@localhost:1433/MyGateSociety?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
```

Or provide components:

```env
DB_HOST=localhost
DB_PORT=1433
DB_NAME=MyGateSociety
DB_USER=sa
DB_PASSWORD=YourStrong!Passw0rd
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUST_SERVER_CERTIFICATE=yes
```

## Common API flow

1. `POST /api/units` to create a flat.
2. `POST /api/residents` to add residents to the flat.
3. `POST /api/gates` and `POST /api/guards` for security setup.
4. `POST /api/invitations` to pre-approve a visitor.
5. `POST /api/security/check-in` with the invitation code at the gate.
6. `POST /api/visits/{visit_id}/checkout` when the visitor exits.

For an unplanned visitor, call `POST /api/security/check-in` with visitor details and no invitation code. The visit is created as `pending`; a resident then calls `POST /api/visits/{visit_id}/decision`.

## Tests

The test suite uses SQLite in memory for fast workflow coverage while the application remains configured for SQL Server in deployment.

```bash
pytest
```

## Cloud deployment notes

- Build from the included `Dockerfile`.
- Set `DATABASE_URL` or the `DB_*` variables in the cloud environment.
- Ensure the cloud image includes Microsoft ODBC Driver 18. The included Dockerfile installs it.
- Keep `AUTO_CREATE_TABLES=true` for initial deployment. For production migration control, turn it off and add Alembic migrations.
