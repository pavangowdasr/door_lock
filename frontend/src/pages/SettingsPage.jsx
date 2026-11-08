import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Cpu,
  ShieldCheck,
  Radio,
  Clock,
  Terminal,
  CheckCircle2,
  Copy,
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
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100 tracking-tight">System Information</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Backend server configuration and IoT hardware integration reference
        </p>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend Node Server Status */}
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Backend Server Runtime</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Health Status:</span>
              <Badge status={healthData?.status || 'unknown'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Process Uptime:</span>
              <span className="font-mono text-zinc-200">
                {loading ? '...' : formatUptime(healthData?.uptime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Server Time:</span>
              <span className="font-mono text-[11px] text-zinc-300">
                {loading ? '...' : formatDateTime(healthData?.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Database & Storage */}
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Database Connection</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Database Type:</span>
              <span className="font-medium text-zinc-200">MongoDB Atlas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Connection State:</span>
              <Badge status={healthData?.database || 'unknown'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Collections:</span>
              <span className="font-mono text-zinc-300">cards, accesslogs</span>
            </div>
          </div>
        </div>

        {/* Administrator Authentication */}
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Active Administrator</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Admin Username:</span>
              <span className="font-mono font-semibold text-zinc-100">{user?.username || 'admin'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Session Mode:</span>
              <span className="font-mono text-emerald-400">HTTP-only Secure Cookie</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Access Scope:</span>
              <span className="text-zinc-300">Single Master Admin</span>
            </div>
          </div>
        </div>

        {/* IoT Device Integration Reference */}
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-zinc-200">ESP8266 Device Interface</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Verification Endpoint:</span>
              <span className="font-mono text-[11px] text-zinc-200">POST /api/access/verify</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Device Auth Header:</span>
              <span className="font-mono text-[11px] text-zinc-300">x-device-api-key</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Key Isolation:</span>
              <span className="text-emerald-400 text-[11px]">Hidden from browser client</span>
            </div>
          </div>
        </div>
      </div>

      {/* ESP8266 Sample Payload Reference Card */}
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">
              ESP8266 NodeMCU Verification Request Specification
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                JSON.stringify({ uid: 'CEE4E857', deviceId: 'esp8266-main-door' }, null, 2),
                'Payload example'
              )
            }
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy JSON
          </button>
        </div>

        <pre className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
{`// HTTP POST http://<backend-ip>:5000/api/access/verify
// Header: x-device-api-key: <DEVICE_API_KEY>
// Header: Content-Type: application/json

{
  "uid": "CEE4E857",
  "deviceId": "esp8266-main-door"
}`}
        </pre>
      </div>
    </div>
  );
}
