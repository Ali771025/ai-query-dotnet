using AiQuery.Domain.Common;

namespace AiQuery.Domain.UsageBilling;

public enum LedgerEntryKind { Credit, Reserve, Settle, Release }
public sealed record LedgerEntry(Guid Id, LedgerEntryKind Kind, decimal Amount, Guid? ReservationId, DateTimeOffset OccurredAtUtc);
public enum ReservationState { Reserved, Settled, Released }
public sealed record CreditReservation(Guid Id, CreditAmount Amount, ReservationState State);

public sealed class CreditWallet : AggregateRoot<WalletId>
{
    private readonly List<LedgerEntry> _entries = [];
    private readonly Dictionary<Guid, CreditReservation> _reservations = [];
    public CreditWallet(WalletId id) : base(id) { }
    public IReadOnlyList<LedgerEntry> Entries => _entries.AsReadOnly();
    public decimal Balance => _entries.Sum(item => item.Kind switch { LedgerEntryKind.Credit or LedgerEntryKind.Release => item.Amount, _ => -item.Amount });
    public void Credit(Guid entryId, CreditAmount amount, DateTimeOffset atUtc) => AppendUnique(new LedgerEntry(entryId, LedgerEntryKind.Credit, amount.Value, null, atUtc));
    public void Reserve(Guid reservationId, CreditAmount amount, DateTimeOffset atUtc)
    {
        if (amount.Value <= 0) throw new DomainRuleException("reservation.amount.invalid", "Reservation amount must be positive.");
        if (_reservations.ContainsKey(reservationId)) return;
        if (Balance < amount.Value) throw new DomainRuleException("reservation.insufficient_credit", "Reservation would make available credit negative.");
        _reservations.Add(reservationId, new CreditReservation(reservationId, amount, ReservationState.Reserved));
        AppendUnique(new LedgerEntry(reservationId, LedgerEntryKind.Reserve, amount.Value, reservationId, atUtc));
    }
    public void Settle(Guid reservationId, Guid entryId, DateTimeOffset atUtc) => Transition(reservationId, entryId, ReservationState.Settled, LedgerEntryKind.Settle, 0, atUtc);
    public void Release(Guid reservationId, Guid entryId, DateTimeOffset atUtc)
    {
        var reservation = RequiredReserved(reservationId);
        _reservations[reservationId] = reservation with { State = ReservationState.Released };
        AppendUnique(new LedgerEntry(entryId, LedgerEntryKind.Release, reservation.Amount.Value, reservationId, atUtc));
    }
    private void Transition(Guid id, Guid entryId, ReservationState state, LedgerEntryKind kind, decimal amount, DateTimeOffset atUtc)
    {
        var reservation = RequiredReserved(id);
        _reservations[id] = reservation with { State = state };
        AppendUnique(new LedgerEntry(entryId, kind, amount, id, atUtc));
    }
    private CreditReservation RequiredReserved(Guid id) => _reservations.TryGetValue(id, out var value) && value.State == ReservationState.Reserved ? value : throw new DomainRuleException("reservation.state.invalid", "Reservation is not active.");
    private void AppendUnique(LedgerEntry entry)
    {
        if (_entries.Any(item => item.Id == entry.Id)) return;
        _entries.Add(entry);
    }
}
