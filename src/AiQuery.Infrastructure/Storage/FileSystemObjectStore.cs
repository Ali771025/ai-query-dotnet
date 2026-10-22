using System.Security.Cryptography;
using AiQuery.Application.Common.Interfaces;
using AiQuery.Infrastructure.Configuration;
using Microsoft.Extensions.Options;

namespace AiQuery.Infrastructure.Storage;

internal sealed class FileSystemObjectStore(IOptions<KnowledgeStorageOptions> options) : IFileObjectStore
{
    private readonly string _root = Path.GetFullPath(options.Value.RootPath);

    public async Task<ObjectWriteResult> PutAsync(string objectId, Stream content, string mediaType, CancellationToken cancellationToken = default)
    {
        var destination = Resolve(objectId);
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        var temporary = destination + ".upload-" + Guid.NewGuid().ToString("N");
        try
        {
            await using var target = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous | FileOptions.WriteThrough);
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var buffer = new byte[81920];
            long size = 0;
            while (true)
            {
                var read = await content.ReadAsync(buffer, cancellationToken);
                if (read == 0) break;
                hash.AppendData(buffer, 0, read);
                await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                size += read;
            }
            await target.FlushAsync(cancellationToken);
            target.Close();
            File.Move(temporary, destination, overwrite: false);
            return new(objectId, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(), size);
        }
        catch
        {
            if (File.Exists(temporary)) File.Delete(temporary);
            throw;
        }
    }

    public Task<Stream> OpenReadAsync(string objectId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Stream stream = new FileStream(Resolve(objectId), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string objectId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = Resolve(objectId);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string Resolve(string objectId)
    {
        if (string.IsNullOrWhiteSpace(objectId) || Path.IsPathRooted(objectId) || objectId.Contains("..", StringComparison.Ordinal)) throw new InvalidOperationException("Object identifier is not safe.");
        var fullPath = Path.GetFullPath(Path.Combine(_root, objectId.Replace('/', Path.DirectorySeparatorChar)));
        if (!fullPath.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal)) throw new InvalidOperationException("Object identifier escapes storage root.");
        return fullPath;
    }
}

