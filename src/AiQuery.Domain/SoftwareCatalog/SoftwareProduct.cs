using AiQuery.Domain.Common;

namespace AiQuery.Domain.SoftwareCatalog;

public sealed record SoftwareProductCreated(SoftwareProductId ProductId, OrganizationId OwnerId, string Code, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record SoftwareVersionAdded(SoftwareProductId ProductId, SoftwareVersionId VersionId, string Label, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public sealed record VersionDependencyAdded(SoftwareProductId ProductId, SoftwareVersionId VersionId, SoftwareVersionId DependencyId, DateTimeOffset OccurredAtUtc) : IDomainEvent;
public enum CatalogStatus { Active, Inactive, Retired }

public sealed class SoftwareDatabase(SoftwareDatabaseId id, string code, string name, string dialect, SoftwareVersionId? introducedIn, SoftwareVersionId? removedIn) : Entity<SoftwareDatabaseId>(id)
{
    public string Code { get; } = code;
    public string Name { get; private set; } = name;
    public string Dialect { get; private set; } = dialect;
    public SoftwareVersionId? IntroducedIn { get; private set; } = introducedIn;
    public SoftwareVersionId? RemovedIn { get; private set; } = removedIn;
    public bool IsActive { get; private set; } = true;
    public void Update(string name, string dialect, SoftwareVersionId? introducedIn, SoftwareVersionId? removedIn) { Name = Required(name, "database.name.invalid"); Dialect = Required(dialect, "database.dialect.invalid"); IntroducedIn = introducedIn; RemovedIn = removedIn; }
    public void SetActive(bool active) => IsActive = active;
    private static string Required(string value, string code) { var normalized = value?.Trim() ?? ""; if (normalized.Length is < 2 or > 200) throw new DomainRuleException(code, "Value must contain 2-200 characters."); return normalized; }
}

public sealed class SoftwareVersion(SoftwareVersionId id, VersionLabel label) : Entity<SoftwareVersionId>(id)
{
    private readonly HashSet<SoftwareVersionId> _dependencies = [];
    public VersionLabel Label { get; } = label;
    public CatalogStatus Status { get; private set; } = CatalogStatus.Active;
    public DateOnly? ReleaseDate { get; private set; }
    public IReadOnlySet<SoftwareVersionId> Dependencies => _dependencies;
    internal void AddDependency(SoftwareVersionId id) => _dependencies.Add(id);
    public void Retire() => Status = CatalogStatus.Retired;
}

public sealed class SoftwareProduct : AggregateRoot<SoftwareProductId>
{
    private readonly List<SoftwareVersion> _versions = [];
    private readonly List<SoftwareDatabase> _databases = [];
    private SoftwareProduct(SoftwareProductId id, OrganizationId ownerId, SoftwareCode code, string name) : base(id)
    {
        OwnerOrganizationId = ownerId;
        Code = code;
        Name = name;
    }

    public OrganizationId OwnerOrganizationId { get; }
    public SoftwareCode Code { get; }
    public string Name { get; private set; }
    public CatalogStatus Status { get; private set; } = CatalogStatus.Active;
    public bool IsDeleted { get; private set; }
    public IReadOnlyList<SoftwareVersion> Versions => _versions.AsReadOnly();
    public IReadOnlyList<SoftwareDatabase> Databases => _databases.AsReadOnly();

    public static SoftwareProduct Create(SoftwareProductId id, OrganizationId ownerId, SoftwareCode code, string name, DateTimeOffset occurredAtUtc)
    {
        if (id.Value == Guid.Empty || ownerId.Value == Guid.Empty) throw new DomainRuleException("software.identity.invalid", "Software and owner identifiers are required.");
        var normalizedName = name?.Trim() ?? string.Empty;
        if (normalizedName.Length is < 2 or > 200) throw new DomainRuleException("software.name.invalid", "Software name must contain 2-200 characters.");
        var product = new SoftwareProduct(id, ownerId, code, normalizedName);
        product.RecordEvent(new SoftwareProductCreated(id, ownerId, code.Value, occurredAtUtc));
        return product;
    }

    public static SoftwareProduct Rehydrate(SoftwareProductId id, OrganizationId ownerId, SoftwareCode code, string name, long version, IEnumerable<(SoftwareVersionId Id, VersionLabel Label, IReadOnlyCollection<SoftwareVersionId> Dependencies)> versions)
    {
        var product = new SoftwareProduct(id, ownerId, code, name);
        foreach (var item in versions)
        {
            var softwareVersion = new SoftwareVersion(item.Id, item.Label);
            foreach (var dependency in item.Dependencies) softwareVersion.AddDependency(dependency);
            product._versions.Add(softwareVersion);
        }
        product.RestoreVersion(version);
        return product;
    }

    public SoftwareVersion AddVersion(SoftwareVersionId id, VersionLabel label, DateTimeOffset occurredAtUtc)
    {
        if (id.Value == Guid.Empty) throw new DomainRuleException("version.identity.invalid", "Version identifier is required.");
        if (_versions.Any(item => string.Equals(item.Label.Value, label.Value, StringComparison.OrdinalIgnoreCase))) throw new DomainRuleException("version.label.duplicate", "Version label must be unique inside the software product.");
        var version = new SoftwareVersion(id, label);
        _versions.Add(version);
        RecordEvent(new SoftwareVersionAdded(Id, id, label.Value, occurredAtUtc));
        return version;
    }

    public SoftwareDatabase AddDatabase(SoftwareDatabaseId id, string code, string name, string dialect, SoftwareVersionId? introducedIn, SoftwareVersionId? removedIn)
    {
        if (id.Value == Guid.Empty) throw new DomainRuleException("database.identity.invalid", "Database identifier is required.");
        var normalizedCode = code?.Trim().ToLowerInvariant() ?? "";
        if (normalizedCode.Length is < 2 or > 100) throw new DomainRuleException("database.code.invalid", "Database code is invalid.");
        if (_databases.Any(item => item.Code == normalizedCode)) throw new DomainRuleException("database.code.duplicate", "Database code must be unique inside software.");
        ValidateAvailability(introducedIn, removedIn);
        var database = new SoftwareDatabase(id, normalizedCode, name, dialect, introducedIn, removedIn);
        database.Update(name, dialect, introducedIn, removedIn);
        _databases.Add(database);
        return database;
    }

    public void Rename(string name) { var normalized = name?.Trim() ?? ""; if (normalized.Length is < 2 or > 200) throw new DomainRuleException("software.name.invalid", "Software name is invalid."); Name = normalized; IncrementVersion(); }
    public void SetActive(bool active) { Status = active ? CatalogStatus.Active : CatalogStatus.Inactive; IncrementVersion(); }
    public void Delete() { if (_versions.Any()) throw new DomainRuleException("software.delete.blocked", "Software with versions cannot be deleted."); IsDeleted = true; IncrementVersion(); }

    public void AddDependency(SoftwareVersionId versionId, SoftwareVersionId dependencyId, DateTimeOffset occurredAtUtc)
    {
        if (versionId == dependencyId) throw new DomainRuleException("version.dependency.self", "A version cannot depend on itself.");
        var version = RequiredVersion(versionId);
        _ = RequiredVersion(dependencyId);
        if (WouldCreateCycle(versionId, dependencyId)) throw new DomainRuleException("version.dependency.cycle", "Version dependency would create a cycle.");
        if (version.Dependencies.Contains(dependencyId)) return;
        version.AddDependency(dependencyId);
        RecordEvent(new VersionDependencyAdded(Id, versionId, dependencyId, occurredAtUtc));
    }

    private SoftwareVersion RequiredVersion(SoftwareVersionId id) => _versions.SingleOrDefault(item => item.Id == id) ?? throw new DomainRuleException("version.not_found", "Version does not belong to the software product.");
    private void ValidateAvailability(SoftwareVersionId? introduced, SoftwareVersionId? removed) { if (introduced is not null) _ = RequiredVersion(introduced.Value); if (removed is not null) _ = RequiredVersion(removed.Value); if (introduced is not null && removed is not null && _versions.FindIndex(v => v.Id == removed) <= _versions.FindIndex(v => v.Id == introduced)) throw new DomainRuleException("database.version_range.invalid", "Removed version must follow introduced version."); }

    private bool WouldCreateCycle(SoftwareVersionId versionId, SoftwareVersionId dependencyId)
    {
        var pending = new Stack<SoftwareVersionId>();
        var visited = new HashSet<SoftwareVersionId>();
        pending.Push(dependencyId);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (current == versionId) return true;
            if (!visited.Add(current)) continue;
            foreach (var next in RequiredVersion(current).Dependencies) pending.Push(next);
        }
        return false;
    }
}
