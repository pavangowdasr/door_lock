import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Database,
  CreditCard,
  Activity,
  Radio,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { healthService } from '../services/health.service.js';
import { cardsService } from '../services/cards.service.js';
import { logsService } from '../services/logs.service.js';
import { doorService } from '../services/door.service.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge } from '../components/Badge.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { formatDateTime, formatUptime } from '../utils/formatters.js';

export function OverviewPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // System metrics state
  const [healthData, setHealthData] = useState(null);
  const [cardStats, setCardStats] = useState({ total: 0, active: 0, revoked: 0 });
  const [logStats, setLogStats] = useState({ total: 0, granted: 0, denied: 0 });
  const [recentLogs, setRecentLogs] = useState([]);

  // Door Control state
  const [doorStatus, setDoorStatus] = useState({
    deviceId: 'door-lock-01',
    relayState: 'locked',
    remainingUnlockDurationMs: 0,
    lastCommand: null,
  });
  const [isCommandSubmitting, setIsCommandSubmitting] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [activeUnlockTimer, setActiveUnlockTimer] = useState(0);

  const doorPollRef = useRef(null);

  // 1. Fetch dashboard metrics with resilient promise handling
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);

      // Create all requests with independent error fallbacks
      const healthPromise = healthService.getHealth().catch((err) => ({
        status: 'unreachable',
        database: 'unknown',
        error: err.message,
      }));

      const totalCardsPromise = cardsService
        .getCards({ limit: 1 })
        .catch(() => ({ pagination: { total: 0 } }));

      const activeCardsPromise = cardsService
        .getCards({ status: 'active', limit: 1 })
        .catch(() => ({ pagination: { total: 0 } }));

      const revokedCardsPromise = cardsService
        .getCards({ status: 'revoked', limit: 1 })
        .catch(() => ({ pagination: { total: 0 } }));

      const recentLogsPromise = logsService
        .getAccessLogs({ limit: 5 })
        .catch(() => ({ data: [], pagination: { total: 0 } }));

      const grantedLogsPromise = logsService
        .getAccessLogs({ result: 'granted', limit: 1 })
        .catch(() => ({ pagination: { total: 0 } }));

      const deniedLogsPromise = logsService
        .getAccessLogs({ result: 'denied', limit: 1 })
        .catch(() => ({ pagination: { total: 0 } }));

      const doorStatusPromise = doorService
        .getDoorStatus('door-lock-01')
        .catch(() => ({ data: null }));

      // Await all promises with exact variable names (Fixing TDZ error)
      const [
        healthRes,
        totalCardsRes,
        activeCardsRes,
        revokedCardsRes,
        recentLogsRes,
        grantedLogsRes,
        deniedLogsRes,
        doorStatusRes,
      ] = await Promise.all([
        healthPromise,
        totalCardsPromise,
        activeCardsPromise,
        revokedCardsPromise,
        recentLogsPromise,
        grantedLogsPromise,
        deniedLogsPromise,
        doorStatusPromise,
      ]);

      setHealthData(healthRes);
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

      if (doorStatusRes?.data) {
        setDoorStatus(doorStatusRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Poll door status periodically (every 2.5s)
  const pollDoorStatus = useCallback(async () => {
    try {
      const res = await doorService.getDoorStatus('door-lock-01');
      if (res && res.success && res.data) {
        setDoorStatus(res.data);
        if (res.data.relayState === 'unlocking') {
          setActiveUnlockTimer(Math.max(1, Math.ceil((res.data.remainingUnlockDurationMs || 3000) / 1000)));
        } else {
          setActiveUnlockTimer(0);
        }
      }
    } catch {
      // transient polling failure
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Setup door status polling interval
    doorPollRef.current = setInterval(pollDoorStatus, 2500);

    return () => {
      if (doorPollRef.current) clearInterval(doorPollRef.current);
    };
  }, [fetchDashboardData, pollDoorStatus]);

  // Active unlock timer countdown
  useEffect(() => {
    if (activeUnlockTimer <= 0) return;

    const timer = setInterval(() => {
      setActiveUnlockTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          pollDoorStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeUnlockTimer, pollDoorStatus]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // 2. Door Control Handlers
  const handleConfirmUnlock = async () => {
    setShowUnlockConfirm(false);
    setIsCommandSubmitting(true);
    try {
      const res = await doorService.unlockDoor('door-lock-01');
      toast.success(res.message || 'Remote unlock command queued (3 seconds)');
      setActiveUnlockTimer(3);
      pollDoorStatus();
      fetchDashboardData();
    } catch (err) {
      toast.error(err.message || 'Failed to send remote unlock command');
    } finally {
      setIsCommandSubmitting(false);
    }
  };

  const handleImmediateLock = async () => {
    setIsCommandSubmitting(true);
    try {
      const res = await doorService.lockDoor('door-lock-01');
      toast.success(res.message || 'Immediate lock command queued');
      setActiveUnlockTimer(0);
      pollDoorStatus();
      fetchDashboardData();
    } catch (err) {
      toast.error(err.message || 'Failed to send immediate lock command');
    } finally {
      setIsCommandSubmitting(false);
    }
  };

  const isBackendHealthy = healthData?.status === 'ok';
  const isDbConnected = healthData?.database === 'connected';

  // Last command formatting
  const lastCmd = doorStatus?.lastCommand;
  const isCommandPending = lastCmd?.status === 'pending';
  const isRelayUnlocking = doorStatus?.relayState === 'unlocking' || activeUnlockTimer > 0;

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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-[15px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <Link
            to="/cards"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-semibold shadow-xs transition-colors"
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

      {/* REMOTE DOOR CONTROL SECTION */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-zinc-100">Remote Door Control</h3>
              <p className="text-[14px] text-zinc-400">
                Direct relay actuator command interface for <span className="font-mono text-zinc-200">door-lock-01</span>
              </p>
            </div>
          </div>

          {/* Current Relay State Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-zinc-400 font-mono">Relay State:</span>
            {isRelayUnlocking ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[13px] font-mono font-semibold animate-pulse">
                <Unlock className="w-4 h-4" />
                Unlock pulse active ({activeUnlockTimer}s)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-[13px] font-mono font-semibold">
                <Lock className="w-4 h-4 text-emerald-400" />
                Relay locked
              </span>
            )}
          </div>
        </div>

        {/* Action Controls & Real-time State Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 pt-1">
          {/* Action 1: Remote Unlock */}
          <div className="p-4.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[15px] font-bold text-zinc-100 flex items-center gap-2">
                <Unlock className="w-4.5 h-4.5 text-emerald-400" />
                Timed Unlock (3s)
              </div>
              <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
                Sends an authenticated command to energize the relay for 3 seconds. The ESP8266 automatically re-locks.
              </p>
            </div>

            <button
              type="button"
              disabled={isCommandSubmitting || isCommandPending || isRelayUnlocking}
              onClick={() => setShowUnlockConfirm(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[15px] font-semibold transition-all shadow-xs disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isCommandSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Command...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock for 3 Seconds</span>
                </>
              )}
            </button>
          </div>

          {/* Action 2: Immediate Lock */}
          <div className="p-4.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[15px] font-bold text-zinc-100 flex items-center gap-2">
                <Lock className="w-4.5 h-4.5 text-rose-400" />
                Immediate Lock
              </div>
              <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
                Immediately deactivates the relay and overrides any ongoing unlock pulse or pending command.
              </p>
            </div>

            <button
              type="button"
              disabled={isCommandSubmitting}
              onClick={handleImmediateLock}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[15px] font-semibold transition-all shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Lock Now</span>
            </button>
          </div>

          {/* Command Status Box */}
          <div className="p-4.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2.5 text-[14px]">
            <div className="text-[14px] font-semibold text-zinc-300 pb-1 border-b border-zinc-800 flex items-center justify-between">
              <span>Command Lifecycle</span>
              {lastCmd?.status && (
                <span
                  className={`text-[12px] font-mono uppercase px-2 py-0.5 rounded font-medium ${
                    lastCmd.status === 'executed'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : lastCmd.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {lastCmd.status}
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between text-zinc-400">
                <span>Last Action:</span>
                <span className="font-mono text-zinc-200 capitalize font-medium">
                  {lastCmd ? `${lastCmd.type} (${lastCmd.status})` : 'None'}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Command Time:</span>
                <span className="font-mono text-zinc-300 text-[12px]">
                  {lastCmd?.createdAt ? formatDateTime(lastCmd.createdAt) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Target Node:</span>
                <span className="font-mono text-zinc-300 text-[12px]">
                  {doorStatus?.deviceId || 'door-lock-01'}
                </span>
              </div>
            </div>

            <p className="text-[12px] text-zinc-500 italic pt-1 leading-normal">
              * Relies on actuator relay state. No physical door-closed sensor is installed.
            </p>
          </div>
        </div>
      </div>

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
              Access is verified per tap via <code className="text-zinc-300 font-mono text-[13px]">DEVICE_API_KEY</code>. Remote card enrollment and door commands are polled every 1.5 seconds.
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
                  <th className="py-4 px-5">Card UID / Trigger</th>
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
                        {log.reason ? log.reason.replace(/_/g, ' ') : '—'}
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

      {/* Confirmation Dialog for Remote Unlock */}
      <ConfirmDialog
        isOpen={showUnlockConfirm}
        onClose={() => setShowUnlockConfirm(false)}
        onConfirm={handleConfirmUnlock}
        title="Confirm Remote Unlock"
        message="Are you sure you want to remotely energize the relay on door-lock-01? The door will unlock for exactly 3 seconds before automatically re-locking."
        confirmLabel="Unlock Door"
        cancelLabel="Cancel"
        isDestructive={false}
        isLoading={isCommandSubmitting}
      />
    </div>
  );
}
