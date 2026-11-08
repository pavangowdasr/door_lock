import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { logsService } from '../services/logs.service.js';
import { Badge } from '../components/Badge.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { TableSkeleton } from '../components/TableSkeleton.jsx';
import { formatDateTime } from '../utils/formatters.js';

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [resultFilter, setResultFilter] = useState('all'); // 'all' | 'granted' | 'denied'
  const [uidInput, setUidInput] = useState('');
  const [appliedUid, setAppliedUid] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const res = await logsService.getAccessLogs({
        page,
        limit,
        result: resultFilter,
        uid: appliedUid,
      });

      if (res && res.success) {
        setLogs(res.data || []);
        if (res.pagination) {
          setPagination({
            total: res.pagination.total,
            totalPages: Math.max(1, res.pagination.totalPages),
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load access logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, resultFilter, appliedUid]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedUid(uidInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setUidInput('');
    setAppliedUid('');
    setPage(1);
  };

  const handleFilterChange = (result) => {
    setResultFilter(result);
    setPage(1);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl sm:text-[28px] font-bold text-zinc-100 tracking-tight">
            Door Access History
          </h2>
          <p className="text-[15px] text-zinc-400 mt-1">
            Audit log of all RFID door lock scan attempts from ESP8266 devices
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
            Refresh Logs
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[15px] flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
        {/* UID Filter Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2.5 flex-1 max-w-lg">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4.5 h-4.5" />
            </div>
            <input
              type="text"
              value={uidInput}
              onChange={(e) => setUidInput(e.target.value.toUpperCase())}
              placeholder="Filter by Card UID (e.g. CEE4E857)..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-[15px] font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors uppercase font-medium"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[15px] font-medium border border-zinc-700/60 transition-colors cursor-pointer"
          >
            Search
          </button>
          {appliedUid && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-3 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-[15px] transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>

        {/* Result Filter Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-[13px] text-zinc-400 font-mono mr-1">Result:</span>
          {['all', 'granted', 'denied'].map((res) => (
            <button
              key={res}
              type="button"
              onClick={() => handleFilterChange(res)}
              className={`px-3.5 py-2 rounded-xl text-[15px] font-medium capitalize transition-colors cursor-pointer ${
                resultFilter === res
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {res}
            </button>
          ))}
        </div>
      </div>

      {/* Access Logs Table */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8">
            <TableSkeleton rows={8} cols={5} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title={appliedUid || resultFilter !== 'all' ? 'No matching logs' : 'No access logs yet'}
            description={
              appliedUid || resultFilter !== 'all'
                ? 'No access records match your current filters. Try resetting search or result filter.'
                : 'Access attempts recorded by the ESP8266 door lock device will appear here automatically.'
            }
            action={
              (appliedUid || resultFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearSearch();
                    setResultFilter('all');
                  }}
                  className="px-4 py-2 text-[15px] font-medium rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Reset All Filters
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
                  <th className="py-4 px-5 font-semibold">Device ID</th>
                  <th className="py-4 px-5 font-semibold">Result</th>
                  <th className="py-4 px-5 font-semibold">Reason</th>
                  <th className="py-4 px-5 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {logs.map((log) => {
                  const isGranted = log.result === 'granted';

                  return (
                    <tr
                      key={log._id || `${log.uid}-${log.timestamp}`}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-4 px-5 font-mono font-medium text-zinc-100 text-[16px]">
                        {log.uid}
                      </td>
                      <td className="py-4 px-5 font-mono text-zinc-300 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-zinc-500" />
                        {log.deviceId}
                      </td>
                      <td className="py-4 px-5">
                        <Badge
                          status={log.result}
                          label={isGranted ? 'Granted' : 'Denied'}
                          size="sm"
                        />
                      </td>
                      <td className="py-4 px-5 font-mono text-[14px]">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[13px] ${
                            isGranted
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-rose-500/10 text-rose-300'
                          }`}
                        >
                          {log.reason || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-zinc-400 font-mono text-[14px]">
                        {formatDateTime(log.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 border-t border-zinc-800/80 bg-zinc-900/20 text-[14px] text-zinc-400">
            <div className="font-mono text-[13px]">
              Showing <span className="text-zinc-200 font-semibold">{logs.length}</span> of{' '}
              <span className="text-zinc-200 font-semibold">{pagination.total}</span> records (newest first)
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
    </div>
  );
}
