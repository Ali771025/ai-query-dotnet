using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AiQuery.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialBusinessPersistence : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "app");

        migrationBuilder.CreateTable(
            name: "audit_events",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                event_code = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                correlation_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                actor_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                safe_metadata_json = table.Column<string>(type: "jsonb", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_audit_events", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "idempotency_records",
            schema: "app",
            columns: table => new
            {
                key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                response_type = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                response_json = table.Column<string>(type: "jsonb", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_idempotency_records", x => x.key);
            });

        migrationBuilder.CreateTable(
            name: "inbox_messages",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                consumer = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                received_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                processed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_inbox_messages", x => new { x.id, x.consumer });
            });

        migrationBuilder.CreateTable(
            name: "knowledge_files",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: false),
                logical_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_knowledge_files", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "organizations",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_organizations", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "outbox_messages",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                type = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                payload_json = table.Column<string>(type: "jsonb", nullable: false),
                processed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                attempt_count = table.Column<int>(type: "integer", nullable: false),
                next_attempt_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_outbox_messages", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "permissions",
            schema: "app",
            columns: table => new
            {
                code = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                catalog_version = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_permissions", x => x.code);
            });

        migrationBuilder.CreateTable(
            name: "roles",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                is_system = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_roles", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "security_events",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                code = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                correlation_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                safe_details_json = table.Column<string>(type: "jsonb", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_security_events", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "tariff_rules",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                unit_price = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                effective_from_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                effective_to_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_tariff_rules", x => x.id);
                table.CheckConstraint("ck_tariff_rules_price", "unit_price >= 0");
            });

        migrationBuilder.CreateTable(
            name: "users",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                external_subject = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_users", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "wallets",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                balance = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_wallets", x => x.id);
                table.CheckConstraint("ck_wallets_balance", "balance >= 0");
            });

        migrationBuilder.CreateTable(
            name: "file_revisions",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                file_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                revision_number = table.Column<int>(type: "integer", nullable: false),
                content_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                object_reference = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                size_bytes = table.Column<long>(type: "bigint", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_file_revisions", x => x.id);
                table.CheckConstraint("ck_file_revisions_number", "revision_number > 0");
                table.CheckConstraint("ck_file_revisions_size", "size_bytes >= 0");
                table.ForeignKey(
                    name: "f_k_file_revisions_knowledge_files_file_identity_id",
                    column: x => x.file_identity_id,
                    principalSchema: "app",
                    principalTable: "knowledge_files",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "api_clients",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_api_clients", x => x.id);
                table.ForeignKey(
                    name: "f_k_api_clients_organizations_organization_id",
                    column: x => x.organization_id,
                    principalSchema: "app",
                    principalTable: "organizations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "software_products",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                owner_organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_software_products", x => x.id);
                table.CheckConstraint("ck_software_products_version", "version >= 0");
                table.ForeignKey(
                    name: "f_k_software_products_organizations_owner_organization_id",
                    column: x => x.owner_organization_id,
                    principalSchema: "app",
                    principalTable: "organizations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_permissions",
            schema: "app",
            columns: table => new
            {
                role_id = table.Column<Guid>(type: "uuid", nullable: false),
                permission_code = table.Column<string>(type: "character varying(150)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_role_permissions", x => new { x.role_id, x.permission_code });
                table.ForeignKey(
                    name: "f_k_role_permissions_permissions_permission_code",
                    column: x => x.permission_code,
                    principalSchema: "app",
                    principalTable: "permissions",
                    principalColumn: "code",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_role_permissions_roles_role_id",
                    column: x => x.role_id,
                    principalSchema: "app",
                    principalTable: "roles",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "memberships",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_memberships", x => x.id);
                table.ForeignKey(
                    name: "f_k_memberships_organizations_organization_id",
                    column: x => x.organization_id,
                    principalSchema: "app",
                    principalTable: "organizations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_memberships_users_user_id",
                    column: x => x.user_id,
                    principalSchema: "app",
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "reservations",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                amount = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_reservations", x => x.id);
                table.CheckConstraint("ck_reservations_amount", "amount > 0");
                table.ForeignKey(
                    name: "f_k_reservations_wallets_wallet_id",
                    column: x => x.wallet_id,
                    principalSchema: "app",
                    principalTable: "wallets",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "api_ip_restrictions",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                api_client_id = table.Column<Guid>(type: "uuid", nullable: false),
                cidr = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_api_ip_restrictions", x => x.id);
                table.ForeignKey(
                    name: "f_k_api_ip_restrictions_api_clients_api_client_id",
                    column: x => x.api_client_id,
                    principalSchema: "app",
                    principalTable: "api_clients",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "api_keys",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                api_client_id = table.Column<Guid>(type: "uuid", nullable: false),
                prefix = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                secret_digest = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                revoked_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_api_keys", x => x.id);
                table.ForeignKey(
                    name: "f_k_api_keys_api_clients_api_client_id",
                    column: x => x.api_client_id,
                    principalSchema: "app",
                    principalTable: "api_clients",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "quotas",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                api_client_id = table.Column<Guid>(type: "uuid", nullable: true),
                limit = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                period = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_quotas", x => x.id);
                table.CheckConstraint("ck_quotas_limit", "\"limit\" >= 0");
                table.ForeignKey(
                    name: "f_k_quotas_api_clients_api_client_id",
                    column: x => x.api_client_id,
                    principalSchema: "app",
                    principalTable: "api_clients",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "ai_provider_policies",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: true),
                provider_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                model_route = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                secret_reference = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                policy_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                allows_cloud_egress = table.Column<bool>(type: "boolean", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_ai_provider_policies", x => x.id);
                table.ForeignKey(
                    name: "f_k_ai_provider_policies_software_products_software_product_id",
                    column: x => x.software_product_id,
                    principalSchema: "app",
                    principalTable: "software_products",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "software_databases",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                dialect = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                secret_reference = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_software_databases", x => x.id);
                table.ForeignKey(
                    name: "f_k_software_databases_software_products_software_product_id",
                    column: x => x.software_product_id,
                    principalSchema: "app",
                    principalTable: "software_products",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "software_versions",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: false),
                label = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_software_versions", x => x.id);
                table.CheckConstraint("ck_software_versions_version", "version >= 0");
                table.ForeignKey(
                    name: "f_k_software_versions_software_products_software_product_id",
                    column: x => x.software_product_id,
                    principalSchema: "app",
                    principalTable: "software_products",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "ledger_entries",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                wallet_id = table.Column<Guid>(type: "uuid", nullable: false),
                kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                amount = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                reservation_id = table.Column<Guid>(type: "uuid", nullable: true),
                occurred_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_ledger_entries", x => x.id);
                table.CheckConstraint("ck_ledger_entries_amount", "amount >= 0");
                table.ForeignKey(
                    name: "f_k_ledger_entries_reservations_reservation_id",
                    column: x => x.reservation_id,
                    principalSchema: "app",
                    principalTable: "reservations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_ledger_entries_wallets_wallet_id",
                    column: x => x.wallet_id,
                    principalSchema: "app",
                    principalTable: "wallets",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "settlements",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                reservation_id = table.Column<Guid>(type: "uuid", nullable: false),
                actual_amount = table.Column<decimal>(type: "numeric(20,4)", precision: 20, scale: 4, nullable: false),
                settled_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_settlements", x => x.id);
                table.CheckConstraint("ck_settlements_amount", "actual_amount >= 0");
                table.ForeignKey(
                    name: "f_k_settlements_reservations_reservation_id",
                    column: x => x.reservation_id,
                    principalSchema: "app",
                    principalTable: "reservations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "api_key_scopes",
            schema: "app",
            columns: table => new
            {
                api_key_id = table.Column<Guid>(type: "uuid", nullable: false),
                scope = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_api_key_scopes", x => new { x.api_key_id, x.scope });
                table.ForeignKey(
                    name: "f_k_api_key_scopes_api_keys_api_key_id",
                    column: x => x.api_key_id,
                    principalSchema: "app",
                    principalTable: "api_keys",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "knowledge_snapshots",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                software_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                creator_id = table.Column<Guid>(type: "uuid", nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                ingested_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_knowledge_snapshots", x => x.id);
                table.CheckConstraint("ck_knowledge_snapshots_state", "state IN ('Draft','Ingesting','IngestionFailed','ReadyForReview','Approved','Published','Retired')");
                table.CheckConstraint("ck_knowledge_snapshots_version", "version >= 0");
                table.ForeignKey(
                    name: "f_k_knowledge_snapshots_software_versions_software_version_id",
                    column: x => x.software_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_assignments",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                membership_id = table.Column<Guid>(type: "uuid", nullable: false),
                role_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: true),
                software_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_role_assignments", x => x.id);
                table.ForeignKey(
                    name: "f_k_role_assignments_memberships_membership_id",
                    column: x => x.membership_id,
                    principalSchema: "app",
                    principalTable: "memberships",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "f_k_role_assignments_roles_role_id",
                    column: x => x.role_id,
                    principalSchema: "app",
                    principalTable: "roles",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_role_assignments_software_products_software_product_id",
                    column: x => x.software_product_id,
                    principalSchema: "app",
                    principalTable: "software_products",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_role_assignments_software_versions_software_version_id",
                    column: x => x.software_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "version_dependencies",
            schema: "app",
            columns: table => new
            {
                software_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                dependency_version_id = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_version_dependencies", x => new { x.software_version_id, x.dependency_version_id });
                table.CheckConstraint("ck_version_dependencies_not_self", "software_version_id <> dependency_version_id");
                table.ForeignKey(
                    name: "fk_version_dependency_target",
                    column: x => x.dependency_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_version_dependencies_software_versions_software_version_id",
                    column: x => x.software_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ingestion_jobs",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                knowledge_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                idempotency_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                attempt_count = table.Column<int>(type: "integer", nullable: false),
                max_attempts = table.Column<int>(type: "integer", nullable: false),
                next_attempt_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                lease_expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                fencing_token = table.Column<long>(type: "bigint", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_ingestion_jobs", x => x.id);
                table.CheckConstraint("ck_ingestion_jobs_attempts", "attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts");
                table.CheckConstraint("ck_ingestion_jobs_version", "version >= 0");
                table.ForeignKey(
                    name: "f_k_ingestion_jobs_knowledge_snapshots_knowledge_snapshot_id",
                    column: x => x.knowledge_snapshot_id,
                    principalSchema: "app",
                    principalTable: "knowledge_snapshots",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "publication_pointers",
            schema: "app",
            columns: table => new
            {
                software_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                active_snapshot_id = table.Column<Guid>(type: "uuid", nullable: true),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_publication_pointers", x => x.software_version_id);
                table.CheckConstraint("ck_publication_pointers_version", "version >= 0");
                table.ForeignKey(
                    name: "f_k_publication_pointers_knowledge_snapshots_active_snapshot_id",
                    column: x => x.active_snapshot_id,
                    principalSchema: "app",
                    principalTable: "knowledge_snapshots",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_publication_pointers_software_versions_software_version_id",
                    column: x => x.software_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "query_requests",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_product_id = table.Column<Guid>(type: "uuid", nullable: false),
                software_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                snapshot_id = table.Column<Guid>(type: "uuid", nullable: true),
                actor_id = table.Column<Guid>(type: "uuid", nullable: false),
                question = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                version = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_query_requests", x => x.id);
                table.ForeignKey(
                    name: "f_k_query_requests_knowledge_snapshots_snapshot_id",
                    column: x => x.snapshot_id,
                    principalSchema: "app",
                    principalTable: "knowledge_snapshots",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_query_requests_software_products_software_product_id",
                    column: x => x.software_product_id,
                    principalSchema: "app",
                    principalTable: "software_products",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_query_requests_software_versions_software_version_id",
                    column: x => x.software_version_id,
                    principalSchema: "app",
                    principalTable: "software_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "snapshot_approvals",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                knowledge_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                approver_id = table.Column<Guid>(type: "uuid", nullable: false),
                decision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                decided_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_snapshot_approvals", x => x.id);
                table.ForeignKey(
                    name: "fk_snapshot_approval_snapshot",
                    column: x => x.knowledge_snapshot_id,
                    principalSchema: "app",
                    principalTable: "knowledge_snapshots",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "snapshot_files",
            schema: "app",
            columns: table => new
            {
                knowledge_snapshot_id = table.Column<Guid>(type: "uuid", nullable: false),
                file_revision_id = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_snapshot_files", x => new { x.knowledge_snapshot_id, x.file_revision_id });
                table.ForeignKey(
                    name: "f_k_snapshot_files_file_revisions_file_revision_id",
                    column: x => x.file_revision_id,
                    principalSchema: "app",
                    principalTable: "file_revisions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "f_k_snapshot_files_knowledge_snapshots_knowledge_snapshot_id",
                    column: x => x.knowledge_snapshot_id,
                    principalSchema: "app",
                    principalTable: "knowledge_snapshots",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "query_attempts",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                attempt_number = table.Column<int>(type: "integer", nullable: false),
                state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                provider_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                started_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                completed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                failure_code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_query_attempts", x => x.id);
                table.CheckConstraint("ck_query_attempts_number", "attempt_number > 0");
                table.ForeignKey(
                    name: "f_k_query_attempts_query_requests_query_request_id",
                    column: x => x.query_request_id,
                    principalSchema: "app",
                    principalTable: "query_requests",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "policy_decisions",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                policy_code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                decision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                reason_code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_policy_decisions", x => x.id);
                table.ForeignKey(
                    name: "f_k_policy_decisions_query_attempts_query_attempt_id",
                    column: x => x.query_attempt_id,
                    principalSchema: "app",
                    principalTable: "query_attempts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "query_results",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                sql_text = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                parameters_json = table.Column<string>(type: "jsonb", nullable: false),
                display_spec_json = table.Column<string>(type: "jsonb", nullable: false),
                snapshot_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                policy_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                signature = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_query_results", x => x.id);
                table.ForeignKey(
                    name: "f_k_query_results_query_attempts_query_attempt_id",
                    column: x => x.query_attempt_id,
                    principalSchema: "app",
                    principalTable: "query_attempts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "validation_findings",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                layer = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                safe_message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_validation_findings", x => x.id);
                table.ForeignKey(
                    name: "f_k_validation_findings_query_attempts_query_attempt_id",
                    column: x => x.query_attempt_id,
                    principalSchema: "app",
                    principalTable: "query_attempts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "feedback_entries",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_result_id = table.Column<Guid>(type: "uuid", nullable: false),
                actor_id = table.Column<Guid>(type: "uuid", nullable: false),
                actor_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                helpful = table.Column<bool>(type: "boolean", nullable: false),
                comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_feedback_entries", x => x.id);
                table.ForeignKey(
                    name: "f_k_feedback_entries_query_results_query_result_id",
                    column: x => x.query_result_id,
                    principalSchema: "app",
                    principalTable: "query_results",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "query_sources",
            schema: "app",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                query_result_id = table.Column<Guid>(type: "uuid", nullable: false),
                source_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                source_reference = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                score = table.Column<decimal>(type: "numeric(8,6)", precision: 8, scale: 6, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("p_k_query_sources", x => x.id);
                table.CheckConstraint("ck_query_sources_score", "score >= 0 AND score <= 1");
                table.ForeignKey(
                    name: "f_k_query_sources_query_results_query_result_id",
                    column: x => x.query_result_id,
                    principalSchema: "app",
                    principalTable: "query_results",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.InsertData(
            schema: "app",
            table: "permissions",
            columns: new[] { "code", "catalog_version", "description" },
            values: new object[,]
            {
                { "knowledge.create", 1, "Create knowledge snapshots" },
                { "knowledge.publish", 1, "Publish approved knowledge snapshots" },
                { "query.feedback.create", 1, "Submit scoped query feedback" },
                { "software.create", 1, "Create scoped software products" },
                { "software.read", 1, "Read scoped software catalog" }
            });

        migrationBuilder.CreateIndex(
            name: "i_x_ai_provider_policies_software_product_id",
            schema: "app",
            table: "ai_provider_policies",
            column: "software_product_id");

        migrationBuilder.CreateIndex(
            name: "ix_ai_provider_policy_scope",
            schema: "app",
            table: "ai_provider_policies",
            columns: new[] { "tenant_id", "software_product_id", "is_active" });

        migrationBuilder.CreateIndex(
            name: "i_x_api_clients_organization_id",
            schema: "app",
            table: "api_clients",
            column: "organization_id");

        migrationBuilder.CreateIndex(
            name: "i_x_api_clients_tenant_id_organization_id_name",
            schema: "app",
            table: "api_clients",
            columns: new[] { "tenant_id", "organization_id", "name" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_api_ip_restrictions_api_client_id_cidr",
            schema: "app",
            table: "api_ip_restrictions",
            columns: new[] { "api_client_id", "cidr" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_api_keys_api_client_id",
            schema: "app",
            table: "api_keys",
            column: "api_client_id");

        migrationBuilder.CreateIndex(
            name: "i_x_api_keys_prefix",
            schema: "app",
            table: "api_keys",
            column: "prefix",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_audit_events_correlation_id",
            schema: "app",
            table: "audit_events",
            column: "correlation_id");

        migrationBuilder.CreateIndex(
            name: "i_x_audit_events_tenant_id_occurred_at_utc",
            schema: "app",
            table: "audit_events",
            columns: new[] { "tenant_id", "occurred_at_utc" });

        migrationBuilder.CreateIndex(
            name: "i_x_feedback_entries_query_result_id_actor_id",
            schema: "app",
            table: "feedback_entries",
            columns: new[] { "query_result_id", "actor_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_file_revisions_file_identity_id_revision_number",
            schema: "app",
            table: "file_revisions",
            columns: new[] { "file_identity_id", "revision_number" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_idempotency_records_expires_at_utc",
            schema: "app",
            table: "idempotency_records",
            column: "expires_at_utc");

        migrationBuilder.CreateIndex(
            name: "i_x_inbox_messages_processed_at_utc",
            schema: "app",
            table: "inbox_messages",
            column: "processed_at_utc");

        migrationBuilder.CreateIndex(
            name: "i_x_ingestion_jobs_knowledge_snapshot_id",
            schema: "app",
            table: "ingestion_jobs",
            column: "knowledge_snapshot_id");

        migrationBuilder.CreateIndex(
            name: "i_x_ingestion_jobs_state_next_attempt_at_utc",
            schema: "app",
            table: "ingestion_jobs",
            columns: new[] { "state", "next_attempt_at_utc" });

        migrationBuilder.CreateIndex(
            name: "i_x_ingestion_jobs_tenant_id_idempotency_key",
            schema: "app",
            table: "ingestion_jobs",
            columns: new[] { "tenant_id", "idempotency_key" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_knowledge_files_tenant_id_software_product_id_logical_name",
            schema: "app",
            table: "knowledge_files",
            columns: new[] { "tenant_id", "software_product_id", "logical_name" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_knowledge_snapshots_software_version_id_state",
            schema: "app",
            table: "knowledge_snapshots",
            columns: new[] { "software_version_id", "state" });

        migrationBuilder.CreateIndex(
            name: "i_x_ledger_entries_reservation_id",
            schema: "app",
            table: "ledger_entries",
            column: "reservation_id");

        migrationBuilder.CreateIndex(
            name: "i_x_ledger_entries_wallet_id_idempotency_key",
            schema: "app",
            table: "ledger_entries",
            columns: new[] { "wallet_id", "idempotency_key" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_ledger_entries_wallet_id_occurred_at_utc",
            schema: "app",
            table: "ledger_entries",
            columns: new[] { "wallet_id", "occurred_at_utc" });

        migrationBuilder.CreateIndex(
            name: "i_x_memberships_organization_id",
            schema: "app",
            table: "memberships",
            column: "organization_id");

        migrationBuilder.CreateIndex(
            name: "i_x_memberships_tenant_id_organization_id_user_id",
            schema: "app",
            table: "memberships",
            columns: new[] { "tenant_id", "organization_id", "user_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_memberships_user_id",
            schema: "app",
            table: "memberships",
            column: "user_id");

        migrationBuilder.CreateIndex(
            name: "i_x_organizations_tenant_id_code",
            schema: "app",
            table: "organizations",
            columns: new[] { "tenant_id", "code" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_outbox_messages_processed_at_utc_next_attempt_at_utc",
            schema: "app",
            table: "outbox_messages",
            columns: new[] { "processed_at_utc", "next_attempt_at_utc" });

        migrationBuilder.CreateIndex(
            name: "i_x_policy_decisions_query_attempt_id",
            schema: "app",
            table: "policy_decisions",
            column: "query_attempt_id");

        migrationBuilder.CreateIndex(
            name: "i_x_publication_pointers_active_snapshot_id",
            schema: "app",
            table: "publication_pointers",
            column: "active_snapshot_id");

        migrationBuilder.CreateIndex(
            name: "i_x_query_attempts_query_request_id_attempt_number",
            schema: "app",
            table: "query_attempts",
            columns: new[] { "query_request_id", "attempt_number" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_query_requests_snapshot_id",
            schema: "app",
            table: "query_requests",
            column: "snapshot_id");

        migrationBuilder.CreateIndex(
            name: "i_x_query_requests_software_product_id",
            schema: "app",
            table: "query_requests",
            column: "software_product_id");

        migrationBuilder.CreateIndex(
            name: "i_x_query_requests_software_version_id_state",
            schema: "app",
            table: "query_requests",
            columns: new[] { "software_version_id", "state" });

        migrationBuilder.CreateIndex(
            name: "i_x_query_requests_tenant_id_actor_id_created_at_utc",
            schema: "app",
            table: "query_requests",
            columns: new[] { "tenant_id", "actor_id", "created_at_utc" });

        migrationBuilder.CreateIndex(
            name: "i_x_query_results_query_attempt_id",
            schema: "app",
            table: "query_results",
            column: "query_attempt_id",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_query_sources_query_result_id",
            schema: "app",
            table: "query_sources",
            column: "query_result_id");

        migrationBuilder.CreateIndex(
            name: "i_x_quotas_api_client_id",
            schema: "app",
            table: "quotas",
            column: "api_client_id");

        migrationBuilder.CreateIndex(
            name: "i_x_quotas_tenant_id_api_client_id_period",
            schema: "app",
            table: "quotas",
            columns: new[] { "tenant_id", "api_client_id", "period" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_reservations_wallet_id_state",
            schema: "app",
            table: "reservations",
            columns: new[] { "wallet_id", "state" });

        migrationBuilder.CreateIndex(
            name: "ix_role_assignment_scope",
            schema: "app",
            table: "role_assignments",
            columns: new[] { "membership_id", "role_id", "software_product_id", "software_version_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_role_assignments_role_id",
            schema: "app",
            table: "role_assignments",
            column: "role_id");

        migrationBuilder.CreateIndex(
            name: "i_x_role_assignments_software_product_id",
            schema: "app",
            table: "role_assignments",
            column: "software_product_id");

        migrationBuilder.CreateIndex(
            name: "i_x_role_assignments_software_version_id",
            schema: "app",
            table: "role_assignments",
            column: "software_version_id");

        migrationBuilder.CreateIndex(
            name: "i_x_role_permissions_permission_code",
            schema: "app",
            table: "role_permissions",
            column: "permission_code");

        migrationBuilder.CreateIndex(
            name: "i_x_roles_tenant_id_code",
            schema: "app",
            table: "roles",
            columns: new[] { "tenant_id", "code" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_security_events_tenant_id_occurred_at_utc_severity",
            schema: "app",
            table: "security_events",
            columns: new[] { "tenant_id", "occurred_at_utc", "severity" });

        migrationBuilder.CreateIndex(
            name: "i_x_settlements_idempotency_key",
            schema: "app",
            table: "settlements",
            column: "idempotency_key",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_settlements_reservation_id",
            schema: "app",
            table: "settlements",
            column: "reservation_id",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_snapshot_approvals_knowledge_snapshot_id_approver_id",
            schema: "app",
            table: "snapshot_approvals",
            columns: new[] { "knowledge_snapshot_id", "approver_id" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_snapshot_files_file_revision_id",
            schema: "app",
            table: "snapshot_files",
            column: "file_revision_id");

        migrationBuilder.CreateIndex(
            name: "i_x_software_databases_software_product_id",
            schema: "app",
            table: "software_databases",
            column: "software_product_id");

        migrationBuilder.CreateIndex(
            name: "i_x_software_databases_tenant_id_software_product_id_name",
            schema: "app",
            table: "software_databases",
            columns: new[] { "tenant_id", "software_product_id", "name" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_software_products_owner_organization_id",
            schema: "app",
            table: "software_products",
            column: "owner_organization_id");

        migrationBuilder.CreateIndex(
            name: "i_x_software_products_tenant_id_is_deleted_name",
            schema: "app",
            table: "software_products",
            columns: new[] { "tenant_id", "is_deleted", "name" });

        migrationBuilder.CreateIndex(
            name: "i_x_software_products_tenant_id_owner_organization_id_code",
            schema: "app",
            table: "software_products",
            columns: new[] { "tenant_id", "owner_organization_id", "code" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_software_versions_software_product_id_label",
            schema: "app",
            table: "software_versions",
            columns: new[] { "software_product_id", "label" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_tariff_rules_tenant_id_code_effective_from_utc",
            schema: "app",
            table: "tariff_rules",
            columns: new[] { "tenant_id", "code", "effective_from_utc" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_users_tenant_id_external_subject",
            schema: "app",
            table: "users",
            columns: new[] { "tenant_id", "external_subject" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "i_x_validation_findings_query_attempt_id_layer_severity",
            schema: "app",
            table: "validation_findings",
            columns: new[] { "query_attempt_id", "layer", "severity" });

        migrationBuilder.CreateIndex(
            name: "i_x_version_dependencies_dependency_version_id",
            schema: "app",
            table: "version_dependencies",
            column: "dependency_version_id");

        migrationBuilder.CreateIndex(
            name: "i_x_wallets_tenant_id_owner_id",
            schema: "app",
            table: "wallets",
            columns: new[] { "tenant_id", "owner_id" },
            unique: true);

        migrationBuilder.Sql(
            """
            CREATE OR REPLACE FUNCTION app.reject_immutable_mutation()
            RETURNS trigger LANGUAGE plpgsql AS $function$
            BEGIN
                RAISE EXCEPTION 'immutable table % does not permit %', TG_TABLE_NAME, TG_OP;
            END;
            $function$;

            CREATE TRIGGER trg_ledger_entries_immutable
                BEFORE UPDATE OR DELETE ON app.ledger_entries
                FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
            CREATE TRIGGER trg_audit_events_immutable
                BEFORE UPDATE OR DELETE ON app.audit_events
                FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
            CREATE TRIGGER trg_security_events_immutable
                BEFORE UPDATE OR DELETE ON app.security_events
                FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ai_provider_policies",
            schema: "app");

        migrationBuilder.DropTable(
            name: "api_ip_restrictions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "api_key_scopes",
            schema: "app");

        migrationBuilder.DropTable(
            name: "audit_events",
            schema: "app");

        migrationBuilder.DropTable(
            name: "feedback_entries",
            schema: "app");

        migrationBuilder.DropTable(
            name: "idempotency_records",
            schema: "app");

        migrationBuilder.DropTable(
            name: "inbox_messages",
            schema: "app");

        migrationBuilder.DropTable(
            name: "ingestion_jobs",
            schema: "app");

        migrationBuilder.DropTable(
            name: "ledger_entries",
            schema: "app");

        migrationBuilder.DropTable(
            name: "outbox_messages",
            schema: "app");

        migrationBuilder.DropTable(
            name: "policy_decisions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "publication_pointers",
            schema: "app");

        migrationBuilder.DropTable(
            name: "query_sources",
            schema: "app");

        migrationBuilder.DropTable(
            name: "quotas",
            schema: "app");

        migrationBuilder.DropTable(
            name: "role_assignments",
            schema: "app");

        migrationBuilder.DropTable(
            name: "role_permissions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "security_events",
            schema: "app");

        migrationBuilder.DropTable(
            name: "settlements",
            schema: "app");

        migrationBuilder.DropTable(
            name: "snapshot_approvals",
            schema: "app");

        migrationBuilder.DropTable(
            name: "snapshot_files",
            schema: "app");

        migrationBuilder.DropTable(
            name: "software_databases",
            schema: "app");

        migrationBuilder.DropTable(
            name: "tariff_rules",
            schema: "app");

        migrationBuilder.DropTable(
            name: "validation_findings",
            schema: "app");

        migrationBuilder.DropTable(
            name: "version_dependencies",
            schema: "app");

        migrationBuilder.DropTable(
            name: "api_keys",
            schema: "app");

        migrationBuilder.DropTable(
            name: "query_results",
            schema: "app");

        migrationBuilder.DropTable(
            name: "memberships",
            schema: "app");

        migrationBuilder.DropTable(
            name: "permissions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "roles",
            schema: "app");

        migrationBuilder.DropTable(
            name: "reservations",
            schema: "app");

        migrationBuilder.DropTable(
            name: "file_revisions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "api_clients",
            schema: "app");

        migrationBuilder.DropTable(
            name: "query_attempts",
            schema: "app");

        migrationBuilder.DropTable(
            name: "users",
            schema: "app");

        migrationBuilder.DropTable(
            name: "wallets",
            schema: "app");

        migrationBuilder.DropTable(
            name: "knowledge_files",
            schema: "app");

        migrationBuilder.DropTable(
            name: "query_requests",
            schema: "app");

        migrationBuilder.DropTable(
            name: "knowledge_snapshots",
            schema: "app");

        migrationBuilder.DropTable(
            name: "software_versions",
            schema: "app");

        migrationBuilder.DropTable(
            name: "software_products",
            schema: "app");

        migrationBuilder.DropTable(
            name: "organizations",
            schema: "app");

        migrationBuilder.Sql("DROP FUNCTION IF EXISTS app.reject_immutable_mutation();");
    }
}
