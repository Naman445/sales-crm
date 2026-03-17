import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, PointElement, LineElement,
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp, ThumbsDown, CheckCircle,
  Calendar, IndianRupee, Package, Flame,
  Factory, Clock, Target, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { Meeting } from '../types';
import { format, parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, PointElement, LineElement
);

interface Props {
  meetings: Meeting[];
  loading?: boolean;
}

const LEAD_COLORS: Record<string, string> = {
  Hot: '#ef4444',
  Warm: '#f97316',
  Cold: '#3b82f6',
  Dead: '#6b7280',
  Closed: '#22c55e',
};

// ── Duration parser ───────────────────────────────────────────────────────────
function durationToMinutes(d: string): number {
  if (d.includes('2+')) return 150;
  if (d.includes('2 hour')) return 120;
  if (d.includes('1.5')) return 90;
  if (d.includes('1 hour')) return 60;
  if (d.includes('45')) return 45;
  if (d.includes('30')) return 30;
  if (d.includes('15')) return 15;
  return 30;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 border-l-4 ${color}`}
    >
      <div className="p-3 rounded-xl bg-gray-50 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-800 truncate">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Deals Table ───────────────────────────────────────────────────────────────
function DealsTable({ meetings }: { meetings: Meeting[] }) {
  const deals = meetings
    .filter((m) => m.response === 'Deal Closed' && m.dealAmount)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (deals.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md p-5">
      <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Package size={16} className="text-emerald-600" /> Closed Deals
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="pb-2 pr-4">Client</th>
              <th className="pb-2 pr-4">Company</th>
              <th className="pb-2 pr-4">Industry</th>
              <th className="pb-2 pr-4">Product</th>
              <th className="pb-2 pr-4 text-right">Deal Amount</th>
              <th className="pb-2 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-2.5 pr-4 font-medium text-gray-800">{m.name}</td>
                <td className="py-2.5 pr-4 text-gray-600">{m.companyName}</td>
                <td className="py-2.5 pr-4">
                  <span className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {m.industry || '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {m.productSold || '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right font-bold text-emerald-700">
                  ₹{(m.dealAmount || 0).toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 text-right text-gray-400 text-xs">
                  {format(parseISO(m.createdAt), 'dd MMM yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Industry Analytics Section ────────────────────────────────────────────────
interface IndustryData {
  industry: string;
  meetings: number;
  totalDuration: number;
  avgDuration: number;
  deals: number;
  revenue: number;
  conversionRate: number;
  revenuePerMeeting: number;
  hotLeads: number;
  deadLeads: number;
}

function IndustryAnalytics({ meetings }: { meetings: Meeting[] }) {
  const industryData = useMemo<IndustryData[]>(() => {
    const map: Record<string, {
      meetings: number; totalDuration: number; deals: number;
      revenue: number; hotLeads: number; deadLeads: number;
    }> = {};

    meetings.forEach((m) => {
      const ind = m.industry || 'Not Specified';
      if (!map[ind]) map[ind] = { meetings: 0, totalDuration: 0, deals: 0, revenue: 0, hotLeads: 0, deadLeads: 0 };
      map[ind].meetings++;
      map[ind].totalDuration += durationToMinutes(m.meetingDuration);
      if (m.response === 'Deal Closed') {
        map[ind].deals++;
        map[ind].revenue += m.dealAmount || 0;
      }
      if (m.leadType === 'Hot') map[ind].hotLeads++;
      if (m.leadType === 'Dead') map[ind].deadLeads++;
    });

    return Object.entries(map)
      .map(([industry, d]) => ({
        industry,
        meetings: d.meetings,
        totalDuration: d.totalDuration,
        avgDuration: Math.round(d.totalDuration / d.meetings),
        deals: d.deals,
        revenue: d.revenue,
        conversionRate: Math.round((d.deals / d.meetings) * 100),
        revenuePerMeeting: d.meetings > 0 ? Math.round(d.revenue / d.meetings) : 0,
        hotLeads: d.hotLeads,
        deadLeads: d.deadLeads,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.conversionRate - a.conversionRate);
  }, [meetings]);

  if (industryData.length === 0) return null;

  // Top performers for suggestions
  const suggestions = useMemo(() => {
    const tips: { icon: string; color: string; text: string }[] = [];

    // Best converting industry
    const withEnoughData = industryData.filter((d) => d.meetings >= 2);
    if (withEnoughData.length > 0) {
      const best = [...withEnoughData].sort((a, b) => b.conversionRate - a.conversionRate)[0];
      if (best.conversionRate > 0) {
        tips.push({
          icon: '🏆',
          color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          text: `Best converting industry: "${best.industry}" — ${best.conversionRate}% conversion rate (${best.deals}/${best.meetings} meetings). Increase visits to this industry!`,
        });
      }
    }

    // Highest revenue industry
    const topRevenue = [...industryData].sort((a, b) => b.revenue - a.revenue)[0];
    if (topRevenue.revenue > 0) {
      tips.push({
        icon: '💰',
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        text: `Highest revenue industry: "${topRevenue.industry}" — ₹${topRevenue.revenue.toLocaleString('en-IN')} from ${topRevenue.deals} deal(s). Revenue per meeting: ₹${topRevenue.revenuePerMeeting.toLocaleString('en-IN')}.`,
      });
    }

    // Quickest meetings
    const quickest = [...withEnoughData].sort((a, b) => a.avgDuration - b.avgDuration)[0];
    if (quickest) {
      tips.push({
        icon: '⚡',
        color: 'bg-blue-50 border-blue-200 text-blue-800',
        text: `Fastest meetings: "${quickest.industry}" — avg ${quickest.avgDuration} min/meeting. These are quick wins — schedule more!`,
      });
    }

    // Most time spent but no deals
    const timewasters = industryData.filter((d) => d.meetings >= 3 && d.deals === 0);
    if (timewasters.length > 0) {
      const worst = [...timewasters].sort((a, b) => b.totalDuration - a.totalDuration)[0];
      tips.push({
        icon: '⚠️',
        color: 'bg-red-50 border-red-200 text-red-800',
        text: `"${worst.industry}" — ${worst.meetings} meetings (${worst.totalDuration} min total) with ZERO deals. Review strategy or reduce visits.`,
      });
    }

    // Most hot leads
    const hotIndustry = [...industryData].sort((a, b) => b.hotLeads - a.hotLeads)[0];
    if (hotIndustry.hotLeads > 0) {
      tips.push({
        icon: '🔥',
        color: 'bg-orange-50 border-orange-200 text-orange-800',
        text: `Most hot leads: "${hotIndustry.industry}" — ${hotIndustry.hotLeads} hot lead(s). Follow up aggressively to convert!`,
      });
    }

    return tips;
  }, [industryData]);

  // Charts data
  const topIndustries = industryData.slice(0, 8);
  const chartColors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  ];

  const industryPieData = {
    labels: topIndustries.map((d) => d.industry),
    datasets: [{
      data: topIndustries.map((d) => d.meetings),
      backgroundColor: chartColors.slice(0, topIndustries.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const industryBarData = {
    labels: topIndustries.map((d) => d.industry.length > 15 ? d.industry.slice(0, 15) + '…' : d.industry),
    datasets: [
      {
        label: 'Meetings',
        data: topIndustries.map((d) => d.meetings),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderRadius: 6,
      },
      {
        label: 'Deals Closed',
        data: topIndustries.map((d) => d.deals),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 6,
      },
    ],
  };

  const durationBarData = {
    labels: topIndustries.map((d) => d.industry.length > 15 ? d.industry.slice(0, 15) + '…' : d.industry),
    datasets: [{
      label: 'Avg Duration (min)',
      data: topIndustries.map((d) => d.avgDuration),
      backgroundColor: topIndustries.map((d) =>
        d.conversionRate >= 30 ? 'rgba(16, 185, 129, 0.7)' :
        d.conversionRate >= 15 ? 'rgba(245, 158, 11, 0.7)' :
        'rgba(239, 68, 68, 0.5)'
      ),
      borderRadius: 6,
    }],
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-100">
          <Factory size={22} className="text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Industry Analytics</h2>
          <p className="text-xs text-gray-500">Industry-wise performance, time analysis & smart suggestions</p>
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Target size={16} className="text-indigo-600" /> Smart Suggestions
          </h3>
          <div className="space-y-2">
            {suggestions.map((tip, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${tip.color}`}
              >
                <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                <p className="text-sm leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Distribution */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">
            🏭 Meetings by Industry
          </h3>
          <div className="flex justify-center">
            <div style={{ maxWidth: 300, width: '100%' }}>
              <Doughnut
                data={industryPieData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { padding: 12, font: { size: 11 } },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Meetings vs Deals by Industry */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">
            📊 Meetings vs Deals by Industry
          </h3>
          <Bar
            data={industryBarData}
            options={{
              responsive: true,
              plugins: { legend: { display: true, position: 'top' } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            }}
          />
        </div>
      </div>

      {/* Duration Analysis Chart */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" /> Avg Meeting Duration by Industry
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          🟢 High conversion (≥30%) · 🟡 Medium (≥15%) · 🔴 Low (&lt;15%)
        </p>
        <Bar
          data={durationBarData}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (v: any) => `${v} min`,
                },
              },
            },
          }}
        />
      </div>

      {/* Full Industry Table */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          📋 Industry Performance Table
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b-2 border-gray-200">
                <th className="pb-3 pr-4">Industry</th>
                <th className="pb-3 pr-4 text-center">Meetings</th>
                <th className="pb-3 pr-4 text-center">Total Time</th>
                <th className="pb-3 pr-4 text-center">Avg Duration</th>
                <th className="pb-3 pr-4 text-center">Deals</th>
                <th className="pb-3 pr-4 text-center">Conversion</th>
                <th className="pb-3 pr-4 text-right">Revenue</th>
                <th className="pb-3 text-center">Priority</th>
              </tr>
            </thead>
            <tbody>
              {industryData.map((d, i) => {
                const priority =
                  d.conversionRate >= 30 ? { label: 'HIGH', icon: <ArrowUpRight size={14} />, color: 'bg-emerald-100 text-emerald-700' } :
                  d.conversionRate >= 15 ? { label: 'MEDIUM', icon: <Minus size={14} />, color: 'bg-yellow-100 text-yellow-700' } :
                  d.meetings >= 3 && d.deals === 0 ? { label: 'LOW', icon: <ArrowDownRight size={14} />, color: 'bg-red-100 text-red-600' } :
                  { label: 'NEW', icon: <Minus size={14} />, color: 'bg-gray-100 text-gray-500' };

                return (
                  <tr
                    key={d.industry}
                    className={`border-b border-gray-50 hover:bg-indigo-50/30 transition ${
                      i === 0 && d.revenue > 0 ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-gray-800">{d.industry}</span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className="font-bold text-indigo-600">{d.meetings}</span>
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600">
                      {d.totalDuration >= 60
                        ? `${Math.floor(d.totalDuration / 60)}h ${d.totalDuration % 60}m`
                        : `${d.totalDuration}m`}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className="font-medium text-gray-700">{d.avgDuration} min</span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`font-bold ${d.deals > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {d.deals}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        d.conversionRate >= 30 ? 'bg-emerald-100 text-emerald-700' :
                        d.conversionRate >= 15 ? 'bg-yellow-100 text-yellow-700' :
                        d.conversionRate > 0 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {d.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {d.revenue > 0 ? (
                        <span className="font-bold text-emerald-700">
                          ₹{d.revenue.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${priority.color}`}>
                        {priority.icon} {priority.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex flex-wrap gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              HIGH = ≥30% conversion — increase visits
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              MEDIUM = ≥15% — maintain presence
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              LOW = many meetings, zero deals — review approach
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ meetings, loading = false }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading dashboard from Supabase…</p>
        </div>
      </div>
    );
  }
  const stats = useMemo(() => {
    const total = meetings.length;
    const hot = meetings.filter((m) => m.leadType === 'Hot').length;
    const dead = meetings.filter((m) => m.leadType === 'Dead').length;
    const closed = meetings.filter((m) => m.response === 'Deal Closed').length;
    const revenue = meetings.reduce((sum, m) => sum + (m.dealAmount || 0), 0);
    return { total, hot, dead, closed, revenue };
  }, [meetings]);

  // Meetings per day (last 14 days)
  const meetingsPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => {
      const day = format(parseISO(m.createdAt), 'MMM dd');
      counts[day] = (counts[day] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => new Date(`${a[0]} ${new Date().getFullYear()}`).getTime() - new Date(`${b[0]} ${new Date().getFullYear()}`).getTime())
      .slice(-14);
    return {
      labels: sorted.map(([d]) => d),
      data: sorted.map(([, v]) => v),
    };
  }, [meetings]);

  // Lead type distribution
  const leadDist = useMemo(() => {
    const counts: Record<string, number> = { Hot: 0, Warm: 0, Cold: 0, Dead: 0, Closed: 0 };
    meetings.forEach((m) => { counts[m.leadType] = (counts[m.leadType] || 0) + 1; });
    const entries = Object.entries(counts).filter(([, v]) => v > 0);
    return {
      labels: entries.map(([k]) => k),
      data: entries.map(([, v]) => v),
      colors: entries.map(([k]) => LEAD_COLORS[k]),
    };
  }, [meetings]);

  // Response distribution
  const responseDist = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.response] = (counts[m.response] || 0) + 1; });
    const entries = Object.entries(counts);
    return {
      labels: entries.map(([k]) => k),
      data: entries.map(([, v]) => v),
    };
  }, [meetings]);

  // Revenue over time (cumulative by day)
  const revenueOverTime = useMemo(() => {
    const deals = meetings
      .filter((m) => m.response === 'Deal Closed' && m.dealAmount)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const dailyRevenue: Record<string, number> = {};
    deals.forEach((m) => {
      const day = format(parseISO(m.createdAt), 'MMM dd');
      dailyRevenue[day] = (dailyRevenue[day] || 0) + (m.dealAmount || 0);
    });

    const days = Object.keys(dailyRevenue);
    let cumulative = 0;
    const cumulativeData = days.map((d) => {
      cumulative += dailyRevenue[d];
      return cumulative;
    });

    return {
      labels: days,
      dailyData: days.map((d) => dailyRevenue[d]),
      cumulativeData,
    };
  }, [meetings]);

  // Chart options
  const barOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  const barData = {
    labels: meetingsPerDay.labels,
    datasets: [{
      label: 'Meetings',
      data: meetingsPerDay.data,
      backgroundColor: 'rgba(99, 102, 241, 0.75)',
      borderColor: 'rgb(99, 102, 241)',
      borderWidth: 2,
      borderRadius: 6,
    }],
  };

  const pieData = {
    labels: leadDist.labels,
    datasets: [{
      data: leadDist.data,
      backgroundColor: leadDist.colors,
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const responseBarData = {
    labels: responseDist.labels,
    datasets: [{
      label: 'Count',
      data: responseDist.data,
      backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#22c55e', '#f97316', '#6b7280'],
      borderRadius: 6,
    }],
  };

  const revenueLineData = {
    labels: revenueOverTime.labels,
    datasets: [
      {
        label: 'Daily Revenue (₹)',
        data: revenueOverTime.dailyData,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10b981',
        borderWidth: 2,
        pointBackgroundColor: '#10b981',
        pointRadius: 5,
        tension: 0.4,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Cumulative Revenue (₹)',
        data: revenueOverTime.cumulativeData,
        backgroundColor: 'transparent',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderDash: [5, 4],
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
        tension: 0.4,
        fill: false,
        yAxisID: 'y',
      },
    ],
  };

  const revenueLineOpts = {
    responsive: true,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ₹${ctx.raw.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v: any) => `₹${Number(v).toLocaleString('en-IN')}`,
        },
      },
    },
  };

  if (meetings.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-700">No data yet</h2>
        <p className="text-gray-500 mt-2">
          Start logging meetings to see your dashboard come alive!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <TrendingUp className="text-indigo-600" size={26} /> Sales Dashboard
      </h2>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Calendar size={22} className="text-indigo-500" />}
          label="Total Meetings"
          value={stats.total}
          color="border-indigo-500"
        />
        <StatCard
          icon={<Flame size={22} className="text-red-500" />}
          label="Hot Leads"
          value={stats.hot}
          color="border-red-500"
        />
        <StatCard
          icon={<ThumbsDown size={22} className="text-gray-400" />}
          label="Dead Leads"
          value={stats.dead}
          color="border-gray-400"
        />
        <StatCard
          icon={<CheckCircle size={22} className="text-green-500" />}
          label="Deals Closed"
          value={stats.closed}
          color="border-green-500"
        />
        <StatCard
          icon={<IndianRupee size={22} className="text-emerald-600" />}
          label="Total Revenue"
          value={`₹${stats.revenue.toLocaleString('en-IN')}`}
          color="border-emerald-500"
          sub={stats.closed > 0 ? `Avg ₹${Math.round(stats.revenue / stats.closed).toLocaleString('en-IN')} / deal` : undefined}
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">📅 Meetings Per Day</h3>
          {meetingsPerDay.labels.length > 0 ? (
            <Bar data={barData} options={barOpts} />
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">No data</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">
            🎯 Lead Type Distribution
          </h3>
          {leadDist.data.length > 0 ? (
            <div className="flex justify-center">
              <div style={{ maxWidth: 300, width: '100%' }}>
                <Pie
                  data={pieData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { padding: 16, font: { size: 12 } },
                      },
                    },
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">No data</p>
          )}
        </div>
      </div>

      {/* ── Revenue Trend ── */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <IndianRupee size={16} className="text-emerald-600" /> Revenue Trend
        </h3>
        <p className="text-xs text-gray-400 mb-4">Daily and cumulative revenue from closed deals</p>
        {revenueOverTime.labels.length > 0 ? (
          <Line data={revenueLineData} options={revenueLineOpts} />
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">No closed deals yet</p>
            <p className="text-gray-300 text-xs mt-1">Revenue will appear here when deals are closed</p>
          </div>
        )}
      </div>

      {/* ── Response Breakdown ── */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-4">💬 Response Breakdown</h3>
        {responseDist.labels.length > 0 ? (
          <Bar data={responseBarData} options={barOpts} />
        ) : (
          <p className="text-gray-400 text-sm text-center py-10">No data</p>
        )}
      </div>

      {/* ── INDUSTRY ANALYTICS ── */}
      <IndustryAnalytics meetings={meetings} />

      {/* ── Closed Deals Table ── */}
      <DealsTable meetings={meetings} />

      {/* ── Recent Activity ── */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-4">🕐 Recent Activity</h3>
        <div className="space-y-2">
          {[...meetings]
            .reverse()
            .slice(0, 5)
            .map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-indigo-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{m.name}</p>
                    <p className="text-xs text-gray-400">
                      {m.companyName} · {m.industry ? <span className="text-purple-500">{m.industry}</span> : m.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.response === 'Deal Closed' && m.dealAmount && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ₹{m.dealAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      m.leadType === 'Hot'
                        ? 'bg-red-100 text-red-600'
                        : m.leadType === 'Warm'
                        ? 'bg-orange-100 text-orange-600'
                        : m.leadType === 'Cold'
                        ? 'bg-blue-100 text-blue-600'
                        : m.leadType === 'Dead'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {m.leadType}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(parseISO(m.createdAt), 'MMM dd')}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
