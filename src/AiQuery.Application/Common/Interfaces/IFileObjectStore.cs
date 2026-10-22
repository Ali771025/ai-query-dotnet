namespace AiQuery.Application.Common.Interfaces;

public interface IFileObjectStore
{
    Task<ObjectWriteResult> PutAsync(string objectId, Stream content, string mediaType, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadAsync(string objectId, CancellationToken cancellationToken = default);
    Task DeleteAsync(string objectId, CancellationToken cancellationToken = default);
}

public sealed record ObjectWriteResult(string ObjectId, string Sha256, long SizeBytes);
