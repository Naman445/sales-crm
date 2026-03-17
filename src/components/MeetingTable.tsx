import { useState, useMemo } from 'react';
import {
  Pencil, Trash2, Download, Search,
  ChevronUp, ChevronDown, ChevronsUpDown,
  MessageCircle, Mail, Copy, X,
} from 'lucide-react';
import { Meeting, ResponseType, INDUSTRIES } from '../types';
import { deleteMeeting } from '../utils/storage';
import { exportToExcel } from '../utils/excel';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  meetings: Meeting[];
  onEdit: (m: Meeting) => void;
  onRefresh: () => void;
}

const LEAD_BADGE: Record<string, string> = {
  Hot:    'bg-red-100 text-red-600',
  Warm:   'bg-orange-100 text-orange-600',
  Cold:   'bg-blue-100 text-blue-600',
  Dead:   'bg-gray-100 text-gray-500',
  Closed: 'bg-green-100 text-green-600',
};

const RESPONSE_BADGE: Record<string, string> = {
  'Interested':     'bg-emerald-100 text-emerald-700',
  'Follow Up':      'bg-blue-100 text-blue-700',
  'Not Interested': 'bg-red-100 text-red-600',
  'Dead Lead':      'bg-gray-200 text-gray-600',
  'Callback':       'bg-yellow-100 text-yellow-700',
  'No Response':    'bg-gray-100 text-gray-500',
  'Deal Closed':    'bg-green-100 text-green-700',
};

// ── Template generator ───────────────────────────────────────────────────────
function getWhatsAppMsg(m: Meeting): string {
  const name = m.name.split(' ')[0];
  switch (m.response as ResponseType) {
    case 'Interested':
      return `Hi ${name}! 👋 It was great meeting you from ${m.companyName}. I'm glad you found our offering interesting! I'd love to take this forward — could we schedule a detailed discussion? Looking forward to connecting. 😊`;
    case 'Follow Up':
      return `Hi ${name}! Just following up on our meeting. Hope you had a chance to review what we discussed. Do you have any questions or would you like to proceed? I'm here to help! 🙏`;
    case 'Callback':
      return `Hi ${name}! You had requested a callback after our meeting. Whenever you're free, please let me know a convenient time and I'll call you right away. 📞`;
    case 'No Response':
      return `Hi ${name}! I hope you're doing well. I wanted to reconnect after our meeting at ${m.companyName}. Would love to discuss how we can add value to your business. Please do let me know a good time. 🌟`;
    case 'Not Interested':
      return `Hi ${name}! Thank you for your time during our meeting. I completely understand your current position. If circumstances change or if there's anything I can help with in the future, please don't hesitate to reach out. 🙏 Have a great day!`;
    case 'Dead Lead':
      return `Hi ${name}! Hope you're doing well. I wanted to check in and see if anything has changed at ${m.companyName} since we last spoke. We've added some new offerings that might be relevant. Would love to reconnect whenever you're ready! 😊`;
    case 'Deal Closed':
      return `Hi ${name}! 🎉 Congratulations on closing the deal! We're thrilled to have ${m.companyName} on board${m.productSold ? ` for ${m.productSold}` : ''}. Our team will be in touch shortly to get things started. Thank you for your trust! 🚀`;
    default:
      return `Hi ${name}! It was great connecting with you from ${m.companyName}. Looking forward to a fruitful relationship. Please feel free to reach out anytime! 😊`;
  }
}

