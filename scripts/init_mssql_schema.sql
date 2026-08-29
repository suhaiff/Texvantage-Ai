-- =====================================================================
-- TexVantage AI - Microsoft SQL Server Database Schema Definition
-- Compatible with SQL Server 2016, 2017, 2019, 2022 & Azure SQL
-- =====================================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'texvantage')
BEGIN
    CREATE DATABASE texvantage;
END
GO

USE texvantage;
GO

-- 1. COMPANIES TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'companies')
BEGIN
    CREATE TABLE companies (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        specialization NVARCHAR(150) NOT NULL,
        city NVARCHAR(100) NOT NULL,
        state NVARCHAR(100) NOT NULL DEFAULT 'India',
        founded_year INT NOT NULL,
        annual_capacity_description NVARCHAR(200) NOT NULL DEFAULT '',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX uq_companies_code ON companies(code);
END
GO

-- 2. USERS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        email NVARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'OWNER',
        company_id VARCHAR(50) NULL,
        job_title NVARCHAR(100) NOT NULL DEFAULT 'Executive',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX uq_users_email ON users(email);
    CREATE INDEX idx_users_company_id ON users(company_id);
END
GO

-- 3. DATASETS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'datasets')
BEGIN
    CREATE TABLE datasets (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        company_id VARCHAR(50) NOT NULL,
        uploaded_by VARCHAR(50) NULL,
        filename NVARCHAR(255) NOT NULL,
        original_filename NVARCHAR(255) NOT NULL,
        file_format VARCHAR(20) NOT NULL,
        file_type VARCHAR(20) NOT NULL DEFAULT 'CSV',
        file_size INT NOT NULL DEFAULT 0,
        file_size_bytes INT NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
        record_count INT NOT NULL DEFAULT 0,
        dataset_name NVARCHAR(150) NOT NULL,
        description NVARCHAR(MAX) NULL,
        uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        processed_at DATETIME2 NULL,
        error_message NVARCHAR(MAX) NULL,
        date_range_start DATE NULL,
        date_range_end DATE NULL,
        stored_path NVARCHAR(500) NULL,
        mapping_config NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_datasets_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_datasets_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_datasets_company_id ON datasets(company_id);
END
GO

-- 4. DATASET COLUMNS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'dataset_columns')
BEGIN
    CREATE TABLE dataset_columns (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        dataset_id VARCHAR(50) NOT NULL,
        column_name NVARCHAR(100) NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        suggested_field VARCHAR(100) NULL,
        sample_value NVARCHAR(255) NULL,
        CONSTRAINT fk_dataset_columns_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_dataset_columns_dataset_id ON dataset_columns(dataset_id);
END
GO

-- 5. MONTHLY FINANCIALS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'monthly_financials')
BEGIN
    CREATE TABLE monthly_financials (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        company_id VARCHAR(50) NOT NULL,
        dataset_id VARCHAR(50) NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        period_date DATE NOT NULL,
        month_name VARCHAR(20) NOT NULL,
        revenue_lakh FLOAT NOT NULL,
        cogs_lakh FLOAT NULL,
        gross_profit_lakh FLOAT NULL,
        profit_margin_pct FLOAT NULL,
        operating_expenses_lakh FLOAT NULL,
        net_profit_lakh FLOAT NULL,
        units_produced INT NULL,
        units_sold INT NULL,
        orders_count INT NULL,
        avg_order_value_inr FLOAT NULL,
        capacity_utilization_pct FLOAT NULL,
        raw_material_cost_lakh FLOAT NULL,
        energy_cost_lakh FLOAT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_financials_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_financials_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL,
        CONSTRAINT uq_company_year_month UNIQUE (company_id, year, month)
    );
    CREATE INDEX idx_company_period ON monthly_financials(company_id, period_date);
    CREATE INDEX idx_financials_dataset ON monthly_financials(dataset_id);
END
GO

-- 6. PRODUCT METRICS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_metrics')
BEGIN
    CREATE TABLE product_metrics (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        company_id VARCHAR(50) NOT NULL,
        dataset_id VARCHAR(50) NULL,
        category_name NVARCHAR(100) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        sales_volume_units FLOAT NULL,
        unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'kg',
        revenue_lakh FLOAT NOT NULL,
        profit_margin_pct FLOAT NULL,
        top_customer_segment NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_products_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_product_company_date ON product_metrics(company_id, year, month);
    CREATE INDEX idx_product_dataset ON product_metrics(dataset_id);
END
GO

-- 7. CONVERSATIONS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'conversations')
BEGIN
    CREATE TABLE conversations (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        company_id VARCHAR(50) NULL,
        title NVARCHAR(255) NOT NULL DEFAULT 'New Conversation',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX idx_conversations_company_id ON conversations(company_id);
END
GO

-- 8. MESSAGES TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'messages')
BEGIN
    CREATE TABLE messages (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL,
        sender_role VARCHAR(20) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        thinking_steps_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
END
GO

-- 9. ARTIFACTS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'artifacts')
BEGIN
    CREATE TABLE artifacts (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        company_id VARCHAR(50) NULL,
        artifact_type VARCHAR(30) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        filename NVARCHAR(255) NULL,
        mime_type VARCHAR(100) NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        file_path NVARCHAR(500) NULL,
        payload_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_artifacts_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_artifacts_company_id ON artifacts(company_id);
END
GO

-- 10. MESSAGE ARTIFACTS (JUNCTION) TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'message_artifacts')
BEGIN
    CREATE TABLE message_artifacts (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        message_id VARCHAR(50) NOT NULL,
        artifact_id VARCHAR(50) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        CONSTRAINT fk_msg_art_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_art_artifact FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_msg_art_message_id ON message_artifacts(message_id);
    CREATE INDEX idx_msg_art_artifact_id ON message_artifacts(artifact_id);
END
GO

-- 11. AUDIT LOGS TABLE
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
BEGIN
    CREATE TABLE audit_logs (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NULL,
        company_id VARCHAR(50) NULL,
        action VARCHAR(100) NOT NULL,
        endpoint NVARCHAR(200) NOT NULL,
        ip_address VARCHAR(50) NULL,
        details NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
    CREATE INDEX idx_audit_company_id ON audit_logs(company_id);
END
GO
