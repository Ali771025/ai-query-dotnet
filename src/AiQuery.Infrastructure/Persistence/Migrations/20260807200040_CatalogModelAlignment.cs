using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AiQuery.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogModelAlignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "app",
                table: "software_versions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Active",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "app",
                table: "software_products",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Active",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.InsertData(
                schema: "app",
                table: "permissions",
                columns: new[] { "code", "catalog_version", "description" },
                values: new object[,]
                {
                    { "databases.create", 1, "Create database metadata" },
                    { "databases.delete", 1, "Delete database metadata" },
                    { "databases.edit", 1, "Edit database metadata" },
                    { "databases.view", 1, "View database metadata" },
                    { "software.delete", 1, "Delete scoped software" },
                    { "software.edit", 1, "Edit scoped software" },
                    { "software.view", 1, "View scoped software" },
                    { "versions.create", 1, "Create software versions" },
                    { "versions.edit", 1, "Edit software versions" },
                    { "versions.view", 1, "View software versions" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "databases.create");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "databases.delete");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "databases.edit");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "databases.view");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "software.delete");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "software.edit");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "software.view");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "versions.create");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "versions.edit");

            migrationBuilder.DeleteData(
                schema: "app",
                table: "permissions",
                keyColumn: "code",
                keyValue: "versions.view");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "app",
                table: "software_versions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Active");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "app",
                table: "software_products",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Active");
        }
    }
}
