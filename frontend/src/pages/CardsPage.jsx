import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ShieldAlert,
  Radio,
  Clock,
  Sparkles,
  SmartphoneNfc,
} from 'lucide-react';
import { cardsService } from '../services/cards.service.js';
import { enrollmentService } from '../services/enrollment.service.js';
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
  const [enrollMethod, setEnrollMethod] = useState('scanner'); // 'scanner' | 'manual'
  const [newCardUID, setNewCardUID] = useState('');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remote Enrollment Session State
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [enrollmentState, setEnrollmentState] = useState('idle'); // 'idle' | 'starting' | 'waiting' | 'scanned' | 'expired' | 'cancelled'
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [selectedDevice] = useState('door-lock-01');

  const pollIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

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

  // Helper to clear enrollment polling & countdown
  const clearEnrollmentTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearEnrollmentTimers();
    };
  }, [clearEnrollmentTimers]);

  // Start Remote Enrollment Session
  const handleStartRemoteEnrollment = async () => {
    setFormError('');
    setEnrollmentState('starting');
    clearEnrollmentTimers();

    try {
      const res = await enrollmentService.startEnrollment(selectedDevice);
      if (res && res.success && res.data) {
        const id = res.data.enrollmentId;
        setEnrollmentId(id);
        setEnrollmentState('waiting');
        setRemainingSeconds(res.data.timeoutSeconds || 60);

        // Start 1-second countdown timer
        countdownIntervalRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current);
              setEnrollmentState('expired');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Start polling enrollment status every 1.5s
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await enrollmentService.getEnrollment(id);
            if (statusRes && statusRes.success && statusRes.data) {
              const status = statusRes.data.status;

              if (status === 'scanned') {
                clearEnrollmentTimers();
                setEnrollmentState('scanned');
                setNewCardUID(statusRes.data.scannedUid || '');
                toast.success(`RFID Card detected: ${statusRes.data.scannedUid}`);
              } else if (status === 'expired') {
                clearEnrollmentTimers();
                setEnrollmentState('expired');
              } else if (status === 'cancelled') {
                clearEnrollmentTimers();
                setEnrollmentState('cancelled');
              }
            }
          } catch {
            // Transient polling error - continue
          }
        }, 1500);
      }
    } catch (err) {
      setEnrollmentState('idle');
      setFormError(err.message || 'Failed to start remote enrollment session on device.');
    }
  };

  // Cancel Remote Enrollment
  const handleCancelEnrollment = async () => {
    clearEnrollmentTimers();
    if (enrollmentId && enrollmentState === 'waiting') {
      try {
        await enrollmentService.cancelEnrollment(enrollmentId);
      } catch {
        // ignore
      }
    }
    setEnrollmentState('idle');
    setEnrollmentId(null);
  };

  // Close Modal handler (cancels active enrollment if ongoing)
  const handleCloseModal = () => {
    if (isSubmitting) return;
    if (enrollmentState === 'waiting' && enrollmentId) {
      enrollmentService.cancelEnrollment(enrollmentId).catch(() => {});
    }
    clearEnrollmentTimers();
    setIsAddModalOpen(false);
    setEnrollmentState('idle');
    setEnrollmentId(null);
    setNewCardUID('');
    setNewCardLabel('');
    setFormError('');
  };

  // Handle Card Registration Submit (for both manual & scanner confirmation)
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
        enrollmentId: enrollmentState === 'scanned' ? enrollmentId : undefined,
      });

      toast.success(response.message || `Card ${validation.normalized} registered successfully`);
      handleCloseModal();
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
    <div className="space-y-7">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl sm:text-[28px] font-bold text-zinc-100 tracking-tight">
            RFID Card Management
          </h2>
          <p className="text-[15px] text-zinc-400 mt-1">
            Register, authorize, and revoke physical RFID credentials
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-[15px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setNewCardUID('');
              setNewCardLabel('');
              setEnrollMethod('scanner');
              setEnrollmentState('idle');
              setEnrollmentId(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add RFID Card
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[15px] flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by UID or label..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[13px] text-zinc-400 font-mono mr-1">Status:</span>
          {['all', 'active', 'revoked'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-[15px] font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Table View */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8">
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
                  className="px-4 py-2 text-[15px] font-medium rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4.5 py-2.5 text-[15px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  Register New Card
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase font-mono text-[12px] tracking-wider border-b border-zinc-800/80">
                <tr>
                  <th className="py-4 px-5 font-semibold">Card UID</th>
                  <th className="py-4 px-5 font-semibold">Label / Name</th>
                  <th className="py-4 px-5 font-semibold">Status</th>
                  <th className="py-4 px-5 font-semibold">Registered At</th>
                  <th className="py-4 px-5 text-right font-semibold">Actions</th>
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
                      <td className="py-4 px-5 font-mono font-semibold text-zinc-100 text-[16px]">
                        {card.uid}
                      </td>
                      <td className="py-4 px-5 text-zinc-200">
                        {card.label ? (
                          <span className="font-medium text-zinc-100">{card.label}</span>
                        ) : (
                          <span className="text-zinc-500 italic">No label</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <Badge status={card.status} size="sm" />
                      </td>
                      <td className="py-4 px-5 text-zinc-400 font-mono text-[14px]">
                        {formatDateTime(card.createdAt)}
                      </td>
                      <td className="py-4 px-5 text-right space-x-2.5">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => setCardToRevoke(card)}
                            disabled={isUpdatingStatus}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivateCard(card)}
                            disabled={isUpdatingStatus}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 border-t border-zinc-800/80 bg-zinc-900/20 text-[14px] text-zinc-400">
            <div className="font-mono text-[13px]">
              Showing <span className="text-zinc-200 font-semibold">{filteredCards.length}</span> of{' '}
              <span className="text-zinc-200 font-semibold">{pagination.total}</span> registered cards
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-mono mr-2">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add RFID Card Modal (Method A: Manual & Method B: Remote Scan) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="Register RFID Card"
        description="Add a physical RFID tag or keycard to the authorized door lock system."
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          {/* Method Selection Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                if (enrollmentState === 'waiting') {
                  handleCancelEnrollment();
                }
                setEnrollMethod('scanner');
                setFormError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[15px] font-semibold transition-all cursor-pointer ${
                enrollMethod === 'scanner'
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <SmartphoneNfc className="w-4.5 h-4.5" />
              Scan with ESP8266
            </button>
            <button
              type="button"
              onClick={() => {
                if (enrollmentState === 'waiting') {
                  handleCancelEnrollment();
                }
                setEnrollMethod('manual');
                setFormError('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[15px] font-semibold transition-all cursor-pointer ${
                enrollMethod === 'manual'
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CreditCard className="w-4.5 h-4.5" />
              Manual UID Entry
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[14px] flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{formError}</div>
            </div>
          )}

          {/* METHOD B: Remote Scanner Workflow */}
          {enrollMethod === 'scanner' && (
            <div className="space-y-5">
              {/* Device Selector / Info */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4.5 h-4.5 text-emerald-400" />
                  <span className="text-zinc-400">Target Reader:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{selectedDevice}</span>
                </div>
                <span className="text-[12px] font-mono text-zinc-500 uppercase tracking-wider">
                  MFRC522 RFID
                </span>
              </div>

              {/* State 1: IDLE */}
              {enrollmentState === 'idle' && (
                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-dashed border-zinc-800 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                    <SmartphoneNfc className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-[17px] font-bold text-zinc-100">Ready to Scan</h4>
                    <p className="text-[14px] text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      Click below to place the ESP8266 into remote enrollment mode. You will have 60 seconds to tap an RFID card on the reader.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartRemoteEnrollment}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-semibold transition-colors shadow-md shadow-emerald-950/30 cursor-pointer"
                  >
                    <Radio className="w-4.5 h-4.5" />
                    Start Scanning on ESP8266
                  </button>
                </div>
              )}

              {/* State 2: STARTING / WAITING FOR SCAN */}
              {(enrollmentState === 'starting' || enrollmentState === 'waiting') && (
                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 text-center space-y-4 animate-in fade-in">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 z-10 shadow-lg">
                      <Radio className="w-7 h-7 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[18px] font-bold text-zinc-100">Waiting for Card Scan...</h4>
                    <p className="text-[15px] text-emerald-300 font-medium mt-1">
                      Present your RFID tag or card to the reader on <code className="font-mono text-zinc-200">{selectedDevice}</code>.
                    </p>
                    <p className="text-[13px] text-zinc-500 mt-1">
                      Relay is disabled during enrollment. Scanning will NOT unlock the door.
                    </p>
                  </div>

                  {/* Countdown Timer */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[14px] text-zinc-300 font-mono">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>{remainingSeconds}s remaining</span>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCancelEnrollment}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[14px] font-medium border border-zinc-700/60 transition-colors cursor-pointer"
                    >
                      Cancel Enrollment
                    </button>
                  </div>
                </div>
              )}

              {/* State 3: SCANNED - Confirmation form */}
              {enrollmentState === 'scanned' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300">
                    <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[15px] font-bold text-emerald-200">
                        Card Scanned Successfully!
                      </div>
                      <div className="text-[13px] text-emerald-400">
                        UID detected from ESP8266. Confirm details below to finalize registration.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="scannedUid" className="block text-[15px] font-medium text-zinc-300 mb-1.5">
                      Detected Card UID <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="scannedUid"
                      type="text"
                      required
                      value={newCardUID}
                      onChange={(e) => setNewCardUID(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-zinc-950 border border-emerald-500/40 rounded-xl text-[16px] font-mono text-emerald-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 uppercase tracking-wider font-semibold"
                    />
                  </div>

                  <div>
                    <label htmlFor="scannedLabel" className="block text-[15px] font-medium text-zinc-300 mb-1.5">
                      Card Label / Holder Name <span className="text-zinc-500 font-normal">(optional)</span>
                    </label>
                    <input
                      id="scannedLabel"
                      type="text"
                      autoFocus
                      value={newCardLabel}
                      onChange={(e) => setNewCardLabel(e.target.value)}
                      placeholder="e.g. Master Keycard / Front Door"
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={handleCancelEnrollment}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 text-[15px] font-medium rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Scan Again
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-[15px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Confirm Registration
                    </button>
                  </div>
                </form>
              )}

              {/* State 4: EXPIRED or CANCELLED */}
              {(enrollmentState === 'expired' || enrollmentState === 'cancelled') && (
                <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-4 animate-in fade-in">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[17px] font-bold text-zinc-200">
                      {enrollmentState === 'expired'
                        ? 'Enrollment Session Expired'
                        : 'Enrollment Session Cancelled'}
                    </h4>
                    <p className="text-[14px] text-zinc-400 mt-1 max-w-sm mx-auto">
                      {enrollmentState === 'expired'
                        ? 'No RFID card was scanned within the 60-second window. The device has safely returned to normal access mode.'
                        : 'The remote enrollment session was cancelled.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartRemoteEnrollment}
                    className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[15px] font-semibold border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* METHOD A: Manual UID Entry Form */}
          {enrollMethod === 'manual' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label htmlFor="manualUid" className="block text-[15px] font-medium text-zinc-300 mb-1.5">
                  Card UID <span className="text-rose-400">*</span>
                </label>
                <input
                  id="manualUid"
                  type="text"
                  required
                  autoFocus
                  value={newCardUID}
                  onChange={(e) => setNewCardUID(e.target.value.toUpperCase())}
                  placeholder="e.g. CEE4E857 or 04:A1:B2:C3"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[16px] font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors uppercase tracking-wider font-semibold"
                />
                <p className="mt-1.5 text-[13px] text-zinc-500 font-mono">
                  Accepted formats: 4 to 32 hex characters (e.g. MIFARE Classic 4-byte or Ultralight 7-byte).
                </p>
              </div>

              <div>
                <label htmlFor="manualLabel" className="block text-[15px] font-medium text-zinc-300 mb-1.5">
                  Card Label / Holder Name <span className="text-zinc-500 font-normal">(optional)</span>
                </label>
                <input
                  id="manualLabel"
                  type="text"
                  value={newCardLabel}
                  onChange={(e) => setNewCardLabel(e.target.value)}
                  placeholder="e.g. Pavan (Lab Room 2)"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-[15px] font-medium rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700/60 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[15px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Card
                </button>
              </div>
            </form>
          )}
        </div>
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
