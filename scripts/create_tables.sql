IF DB_ID(N'MyGateSociety') IS NULL
BEGIN
    CREATE DATABASE MyGateSociety;
END;
GO

USE MyGateSociety;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.units', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.units (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_units PRIMARY KEY,
        tower NVARCHAR(50) NOT NULL,
        flat_number NVARCHAR(30) NOT NULL,
        floor INT NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_units_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_units_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT uq_units_tower_flat UNIQUE (tower, flat_number)
    );
END;
GO

IF OBJECT_ID(N'dbo.gates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.gates (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_gates PRIMARY KEY,
        name NVARCHAR(80) NOT NULL CONSTRAINT uq_gates_name UNIQUE,
        is_active BIT NOT NULL CONSTRAINT df_gates_is_active DEFAULT 1,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_gates_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_gates_updated_at DEFAULT SYSDATETIMEOFFSET()
    );
END;
GO

IF OBJECT_ID(N'dbo.residents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.residents (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_residents PRIMARY KEY,
        unit_id INT NOT NULL,
        name NVARCHAR(120) NOT NULL,
        phone NVARCHAR(30) NOT NULL CONSTRAINT uq_residents_phone UNIQUE,
        email NVARCHAR(255) NULL,
        role NVARCHAR(30) NOT NULL CONSTRAINT df_residents_role DEFAULT N'member',
        is_active BIT NOT NULL CONSTRAINT df_residents_is_active DEFAULT 1,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_residents_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_residents_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_residents_units FOREIGN KEY (unit_id) REFERENCES dbo.units (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.security_guards', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.security_guards (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_security_guards PRIMARY KEY,
        gate_id INT NOT NULL,
        name NVARCHAR(120) NOT NULL,
        phone NVARCHAR(30) NOT NULL CONSTRAINT uq_security_guards_phone UNIQUE,
        employee_code NVARCHAR(50) NOT NULL CONSTRAINT uq_security_guards_employee_code UNIQUE,
        is_active BIT NOT NULL CONSTRAINT df_security_guards_is_active DEFAULT 1,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_security_guards_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_security_guards_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_security_guards_gates FOREIGN KEY (gate_id) REFERENCES dbo.gates (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.visitors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.visitors (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_visitors PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        phone NVARCHAR(30) NOT NULL CONSTRAINT uq_visitors_phone UNIQUE,
        visitor_type NVARCHAR(40) NOT NULL CONSTRAINT df_visitors_visitor_type DEFAULT N'guest',
        company NVARCHAR(120) NULL,
        vehicle_number NVARCHAR(30) NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visitors_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visitors_updated_at DEFAULT SYSDATETIMEOFFSET()
    );
END;
GO

IF OBJECT_ID(N'dbo.visit_invitations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.visit_invitations (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_visit_invitations PRIMARY KEY,
        code NVARCHAR(20) NOT NULL CONSTRAINT uq_visit_invitations_code UNIQUE,
        unit_id INT NOT NULL,
        resident_id INT NOT NULL,
        visitor_id INT NOT NULL,
        purpose NVARCHAR(255) NOT NULL,
        valid_from DATETIMEOFFSET(7) NOT NULL,
        valid_until DATETIMEOFFSET(7) NOT NULL,
        status NVARCHAR(30) NOT NULL CONSTRAINT df_visit_invitations_status DEFAULT N'approved',
        notes NVARCHAR(MAX) NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visit_invitations_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visit_invitations_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_visit_invitations_units FOREIGN KEY (unit_id) REFERENCES dbo.units (id),
        CONSTRAINT fk_visit_invitations_residents FOREIGN KEY (resident_id) REFERENCES dbo.residents (id),
        CONSTRAINT fk_visit_invitations_visitors FOREIGN KEY (visitor_id) REFERENCES dbo.visitors (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.visit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.visit_logs (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_visit_logs PRIMARY KEY,
        invitation_id INT NULL,
        visitor_id INT NOT NULL,
        unit_id INT NOT NULL,
        gate_id INT NOT NULL,
        guard_id INT NOT NULL,
        purpose NVARCHAR(255) NOT NULL,
        status NVARCHAR(30) NOT NULL CONSTRAINT df_visit_logs_status DEFAULT N'pending',
        resident_decision_by INT NULL,
        resident_decision_at DATETIMEOFFSET(7) NULL,
        checked_in_at DATETIMEOFFSET(7) NULL,
        checked_out_at DATETIMEOFFSET(7) NULL,
        denial_reason NVARCHAR(MAX) NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visit_logs_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_visit_logs_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_visit_logs_visit_invitations FOREIGN KEY (invitation_id) REFERENCES dbo.visit_invitations (id),
        CONSTRAINT fk_visit_logs_visitors FOREIGN KEY (visitor_id) REFERENCES dbo.visitors (id),
        CONSTRAINT fk_visit_logs_units FOREIGN KEY (unit_id) REFERENCES dbo.units (id),
        CONSTRAINT fk_visit_logs_gates FOREIGN KEY (gate_id) REFERENCES dbo.gates (id),
        CONSTRAINT fk_visit_logs_security_guards FOREIGN KEY (guard_id) REFERENCES dbo.security_guards (id),
        CONSTRAINT fk_visit_logs_resident_decision_by FOREIGN KEY (resident_decision_by) REFERENCES dbo.residents (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.deliveries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.deliveries (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_deliveries PRIMARY KEY,
        unit_id INT NOT NULL,
        resident_id INT NULL,
        courier_name NVARCHAR(120) NOT NULL,
        tracking_number NVARCHAR(120) NULL,
        otp_code NVARCHAR(20) NULL,
        status NVARCHAR(30) NOT NULL CONSTRAINT df_deliveries_status DEFAULT N'waiting_at_gate',
        received_at DATETIMEOFFSET(7) NULL,
        notes NVARCHAR(MAX) NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_deliveries_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_deliveries_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_deliveries_units FOREIGN KEY (unit_id) REFERENCES dbo.units (id),
        CONSTRAINT fk_deliveries_residents FOREIGN KEY (resident_id) REFERENCES dbo.residents (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.complaints', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.complaints (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_complaints PRIMARY KEY,
        unit_id INT NOT NULL,
        resident_id INT NOT NULL,
        title NVARCHAR(160) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(60) NOT NULL CONSTRAINT df_complaints_category DEFAULT N'general',
        status NVARCHAR(30) NOT NULL CONSTRAINT df_complaints_status DEFAULT N'open',
        assigned_to NVARCHAR(120) NULL,
        resolved_at DATETIMEOFFSET(7) NULL,
        created_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_complaints_created_at DEFAULT SYSDATETIMEOFFSET(),
        updated_at DATETIMEOFFSET(7) NOT NULL CONSTRAINT df_complaints_updated_at DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT fk_complaints_units FOREIGN KEY (unit_id) REFERENCES dbo.units (id),
        CONSTRAINT fk_complaints_residents FOREIGN KEY (resident_id) REFERENCES dbo.residents (id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_residents_unit_id' AND object_id = OBJECT_ID(N'dbo.residents'))
    CREATE INDEX ix_residents_unit_id ON dbo.residents (unit_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_security_guards_gate_id' AND object_id = OBJECT_ID(N'dbo.security_guards'))
    CREATE INDEX ix_security_guards_gate_id ON dbo.security_guards (gate_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_visit_invitations_unit_id' AND object_id = OBJECT_ID(N'dbo.visit_invitations'))
    CREATE INDEX ix_visit_invitations_unit_id ON dbo.visit_invitations (unit_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_visit_logs_unit_status' AND object_id = OBJECT_ID(N'dbo.visit_logs'))
    CREATE INDEX ix_visit_logs_unit_status ON dbo.visit_logs (unit_id, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_deliveries_unit_status' AND object_id = OBJECT_ID(N'dbo.deliveries'))
    CREATE INDEX ix_deliveries_unit_status ON dbo.deliveries (unit_id, status);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_complaints_unit_status' AND object_id = OBJECT_ID(N'dbo.complaints'))
    CREATE INDEX ix_complaints_unit_status ON dbo.complaints (unit_id, status);
GO
