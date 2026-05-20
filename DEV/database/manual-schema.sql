IF DB_ID('JiraHubDb') IS NULL
BEGIN
    CREATE DATABASE JiraHubDb;
END
GO

USE JiraHubDb;
GO

IF OBJECT_ID('dbo.TicketCommentMentions', 'U') IS NOT NULL DROP TABLE dbo.TicketCommentMentions;
IF OBJECT_ID('dbo.TicketComments', 'U') IS NOT NULL DROP TABLE dbo.TicketComments;
IF OBJECT_ID('dbo.ImportBatchErrors', 'U') IS NOT NULL DROP TABLE dbo.ImportBatchErrors;
IF OBJECT_ID('dbo.ImportBatches', 'U') IS NOT NULL DROP TABLE dbo.ImportBatches;
IF OBJECT_ID('dbo.AppUsers', 'U') IS NOT NULL DROP TABLE dbo.AppUsers;
IF OBJECT_ID('dbo.Tickets', 'U') IS NOT NULL DROP TABLE dbo.Tickets;
GO

CREATE TABLE dbo.Tickets (
    TicketId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TicketKey NVARCHAR(100) NOT NULL UNIQUE,
    Platform NVARCHAR(255) NULL,
    VersionFound NVARCHAR(255) NULL,
    BuildFixed NVARCHAR(255) NULL,
    Functionality NVARCHAR(255) NULL,
    IssueTitle NVARCHAR(MAX) NULL,
    Summary NVARCHAR(MAX) NULL,
    SourceInternalComments NVARCHAR(MAX) NULL,
    LastImportedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.AppUsers (
    UserId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DisplayName NVARCHAR(255) NOT NULL,
    Email NVARCHAR(255) NULL,
    Username NVARCHAR(255) NOT NULL UNIQUE,
    Role NVARCHAR(50) NOT NULL DEFAULT 'END USER',
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.TicketComments (
    CommentId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TicketId INT NOT NULL,
    CommentText NVARCHAR(MAX) NOT NULL,
    CommentHtml NVARCHAR(MAX) NULL,
    CommentAuthorContact NVARCHAR(255) NULL,
    CreatedByUserId INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    IsPinned BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_TicketComments_Tickets FOREIGN KEY (TicketId) REFERENCES dbo.Tickets(TicketId) ON DELETE CASCADE,
    CONSTRAINT FK_TicketComments_Users FOREIGN KEY (CreatedByUserId) REFERENCES dbo.AppUsers(UserId) ON DELETE SET NULL
);
GO

CREATE TABLE dbo.TicketCommentMentions (
    MentionId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CommentId INT NOT NULL,
    MentionedUserId INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_TicketCommentMentions_Comments FOREIGN KEY (CommentId) REFERENCES dbo.TicketComments(CommentId) ON DELETE CASCADE,
    CONSTRAINT FK_TicketCommentMentions_Users FOREIGN KEY (MentionedUserId) REFERENCES dbo.AppUsers(UserId)
);
GO

CREATE TABLE dbo.ImportBatches (
    ImportBatchId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FileName NVARCHAR(500) NOT NULL,
    UploadedBy NVARCHAR(255) NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    TotalRows INT NOT NULL,
    InsertedRows INT NOT NULL,
    UpdatedRows INT NOT NULL,
    SkippedRows INT NOT NULL,
    ErrorRows INT NOT NULL
);
GO

CREATE TABLE dbo.ImportBatchErrors (
    ImportBatchErrorId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ImportBatchId INT NOT NULL,
    RowNumber INT NOT NULL,
    ErrorMessage NVARCHAR(MAX) NOT NULL,
    RawRow NVARCHAR(MAX) NULL,
    CONSTRAINT FK_ImportBatchErrors_ImportBatches FOREIGN KEY (ImportBatchId) REFERENCES dbo.ImportBatches(ImportBatchId) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Tickets_Platform ON dbo.Tickets(Platform);
CREATE INDEX IX_Tickets_Functionality ON dbo.Tickets(Functionality);
CREATE INDEX IX_Tickets_BuildFixed ON dbo.Tickets(BuildFixed);
CREATE INDEX IX_Tickets_LastImportedAt ON dbo.Tickets(LastImportedAt);
CREATE INDEX IX_TicketComments_TicketId ON dbo.TicketComments(TicketId);
CREATE INDEX IX_AppUsers_Email ON dbo.AppUsers(Email);
GO

-- v1.1 search/access performance updates
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TicketComments_TicketId_IsDeleted_CreatedAt' AND object_id = OBJECT_ID('dbo.TicketComments'))
    CREATE INDEX IX_TicketComments_TicketId_IsDeleted_CreatedAt ON dbo.TicketComments (TicketId, IsDeleted, CreatedAt DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_UpdatedAt' AND object_id = OBJECT_ID('dbo.Tickets'))
    CREATE INDEX IX_Tickets_UpdatedAt ON dbo.Tickets (UpdatedAt DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppUsers_Role' AND object_id = OBJECT_ID('dbo.AppUsers'))
    CREATE INDEX IX_AppUsers_Role ON dbo.AppUsers (Role);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TicketCommentMentions_MentionedUserId' AND object_id = OBJECT_ID('dbo.TicketCommentMentions'))
    CREATE INDEX IX_TicketCommentMentions_MentionedUserId ON dbo.TicketCommentMentions (MentionedUserId);


-- DEV update: public comments can include an optional username/email follow-up contact.
IF COL_LENGTH('dbo.TicketComments', 'CommentAuthorContact') IS NULL
    ALTER TABLE dbo.TicketComments ADD CommentAuthorContact NVARCHAR(255) NULL;
GO
