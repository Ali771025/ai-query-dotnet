namespace AiQuery.Application.Common;

public sealed class ApplicationConcurrencyException(string message, Exception? innerException = null) : Exception(message, innerException);
