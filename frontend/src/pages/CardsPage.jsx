import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cardsService } from '../services/cards.service.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge } from '../components/Badge.jsx';
import { Modal } from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { TableSkeleton } from '../components/TableSkeleton.jsx';
import { formatDateTime, validateUID, normalizeUID } from '../utils/formatters.js';

export function CardsPage() {
  const toast = useToast();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'revoked'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Add Card Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCardUID, setNewCardUID] = useState('');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke Confirmation State
  const [cardToRevoke, setCardToRevoke] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch cards from backend
  const fetchCards = useCallback(async () => {
    try {
      setError(null);
      const res = await cardsService.getCards({
        page,
        limit,
        status: statusFilter,
      });

      if (res && res.success) {
        setCards(res.data || []);
        if (res.pagination) {
          setPagination({
            total: res.pagination.total,
            totalPages: Math.max(1, res.pagination.totalPages),
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load cards from backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCards();
  };

  // Status Filter change
  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1); // Reset to page 1
  };

  // Handle Card Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validation = validateUID(newCardUID);
    if (!validation.valid) {
      setFormError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await cardsService.registerCard({
        uid: validation.normalized,
        label: newCardLabel.trim(),
      });

      toast.success(response.message || `Card ${validation.normalized} registered successfully`);
      setIsAddModalOpen(false);
      setNewCardUID('');
      setNewCardLabel('');
      fetchCards();
    } catch (err) {
      if (err.status === 409) {
        setFormError(`Conflict: Card with UID '${validation.normalized}' is already registered.`);
      } else {
        setFormError(err.message || 'Failed to register card.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activate Card directly
  const handleActivateCard = async (card) => {
    setIsUpdatingStatus(true);
    try {
      await cardsService.updateCardStatus(card.uid, 'active');
      toast.success(`Card ${card.uid} activated successfully`);
      fetchCards();
    } catch (err) {
      toast.error(err.message || `Failed to activate card ${card.uid}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Confirm Revoke Card
  const handleConfirmRevoke = async () => {
    if (!cardToRevoke) return;

    setIsUpdatingStatus(true);
    try {
      await cardsService.updateCardStatus(cardToRevoke.uid, 'revoked');
      toast.success(`Card ${cardToRevoke.uid} has been revoked`);
      setCardToRevoke(null);
      fetchCards();
    } catch (err) {
      toast.error(err.message || `Failed to revoke card ${cardToRevoke.uid}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Client-side text filter for UID / Label on the loaded page
  const filteredCards = cards.filter((card) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const matchesUID = card.uid.toLowerCase().includes(query);
    const matchesLabel = (card.label || '').toLowerCase().includes(query);
    return matchesUID || matchesLabel;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
            RFID Card Management
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Register, authorize, and revoke physical RFID credentials
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setNewCardUID('');
              setNewCardLabel('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add RFID Card
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by UID or label..."
            className="w-full pl-9 pr-3.5 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] text-zinc-500 font-mono mr-1">Status:</span>
          {['all', 'active', 'revoked'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleStatusFilterChange(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Table View */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : filteredCards.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={searchQuery ? 'No matching cards' : 'No registered cards'}
            description={
              searchQuery
                ? `No cards found matching "${searchQuery}". Clear your search or check filters.`
                : 'No RFID cards have been registered yet. Click "Add RFID Card" to register your first card.'
            }
            action={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  Register New Card
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800/80">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Card UID</th>
                  <th className="py-3.5 px-4 font-semibold">Label / Name</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Registered At</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredCards.map((card) => {
                  const isActive = card.status === 'active';

                  return (
                    <tr
                      key={card._id || card.uid}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-zinc-100">
                        {card.uid}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {card.label ? (
                          <span className="font-medium text-zinc-200">{card.label}</span>
                        ) : (
                          <span className="text-zinc-500 italic">No label</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={card.status} />
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        {formatDateTime(card.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => setCardToRevoke(card)}
                            disabled={isUpdatingStatus}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivateCard(card)}
                            disabled={isUpdatingStatus}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && filteredCards.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-zinc-800/80 bg-zinc-900/20 text-xs text-zinc-400">
            <div className="font-mono text-[11px]">
              Showing <span className="text-zinc-200 font-medium">{filteredCards.length}</span> of{' '}
              <span className="text-zinc-200 font-medium">{pagination.total}</span> registered cards
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono mr-2">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Register Card Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="Register New RFID Card"
        description="Add a physical RFID tag or key fob to the authorized hardware list."
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{formError}</div>
            </div>
          )}

          <div>
            <label htmlFor="cardUid" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Card UID <span className="text-rose-400">*</span>
            </label>
            <input
              id="cardUid"
              type="text"
              required
              autoFocus
              value={newCardUID}
              onChange={(e) => setNewCardUID(e.target.value.toUpperCase())}
              placeholder="e.g. CEE4E857 or 04:A1:B2:C3"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors uppercase tracking-wider"
            />
            <p className="mt-1 text-[11px] text-zinc-500 font-mono">
              Accepted formats: 4 to 32 hex characters (e.g. MIFARE Classic 4-byte or Ultralight 7-byte).
            </p>
          </div>

          <div>
            <label htmlFor="cardLabel" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Card Label / Holder Name <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="cardLabel"
              type="text"
              value={newCardLabel}
              onChange={(e) => setNewCardLabel(e.target.value)}
              placeholder="e.g. Pavan (Lab Room 2)"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium rounded-lg text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Register Card
            </button>
          </div>
        </form>
      </Modal>

      {/* Revocation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cardToRevoke)}
        onClose={() => !isUpdatingStatus && setCardToRevoke(null)}
        onConfirm={handleConfirmRevoke}
        title="Revoke RFID Card Access"
        message={
          cardToRevoke
            ? `Are you sure you want to revoke card "${cardToRevoke.uid}" (${
                cardToRevoke.label || 'No label'
              })? The door lock will immediately deny access when this card is scanned.`
            : ''
        }
        confirmLabel="Revoke Card"
        cancelLabel="Keep Active"
        isDestructive={true}
        isLoading={isUpdatingStatus}
      />
    </div>
  );
}