function getEmailMsg(m: Meeting): { subject: string; body: string } {
  switch (m.response as ResponseType) {
    case 'Interested':
      return {
        subject: `Next Steps — Following up on our Meeting | ${m.companyName}`,
        body: `Dear ${m.name},\n\nThank you for taking the time to meet with me. It was a pleasure learning about ${m.companyName} and understanding your requirements.\n\nI'm glad to know that our solution aligns with your needs. I would love to schedule a follow-up discussion to explore this further and provide a detailed proposal.\n\nCould you please suggest a convenient date and time for a call or meeting?\n\nLooking forward to your response.\n\nWarm regards,\n[Your Name]\n[Your Company]`,
      };
    case 'Follow Up':
      return {
        subject: `Following Up — ${m.companyName} | Action Required`,
        body: `Dear ${m.name},\n\nHope you are doing well. I'm writing to follow up on our recent discussion regarding the solutions we presented.\n\nI wanted to check if you had any questions or require any additional information to move forward. We are fully prepared to support you at every step.\n\nPlease feel free to reply to this email or call me directly.\n\nLooking forward to hearing from you.\n\nBest regards,\n[Your Name]\n[Your Company]`,
      };
    case 'Callback':
      return {
        subject: `Callback Request — ${m.companyName}`,
        body: `Dear ${m.name},\n\nThank you for your time during our meeting. As discussed, I wanted to confirm the callback at your convenience.\n\nPlease let me know your preferred date and time, and I will make sure to call you promptly.\n\nAlternatively, you can reach me directly at [Your Phone Number].\n\nLooking forward to speaking with you.\n\nBest regards,\n[Your Name]\n[Your Company]`,
      };
    case 'No Response':
      return {
        subject: `Reconnecting — ${m.companyName} | [Your Company Name]`,
        body: `Dear ${m.name},\n\nI hope this email finds you well. I am reaching out to reconnect following our previous meeting.\n\nI understand you may be busy, and I don't want to miss the opportunity to explore how we can add value to ${m.companyName}. If it would be helpful, I can send across a brief summary of our solution.\n\nLooking forward to your response at your earliest convenience.\n\nKind regards,\n[Your Name]\n[Your Company]`,
      };
    case 'Not Interested':
      return {
        subject: `Thank You for Your Time — ${m.companyName}`,
        body: `Dear ${m.name},\n\nThank you for meeting with me and for your candid feedback. I completely respect your decision and understand that the timing may not be right.\n\nShould your requirements change in the future, or if there is anything I can assist you with, please do not hesitate to get in touch.\n\nWishing you and ${m.companyName} continued success.\n\nWarm regards,\n[Your Name]\n[Your Company]`,
      };
    case 'Dead Lead':
      return {
        subject: `Checking In — ${m.companyName} | New Offerings Available`,
        body: `Dear ${m.name},\n\nI hope you are doing well. I wanted to reach out and reconnect after our previous interaction.\n\nWe have recently introduced new products and services that may be relevant to ${m.companyName}. I would love to share a brief overview if you are open to it.\n\nNo obligation at all — just a quick update to see if anything has changed on your end.\n\nLooking forward to your reply.\n\nBest regards,\n[Your Name]\n[Your Company]`,
      };
    case 'Deal Closed':
      return {
        subject: `Welcome Aboard! — ${m.companyName} | Deal Confirmation`,
        body: `Dear ${m.name},\n\nCongratulations and a warm welcome to the ${m.companyName} family! 🎉\n\nWe are thrilled to confirm that your deal${m.productSold ? ` for ${m.productSold}` : ''} has been successfully processed${m.dealAmount ? ` for ₹${m.dealAmount.toLocaleString('en-IN')}` : ''}.\n\nOur team will be reaching out shortly with the onboarding details and next steps. Please do not hesitate to contact us for any queries.\n\nThank you for placing your trust in us. We look forward to a long and successful partnership.\n\nWarm regards,\n[Your Name]\n[Your Company]`,
      };
    default:
      return {
        subject: `Great Meeting You — ${m.companyName}`,
        body: `Dear ${m.name},\n\nThank you for your time and the productive discussion. It was a pleasure meeting you from ${m.companyName}.\n\nI will be in touch soon with more details. Please feel free to reach out if you have any questions.\n\nBest regards,\n[Your Name]\n[Your Company]`,
      };
  }
}

