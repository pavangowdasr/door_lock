import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  ShieldCheck,
  Radio,
  Clock,
  Terminal,
  Copy,
  SmartphoneNfc,
} from 'lucide-react';
import { healthService } from '../services/health.service.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge } from '../components/Badge.jsx';
import { formatUptime, formatDateTime } from '../utils/formatters.js';

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const data = await healthService.getHealth();
        setHealthData(data);
      } catch (err) {
        setHealthData({ status: 'unreachable', database: 'unknown', error: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-7 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-2xl sm:text-[28px] font-bold text-zinc-100 tracking-tight">
          System Information
        </h2>
        <p className="text-[15px] text-zinc-400 mt-1">
          Backend server configuration and IoT hardware integration reference
        </p>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
        {/* Backend Node Server Status */}
        <div className="p-5.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[16px] font-bold text-zinc-200">Backend Server Runtime</h3>
          </div>

          <div className="space-y-3 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Health Status:</span>
              <Badge status={healthData?.status || 'unknown'} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Process Uptime:</span>
              <span className="font-mono text-zinc-200 font-medium">
                {loading ? '...' : formatUptime(healthData?.uptime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Server Time:</span>
              <span className="font-mono text-[14px] text-zinc-300">
                {loading ? '...' : formatDateTime(healthData?.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Database & Storage */}
        <div className="p-5.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[16px] font-bold text-zinc-200">Database Connection</h3>
          </div>

          <div className="space-y-3 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Database Type:</span>
              <span className="font-medium text-zinc-200">MongoDB Atlas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Connection State:</span>
              <Badge status={healthData?.database || 'unknown'} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Collections:</span>
              <span className="font-mono text-zinc-300 text-[14px]">cards, accesslogs, enrollments</span>
            </div>
          </div>
        </div>

        {/* Administrator Authentication */}
        <div className="p-5.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[16px] font-bold text-zinc-200">Active Administrator</h3>
          </div>

          <div className="space-y-3 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Admin Username:</span>
              <span className="font-mono font-bold text-zinc-100">{user?.username || 'admin'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Session Mode:</span>
              <span className="font-mono text-emerald-400 font-medium">HTTP-only Secure Cookie</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Access Scope:</span>
              <span className="text-zinc-300">Single Master Admin</span>
            </div>
          </div>
        </div>

        {/* IoT Device Integration Reference */}
        <div className="p-5.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <Radio className="w-5 h-5 text-emerald-400" />
            <h3 className="text-[16px] font-bold text-zinc-200">ESP8266 Device Interface</h3>
          </div>

          <div className="space-y-3 text-[15px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Verification Endpoint:</span>
              <span className="font-mono text-[13px] text-zinc-200">POST /api/access/verify</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Enrollment Polling:</span>
              <span className="font-mono text-[13px] text-zinc-200">GET /api/enrollment/device/status</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Device Auth Header:</span>
              <span className="font-mono text-[13px] text-zinc-300">x-device-api-key</span>
            </div>
          </div>
        </div>
      </div>

      {/* ESP8266 Sample Payload Reference Card */}
      <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-zinc-400" />
            <h3 className="text-[16px] font-bold text-zinc-200">
              ESP8266 Remote Enrollment Specification
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                JSON.stringify({ deviceId: 'door-lock-01', uid: 'CEE4E857' }, null, 2),
                'Payload example'
              )
            }
            className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            Copy JSON
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-[14px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
{`// 1. Check if enrollment requested by dashboard:
// GET http://<server>:5000/api/enrollment/device/status?deviceId=door-lock-01
// Header: x-device-api-key: <DEVICE_API_KEY>

// 2. Submit scanned card during enrollment (Relay remains locked):
// POST http://<server>:5000/api/enrollment/device/scan
// Header: x-device-api-key: <DEVICE_API_KEY>
// Header: Content-Type: application/json
{
  "deviceId": "door-lock-01",
  "uid": "CEE4E857"
}`}
        </pre>
      </div>
    </div>
  );
}
