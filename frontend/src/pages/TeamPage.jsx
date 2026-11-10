import React from 'react';
import {
  Users,
  Cpu,
  Code2,
  ShieldCheck,
  Radio,
  Sparkles,
  Terminal,
  Layers,
  CheckCircle2,
} from 'lucide-react';

const TEAM_MEMBERS = [
  {
    name: 'Pavan Gowda S R',
    role: 'Lead Full-Stack & Systems Developer',
    description:
      'Architected the Node.js/Express backend, MongoDB Atlas integration, React administrative dashboard, and coordinated hardware-to-cloud security workflows.',
    tag: 'Team Lead',
    accent: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    avatarBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    skills: ['Full-Stack', 'Node.js', 'React', 'MongoDB'],
  },
  {
    name: 'Neeraj R',
    role: 'Embedded Systems & Firmware Engineer',
    description:
      'Engineered the ESP8266 NodeMCU C++ firmware, MFRC522 SPI RFID driver communication, non-blocking polling state machine, and relay timing logic.',
    tag: 'Firmware',
    accent: 'sky',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    avatarBg: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    skills: ['ESP8266', 'C/C++', 'PlatformIO', 'MFRC522'],
  },
  {
    name: 'Pragati',
    role: 'Hardware Design & Circuit Integration',
    description:
      'Designed the hardware circuit schematic, power delivery for the 12V solenoid lock, optocoupler-isolated 5V relay switching, and physical prototype assembly.',
    tag: 'Hardware',
    accent: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    avatarBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    skills: ['Circuit Design', 'Relay Switching', 'Power Delivery', 'Wiring'],
  },
  {
    name: 'Pavitra Smitha',
    role: 'System Verification & Frontend QA',
    description:
      'Led comprehensive testing of the authorization workflows, dashboard responsiveness, live card enrollment validation, and access log audit accuracy.',
    tag: 'Quality & Testing',
    accent: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    avatarBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    skills: ['System Testing', 'UI Verification', 'Access Audits', 'Documentation'],
  },
];

const PROJECT_HIGHLIGHTS = [
  {
    icon: Radio,
    title: 'IoT Hardware Layer',
    desc: 'ESP8266 NodeMCU with 13.56 MHz MFRC522 RFID reader and 5V optocoupled relay driving a 12V solenoid door strike.',
  },
  {
    icon: Code2,
    title: 'Cloud REST Engine',
    desc: 'Node.js & Express REST API with MongoDB Atlas, cryptographic scrypt hashing, and dual API-key authentication.',
  },
  {
    icon: Layers,
    title: 'Live Admin Dashboard',
    desc: 'React 19 + Vite + Tailwind CSS v4 dashboard supporting real-time card enrollment, remote door control, and audit logs.',
  },
];

export function TeamPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-3.5 h-3.5" />
              Project Development Team
            </span>
          </div>
          <h2 className="text-2xl sm:text-[30px] font-bold text-zinc-100 tracking-tight">
            Our Team
          </h2>
          <p className="text-[15px] sm:text-[16px] text-zinc-400 mt-1">
            The engineering team behind the IoT RFID Door Lock Management System
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[14px] text-zinc-300 font-mono flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>4 Active Collaborators</span>
          </div>
        </div>
      </div>

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TEAM_MEMBERS.map((member) => (
          <div
            key={member.name}
            className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Member header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[17px] border shrink-0 ${member.avatarBg}`}
                  >
                    {member.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold text-zinc-100 tracking-tight">
                      {member.name}
                    </h3>
                    <p className="text-[14px] font-medium text-emerald-400 mt-0.5">
                      {member.role}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-mono uppercase tracking-wider border shrink-0 ${member.badgeClass}`}
                >
                  {member.tag}
                </span>
              </div>

              {/* Bio / Description */}
              <p className="text-[15px] text-zinc-400 leading-relaxed mt-4">
                {member.description}
              </p>
            </div>

            {/* Skills / Focus tags */}
            <div className="pt-3 border-t border-zinc-800/60 flex flex-wrap gap-2">
              {member.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800/60 text-zinc-300 text-[13px] font-mono border border-zinc-700/40"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Project Overview Card */}
      <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[18px] font-bold text-zinc-100">
              IoT RFID Door Lock Management System
            </h3>
            <p className="text-[14px] text-zinc-400">
              Joint Engineering & Embedded Systems Capstone Project
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {PROJECT_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/60 space-y-2"
              >
                <div className="flex items-center gap-2 text-emerald-400">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[15px] font-semibold text-zinc-200">{item.title}</span>
                </div>
                <p className="text-[14px] text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-2 text-[14px] text-zinc-500 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Designed and built collaboratively by Pavan Gowda S R, Neeraj R, Pragati, and Pavitra Smitha.
          </span>
        </div>
      </div>
    </div>
  );
}
