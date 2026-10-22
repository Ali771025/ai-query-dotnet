using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiQuery.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase08KnowledgeLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_knowledge_snapshots_state",
                schema: "app",
                table: "knowledge_snapshots");

            migrationBuilder.DropIndex(
                name: "i_x_ingestion_jobs_state_next_attempt_at_utc",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.Sql("UPDATE app.knowledge_snapshots SET state = 'Processing' WHERE state = 'Ingesting'; UPDATE app.knowledge_snapshots SET state = 'Failed' WHERE state = 'IngestionFailed';");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "created_at_utc",
                schema: "app",
                table: "knowledge_snapshots",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "manifest_hash",
                schema: "app",
                table: "knowledge_snapshots",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "cancelled_at_utc",
                schema: "app",
                table: "ingestion_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "completed_at_utc",
                schema: "app",
                table: "ingestion_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_error_code",
                schema: "app",
                table: "ingestion_jobs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "lease_owner",
                schema: "app",
                table: "ingestion_jobs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "progress",
                schema: "app",
                table: "ingestion_jobs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "result_hash",
                schema: "app",
                table: "ingestion_jobs",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "started_at_utc",
                schema: "app",
                table: "ingestion_jobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                schema: "app",
                table: "file_revisions",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "media_type",
                schema: "app",
                table: "file_revisions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "application/octet-stream");

            migrationBuilder.CreateIndex(
                name: "i_x_knowledge_snapshots_software_version_id_created_at_utc",
                schema: "app",
                table: "knowledge_snapshots",
                columns: new[] { "software_version_id", "created_at_utc" });

            migrationBuilder.AddCheckConstraint(
                name: "ck_knowledge_snapshots_state",
                schema: "app",
                table: "knowledge_snapshots",
                sql: "state IN ('Draft','Uploading','PendingProcessing','Processing','ReadyForReview','Failed','Approved','Published','Retired')");

            migrationBuilder.CreateIndex(
                name: "i_x_ingestion_jobs_state_next_attempt_at_utc_lease_expires_at_u~",
                schema: "app",
                table: "ingestion_jobs",
                columns: new[] { "state", "next_attempt_at_utc", "lease_expires_at_utc" });

            migrationBuilder.AddCheckConstraint(
                name: "ck_ingestion_jobs_progress",
                schema: "app",
                table: "ingestion_jobs",
                sql: "progress >= 0 AND progress <= 100");

            migrationBuilder.AddCheckConstraint(
                name: "ck_ingestion_jobs_state",
                schema: "app",
                table: "ingestion_jobs",
                sql: "state IN ('Pending','Processing','RetryScheduled','Completed','Failed','Cancelled')");

            migrationBuilder.CreateIndex(
                name: "i_x_file_revisions_content_hash_size_bytes",
                schema: "app",
                table: "file_revisions",
                columns: new[] { "content_hash", "size_bytes" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "i_x_knowledge_snapshots_software_version_id_created_at_utc",
                schema: "app",
                table: "knowledge_snapshots");

            migrationBuilder.DropCheckConstraint(
                name: "ck_knowledge_snapshots_state",
                schema: "app",
                table: "knowledge_snapshots");

            migrationBuilder.Sql("UPDATE app.knowledge_snapshots SET state = 'Ingesting' WHERE state IN ('Uploading','PendingProcessing','Processing'); UPDATE app.knowledge_snapshots SET state = 'IngestionFailed' WHERE state = 'Failed';");

            migrationBuilder.DropIndex(
                name: "i_x_ingestion_jobs_state_next_attempt_at_utc_lease_expires_at_u~",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropCheckConstraint(
                name: "ck_ingestion_jobs_progress",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropCheckConstraint(
                name: "ck_ingestion_jobs_state",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropIndex(
                name: "i_x_file_revisions_content_hash_size_bytes",
                schema: "app",
                table: "file_revisions");

            migrationBuilder.DropColumn(
                name: "created_at_utc",
                schema: "app",
                table: "knowledge_snapshots");

            migrationBuilder.DropColumn(
                name: "manifest_hash",
                schema: "app",
                table: "knowledge_snapshots");

            migrationBuilder.DropColumn(
                name: "cancelled_at_utc",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "completed_at_utc",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "last_error_code",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "lease_owner",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "progress",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "result_hash",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "started_at_utc",
                schema: "app",
                table: "ingestion_jobs");

            migrationBuilder.DropColumn(
                name: "is_active",
                schema: "app",
                table: "file_revisions");

            migrationBuilder.DropColumn(
                name: "media_type",
                schema: "app",
                table: "file_revisions");

            migrationBuilder.AddCheckConstraint(
                name: "ck_knowledge_snapshots_state",
                schema: "app",
                table: "knowledge_snapshots",
                sql: "state IN ('Draft','Ingesting','IngestionFailed','ReadyForReview','Approved','Published','Retired')");

            migrationBuilder.CreateIndex(
                name: "i_x_ingestion_jobs_state_next_attempt_at_utc",
                schema: "app",
                table: "ingestion_jobs",
                columns: new[] { "state", "next_attempt_at_utc" });
        }
    }
}
