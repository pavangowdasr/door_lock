import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Database,
  CreditCard,
  CheckCircle2,
  XCircle,
  Activity,
  Radio,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { healthService } from '../services/health.service.js';
import { cardsService } from '../services/cards.service.js';
import { logsService } from '../services/logs.service.js';
import { Badge } from '../components/Badge.jsx';
import { formatDateTime, formatUptime } from '../utils/formatters.js';

export function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [healthData, setHealthData] = useState(null);
  const [cardStats, setCardStats] = useState({ total: 0, active: 0, revoked: 0 });
  const [logStats, setLogStats] = useState({ total: 0, granted: 0, denied: 0 });
  const [recentLogs, setRecentLogs] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);

      // 1. Fetch Health
      const healthPromise = healthService.getHealth().catch((err) => ({
        status: 'unreachable',
        database: 'unknown',
        error: err.message,
      }));

      // 2. Fetch Card Counts using backend pagination totals
      const totalCardsPromise = cardsService.getCards({ limit: 1 }).catch(() => ({ pagination: { total: 0 } }));
      const activeCardsPromise = cardsService.getCards({ status: 'active', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));
      const revokedCardsPromise = cardsService.getCards({ status: 'revoked', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));

      // 3. Fetch Access Log Counts & Recent attempts
      const recentLogsPromise = logsService.getAccessLogs({ limit: 5 }).catch(() => ({ data: [], pagination: { total: 0 } }));
      const grantedLogsPromise = logsService.getAccessLogs({ result: 'granted', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));
      const deniedLogsPromise = logsService.getAccessLogs({ result: 'denied', limit: 1 }).catch(() => ({ pagination: { total: 0 } }));

      const [
        health,
        totalCardsRes,
        activeCardsRes,
        revokedCardsRes,
        recentLogsRes,
        grantedLogsRes,
        deniedLogsRes,
      ] = await Promise.all([
        healthPromise,
        totalCardsPromise,
        activeCardsPromise,
        revokedCardsPromise,
        recentLogsPromise,
        grantedLogsRes,
        deniedLogsRes,
      ]);

      setHealthData(health);
      setCardStats({
        total: totalCardsRes?.pagination?.total ?? 0,
        active: activeCardsRes?.pagination?.total ?? 0,
        revoked: revokedCardsRes?.pagination?.total ?? 0,
      });

      setLogStats({
        total: recentLogsRes?.pagination?.total ?? 0,
        granted: grantedLogsRes?.pagination?.total ?? 0,
        denied: deniedLogsRes?.pagination?.total ?? 0,
      });

      setRecentLogs(recentLogsRes?.data ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const isBackendHealthy = healthData?.status === 'ok';
  const isDbConnected = healthData?.database === 'connected';

  return (
    <div className="space-y-7">
      {/* Top Banner & Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-2xl sm:text-[28px] font-bold text-zinc-100 tracking-tight">
            System Overview
          </h2>
          <p className="text-[15px] text-zinc-400 mt-1">
            Operational status and access activity for RFID door lock system
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-[15px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <Link
            to="/cards"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-semibold shadow-xs transition-colors"
          >
            Manage Cards
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[15px] flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Honest IoT Hardware Connectivity Indicator Banner */}
      <div className="p-4.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-[15px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-zinc-200 text-[16px]">
              ESP8266 Hardware Access Control & Enrollment
            </div>
            <div className="text-zinc-400 text-[14px] mt-0.5">
              Access is verified per tap via <code className="text-zinc-300 font-mono text-[13px]">DEVICE_API_KEY</code>. Remote card enrollment is polled every 1.5 seconds.
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-[13px] font-mono text-zinc-300 shrink-0">
          Device Polling Active
        </div>
      </div>

      {/* Infrastructure & Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
        {/* Backend API Status */}
        <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
          <div className="flex items-center justify-between text-zinc-400 text-[15px]">
            <span className="font-medium flex items-center gap-2">
              <Server className="w-4 h-4 text-zinc-400" />
              API Server
            </span>
            <Badge status={healthData?.status || 'unknown'} />
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-100 font-mono">
              {isBackendHealthy ? 'Online' : 'Degraded'}
            </div>
            <div className="text-[14px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              Uptime: {formatUptime(healthData?.uptime)}
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
          <div className="flex items-center justify-between text-zinc-400 text-[15px]">
            <span className="font-medium flex items-center gap-2">
              <Database className="w-4 h-4 text-zinc-400" />
              MongoDB Atlas
            </span>
            <Badge status={healthData?.database || 'unknown'} />
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-100 font-mono capitalize">
              {healthData?.database || 'Checking...'}
            </div>
            <div className="text-[14px] text-zinc-400 truncate pt-0.5">
              {isDbConnected ? 'Connection established' : 'Check connection string'}
            </div>
          </div>
        </div>

        {/* Total Registered Cards */}
        <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
          <div className="flex items-center justify-between text-zinc-400 text-[15px]">
            <span className="font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-zinc-400" />
              Total Cards
            </span>
            <Link
              to="/cards"
              className="text-[14px] font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
            >
              View <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-100 font-mono">
              {loading ? '...' : cardStats.total}
            </div>
            <div className="text-[14px] text-zinc-400 flex items-center gap-2.5 pt-0.5">
              <span className="text-emerald-400 font-medium">{cardStats.active} Active</span>
              <span className="text-zinc-600">•</span>
              <span className="text-rose-400 font-medium">{cardStats.revoked} Revoked</span>
            </div>
          </div>
        </div>

        {/* Access Log Events */}
        <div className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
          <div className="flex items-center justify-between text-zinc-400 text-[15px]">
            <span className="font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              Total Access Logs
            </span>
            <Link
              to="/logs"
              className="text-[14px] font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
            >
              Logs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-[34px] font-bold tracking-tight text-zinc-100 font-mono">
              {loading ? '...' : logStats.total}
            </div>
            <div className="text-[14px] text-zinc-400 flex items-center gap-2.5 pt-0.5">
              <span className="text-emerald-400 font-medium">{logStats.granted} Granted</span>
              <span className="text-zinc-600">•</span>
              <span className="text-rose-400 font-medium">{logStats.denied} Denied</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Access Attempts Table */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[17px] font-bold text-zinc-100">Recent Access Attempts</h3>
          </div>
          <Link
            to="/logs"
            className="text-[14px] font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            Full Access Log <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[15px] text-zinc-500 font-mono">
            Loading recent access attempts...
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="p-10 text-center text-[15px] text-zinc-500">
            No access verification attempts recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase font-mono text-[12px] tracking-wider border-b border-zinc-800/80">
                <tr>
                  <th className="py-4 px-5">Card UID</th>
                  <th className="py-4 px-5">Device ID</th>
                  <th className="py-4 px-5">Result</th>
                  <th className="py-4 px-5">Reason</th>
                  <th className="py-4 px-5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {recentLogs.map((log) => {
                  const isGranted = log.result === 'granted';
                  return (
                    <tr
                      key={log._id || `${log.uid}-${log.timestamp}`}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-4 px-5 font-mono font-medium text-zinc-100">
                        {log.uid}
                      </td>
                      <td className="py-4 px-5 font-mono text-zinc-300">
                        {log.deviceId}
                      </td>
                      <td className="py-4 px-5">
                        <Badge
                          status={log.result}
                          label={isGranted ? 'Granted' : 'Denied'}
                          size="sm"
                        />
                      </td>
                      <td className="py-4 px-5 text-zinc-300 capitalize">
                        {log.reason ? log.reason.replace('_', ' ') : '—'}
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
      </div>
    </div>
  );
}
