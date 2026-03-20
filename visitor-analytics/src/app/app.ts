import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

interface Alert {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  zone: string;
  time: string;
}

interface Zone {
  id: string;
  name: string;
  count: number;
  pct: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  area: string;
}

type TabRange = '24h' | '7d' | '30d';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  constructor(private cdr: ChangeDetectorRef) {}
  // Stats
  totalVisitors = 14382;
  currentOccupancy = 3247;
  occupancyPct = 68;
  dwellTime = 24;
  activeSensors = 47;

  // Clock
  currentTime = '';

  // Chart
  activeTab: TabRange = '24h';
  todayLine = '';
  todayArea = '';
  yesterdayLine = '';
  yesterdayArea = '';
  liveDotXPct = 0;
  liveDotYPct = 0;

  // Alerts
  alertCount = 3;
  alerts: Alert[] = [
    { id: 1, severity: 'critical', message: 'Occupancy threshold exceeded', zone: 'Gate B, Departures', time: '2 min ago' },
    { id: 2, severity: 'warning',  message: 'High dwell time detected',      zone: 'Security Screening',   time: '8 min ago' },
    { id: 3, severity: 'warning',  message: 'Sensor signal degraded',         zone: 'Gate C12',             time: '14 min ago' },
    { id: 4, severity: 'info',     message: 'Visitor flow normalising',       zone: 'Arrivals Hall',        time: '21 min ago' },
    { id: 5, severity: 'info',     message: 'Daily peak reached, 3,400 visitors', zone: 'Terminal 1',    time: '1 hr ago' },
  ];

  // Zones
  zones: Zone[] = [
    { id: 'checkin',  name: 'Check-in',   count: 412, pct: 82, level: 'critical', area: '1 / 1 / 3 / 3' },
    { id: 'security', name: 'Security',   count: 338, pct: 68, level: 'high',     area: '1 / 3 / 3 / 5' },
    { id: 'depart',   name: 'Departures', count: 890, pct: 74, level: 'high',     area: '1 / 5 / 3 / 8' },
    { id: 'retail',   name: 'Retail Zone',count: 521, pct: 52, level: 'medium',   area: '3 / 1 / 5 / 4' },
    { id: 'food',     name: 'Food Court', count: 674, pct: 67, level: 'high',     area: '3 / 4 / 5 / 6' },
    { id: 'lounge',   name: 'Lounges',    count: 198, pct: 40, level: 'medium',   area: '3 / 6 / 5 / 8' },
    { id: 'arrivals', name: 'Arrivals',   count: 214, pct: 21, level: 'low',      area: '5 / 1 / 7 / 5' },
    { id: 'transit',  name: 'Transit',    count:  87, pct: 17, level: 'low',      area: '5 / 5 / 7 / 8' },
  ];

  private subs = new Subscription();
  private datasets: Record<TabRange, { today: number[]; yesterday: number[] }> = {
    '24h': { today: [], yesterday: [] },
    '7d':  { today: [], yesterday: [] },
    '30d': { today: [], yesterday: [] },
  };

  ngOnInit() {
    this.generateAllDatasets();
    this.updateClock();
    this.buildPaths();
    this.subs.add(interval(1000).subscribe(() => this.tick()));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  setTab(tab: TabRange) {
    this.activeTab = tab;
    this.buildPaths();
    this.cdr.detectChanges();
  }

  get chartSubtitle(): string {
    const map: Record<TabRange, string> = {
      '24h':  'Entries per hour · Today vs Yesterday',
      '7d':   'Daily entries · This week vs last week',
      '30d':  'Daily entries · This month vs last month',
    };
    return map[this.activeTab];
  }

  get xAxisLabels(): string[] {
    if (this.activeTab === '24h') {
      return ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'];
    }
    if (this.activeTab === '7d') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date().getDay();
      return Array.from({ length: 7 }, (_, i) => days[(today - 6 + i + 7) % 7]);
    }
    // 30d — 6 evenly-spaced date labels
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + Math.round(i * 29 / 5));
      return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
    });
  }

  get chartLegend(): [string, string] {
    const map: Record<TabRange, [string, string]> = {
      '24h':  ['Today',      'Yesterday'],
      '7d':   ['This week',  'Last week'],
      '30d':  ['This month', 'Last month'],
    };
    return map[this.activeTab];
  }

  private tick() {
    this.updateClock();
    this.totalVisitors += Math.floor(Math.random() * 4);
    this.currentOccupancy += Math.floor(Math.random() * 10) - 4;
    this.currentOccupancy = Math.max(2800, Math.min(4800, this.currentOccupancy));
    this.occupancyPct = Math.round((this.currentOccupancy / 4800) * 100);
    this.dwellTime = 22 + Math.floor(Math.random() * 5);

    // Smooth random walk on the last live point of 24h only
    if (this.activeTab === '24h') {
      const d = this.datasets['24h'].today;
      const last = d.length - 1;
      d[last] = Math.max(15, Math.min(185, d[last] + (Math.random() - 0.48) * 8));
    }

    this.buildPaths();
    this.cdr.detectChanges();
  }

  private updateClock() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-AU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // ── Data generation ──────────────────────────────────────────

  private generateAllDatasets() {
    const nowHour = new Date().getHours();

    // 24h: hourly, partial today up to current hour
    const hourly = (partial: number) =>
      Array.from({ length: partial }, (_, i) => {
        const base = 20 + 80 * Math.sin((i - 5) * Math.PI / 14);
        return Math.max(10, Math.round(base + (Math.random() - 0.5) * 22));
      });

    this.datasets['24h'].today     = hourly(nowHour + 1);
    this.datasets['24h'].yesterday = hourly(24);

    // 7d: daily, simulate a week pattern
    const weekly = (offset: number) =>
      [820, 1140, 1320, 1280, 1450, 1800, 1650].map(v =>
        Math.max(400, Math.round(v * (0.85 + Math.random() * 0.3) + offset))
      );

    this.datasets['7d'].today     = weekly(0);
    this.datasets['7d'].yesterday = weekly(-60);

    // 30d: daily, simulate a month with a growth trend
    const monthly = (offset: number) =>
      Array.from({ length: 30 }, (_, i) => {
        const trend = 800 + i * 12;
        const wave  = 200 * Math.sin(i * Math.PI / 7);
        return Math.max(400, Math.round(trend + wave + (Math.random() - 0.5) * 120 + offset));
      });

    this.datasets['30d'].today     = monthly(0);
    this.datasets['30d'].yesterday = monthly(-80);
  }

  // ── Path building ─────────────────────────────────────────────

  private buildPaths() {
    const W = 700, H = 200, pad = 10;
    const chartH = H - pad * 2;

    const ds = this.datasets[this.activeTab];
    const today = ds.today;
    const yesterday = ds.yesterday;
    const maxLen = Math.max(today.length, yesterday.length);
    const maxVal = Math.max(...today, ...yesterday) * 1.08;

    const toSVG = (data: number[]) =>
      data.map((v, i) => ({
        x: (i / (maxLen - 1)) * W,
        y: pad + chartH - (v / maxVal) * chartH,
      }));

    const smoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
      let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const t = 0.18;
        const cp1x = p1.x + (p2.x - p0.x) * t;
        const cp1y = p1.y + (p2.y - p0.y) * t;
        const cp2x = p2.x - (p3.x - p1.x) * t;
        const cp2y = p2.y - (p3.y - p1.y) * t;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return d;
    };

    const areaPath = (pts: { x: number; y: number }[], linePath: string) => {
      const first = pts[0];
      const last  = pts[pts.length - 1];
      return `${linePath} L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`;
    };

    const ydPts = toSVG(yesterday);
    const ydLine = smoothPath(ydPts);
    this.yesterdayLine = ydLine;
    this.yesterdayArea = areaPath(ydPts, ydLine);

    const tdPts = toSVG(today);
    const tdLine = smoothPath(tdPts);
    this.todayLine = tdLine;
    this.todayArea = areaPath(tdPts, tdLine);

    // Live dot — as percentage of chart box (avoids SVG stretch distortion)
    const live = tdPts[tdPts.length - 1];
    this.liveDotXPct = (live.x / W) * 100;
    this.liveDotYPct = (live.y / H) * 100;
  }
}