// ── Suggest Panel Component ──────────────────────────────────────────────────
function SuggestPanel({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const waMsg = getWhatsAppMsg(meeting);
  const { subject, body } = getEmailMsg(meeting);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`);
    });
  };

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(waMsg);
    const phone = meeting.phone.replace(/\D/g, '');
    const url = phone.length >= 10
      ? `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const openEmail = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.open(`mailto:${meeting.email}?subject=${encodedSubject}&body=${encodedBody}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Panel Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-base">💬 Follow-up Suggestions</p>
            <p className="text-indigo-200 text-xs mt-0.5">
              {meeting.name} · {meeting.companyName} ·{' '}
              <span className="font-semibold">{meeting.response}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              tab === 'whatsapp'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
              tab === 'email'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Mail size={16} /> Email
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'whatsapp' ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <MessageCircle size={12} /> WhatsApp Message
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{waMsg}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow"
                >
                  <MessageCircle size={15} /> Open in WhatsApp
                </button>
                <button
                  onClick={() => copyToClipboard(waMsg, 'WhatsApp message')}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Subject Line</p>
                  <p className="text-sm text-gray-800 font-medium">{subject}</p>
                  <button
                    onClick={() => copyToClipboard(subject, 'Subject line')}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy Subject
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Email Body</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{body}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openEmail}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow"
                >
                  <Mail size={15} /> Open in Mail App
                </button>
                <button
                  onClick={() => copyToClipboard(`Subject: ${subject}\n\n${body}`, 'Email')}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition"
                >
                  <Copy size={14} /> Copy All
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Table ───────────────────────────────────────────────────────────────
type SortField = 'name' | 'companyName' | 'leadType' | 'nextMeetingDate' | 'createdAt' | 'dealAmount';
type SortDir = 'asc' | 'desc';

export default function MeetingTable({ meetings, onEdit, onRefresh }: Props) {
  const [search, setSearch]               = useState('');
  const [leadFilter, setLeadFilter]       = useState('');
  const [responseFilter, setResponseFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sortField, setSortField]         = useState<SortField>('createdAt');
  const [sortDir, setSortDir]             = useState<SortDir>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage]     = useState(1);
  const [suggestMeeting, setSuggestMeeting] = useState<Meeting | null>(null);
  const pageSize = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let list = [...meetings];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.companyName.toLowerCase().includes(q) ||
          (m.industry || '').toLowerCase().includes(q) ||
          m.city.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.productSold || '').toLowerCase().includes(q)
      );
    }
    if (leadFilter)     list = list.filter((m) => m.leadType === leadFilter);
    if (responseFilter) list = list.filter((m) => m.response === responseFilter);
    if (industryFilter) list = list.filter((m) => m.industry === industryFilter);
    list.sort((a, b) => {
      const av = (a as any)[sortField] ?? '';
      const bv = (b as any)[sortField] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [meetings, search, leadFilter, responseFilter, industryFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = (id: string) => {
    deleteMeeting(id);
    toast.success('Meeting deleted.');
    setDeleteConfirm(null);
    onRefresh();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={13} className="text-gray-400" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-indigo-600" />
      : <ChevronDown size={13} className="text-indigo-600" />;
  };

  const thClass =
    'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:bg-gray-100 transition';

  const filteredRevenue = filtered
    .filter((m) => m.response === 'Deal Closed' && m.dealAmount)
    .reduce((s, m) => s + (m.dealAmount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">📁 All Meetings</h2>
        <button
          onClick={() => {
            if (meetings.length === 0) { toast.error('No meetings to export.'); return; }
            exportToExcel(meetings);
            toast.success('Excel file downloaded!');
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow transition"
        >
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Revenue bar */}
      {filteredRevenue > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-800">
          <span className="font-medium">💰 Revenue in current view:</span>
          <span className="font-bold text-emerald-700">₹{filteredRevenue.toLocaleString('en-IN')}</span>
          <span className="text-emerald-500 text-xs ml-auto">
            from {filtered.filter((m) => m.dealAmount).length} deal(s)
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-md p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search name, company, city, product..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={leadFilter}
          onChange={(e) => { setLeadFilter(e.target.value); setCurrentPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">All Lead Types</option>
          {['Hot','Warm','Cold','Dead','Closed'].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={responseFilter}
          onChange={(e) => { setResponseFilter(e.target.value); setCurrentPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">All Responses</option>
          {['Interested','Follow Up','Deal Closed','Not Interested','Dead Lead','Callback','No Response'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => { setIndustryFilter(e.target.value); setCurrentPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">All Industries</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 flex items-center px-2">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {meetings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No meetings logged yet. Add your first meeting!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-400">
          No results match your filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={thClass} onClick={() => handleSort('name')}>
                    <span className="flex items-center gap-1">Client <SortIcon field="name" /></span>
                  </th>
                  <th className={thClass} onClick={() => handleSort('companyName')}>
                    <span className="flex items-center gap-1">Company <SortIcon field="companyName" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className={thClass} onClick={() => handleSort('leadType')}>
                    <span className="flex items-center gap-1">Lead <SortIcon field="leadType" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Response</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide text-emerald-700">Deal</th>
                  <th className={thClass} onClick={() => handleSort('nextMeetingDate')}>
                    <span className="flex items-center gap-1">Next Meeting <SortIcon field="nextMeetingDate" /></span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-600 uppercase tracking-wide bg-indigo-50">
                    💬 Follow-up
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-indigo-50/30 transition ${
                      m.response === 'Deal Closed' ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.jobTitle}</p>
                        </div>
                      </div>
                    </td>
                    {/* Company */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700">{m.companyName}</p>
                      <p className="text-xs text-gray-400">{m.city}</p>
                    </td>
                    {/* Industry */}
                    <td className="px-4 py-3">
                      {m.industry ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {m.industry}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{m.phone}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[140px]">{m.email}</p>
                    </td>
                    {/* Lead type */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEAD_BADGE[m.leadType] || 'bg-gray-100 text-gray-600'}`}>
                        {m.leadType}
                      </span>
                    </td>
                    {/* Response */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${RESPONSE_BADGE[m.response] || 'bg-gray-100 text-gray-600'}`}>
                        {m.response}
                      </span>
                    </td>
                    {/* Deal */}
                    <td className="px-4 py-3">
                      {m.response === 'Deal Closed' && m.dealAmount ? (
                        <div>
                          <p className="font-bold text-emerald-700 text-sm">₹{m.dealAmount.toLocaleString('en-IN')}</p>
                          {m.dealQty && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {m.dealQty} unit{m.dealQty !== 1 ? 's' : ''}
                            </p>
                          )}
                          {m.productSold && (
                            <p className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                              {m.productSold}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    {/* Next Meeting */}
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {m.nextMeetingDate
                        ? (() => {
                            const [y, mo, d] = m.nextMeetingDate.split('-').map(Number);
                            return format(new Date(y, mo - 1, d), 'dd MMM yyyy');
                          })()
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Follow-up Suggest */}
                    <td className="px-4 py-3 bg-indigo-50/30">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSuggestMeeting(m)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition text-xs font-semibold"
                          title="WhatsApp message suggestion"
                        >
                          <MessageCircle size={13} /> WA
                        </button>
                        <button
                          onClick={() => { setSuggestMeeting(m); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-xs font-semibold"
                          title="Email suggestion"
                        >
                          <Mail size={13} /> Mail
                        </button>
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEdit(m)}
                          className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-100 transition"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        {deleteConfirm === m.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-300 transition"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(m.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 transition"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition"
                >Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - currentPage) <= 2)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 text-xs rounded-lg border transition ${
                        currentPage === p
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 hover:bg-gray-100'
                      }`}
                    >{p}</button>
                  ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestion Panel Modal */}
      {suggestMeeting && (
        <SuggestPanel
          meeting={suggestMeeting}
          onClose={() => setSuggestMeeting(null)}
        />
      )}
    </div>
  );
}
