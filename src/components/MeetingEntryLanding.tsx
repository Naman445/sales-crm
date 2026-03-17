import { PlusCircle, Clock, Building2, User, TrendingUp, Camera } from 'lucide-react';
import { Meeting } from '../types';
import { format } from 'date-fns';

interface Props {
  onNewMeeting: () => void;
  meetings: Meeting[];
  onEdit: (m: Meeting) => void;
}

const leadColor: Record<string, string> = {
  Hot:    'bg-red-100 text-red-700 border-red-200',
  Warm:   'bg-orange-100 text-orange-700 border-orange-200',
  Cold:   'bg-blue-100 text-blue-700 border-blue-200',
  Dead:   'bg-gray-100 text-gray-500 border-gray-200',
  Closed: 'bg-green-100 text-green-700 border-green-200',
};

export default function MeetingEntryLanding({ onNewMeeting, meetings, onEdit }: Props) {
  // Show last 5 meetings
  const recent = [...meetings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200">
        <div className="flex items-center gap-3 mb-2">
          <Camera size={28} className="text-yellow-300" />
          <h1 className="text-2xl font-bold tracking-tight">Meeting Entry</h1>
        </div>
        <p className="text-indigo-200 text-sm mb-6 leading-relaxed">
          When you start a new meeting, the app will ask for your <strong className="text-white">location</strong> and a <strong className="text-white">photo</strong> as proof of visit — then open the entry form.
        </p>

        <button
          onClick={onNewMeeting}
          className="flex items-center gap-3 bg-white text-indigo-700 font-bold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-base"
        >
          <PlusCircle size={22} />
          Start New Meeting
        </button>

        <p className="text-indigo-300 text-xs mt-4 flex items-center gap-1.5">
          <Camera size={12} />
          Camera &amp; GPS will open automatically
        </p>
      </div>

      {/* Recent meetings */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-indigo-500" />
              Recent Meetings
            </h2>
            <span className="text-xs text-gray-400">{meetings.length} total</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm truncate">
                      <User size={12} className="inline mr-1 text-gray-400" />
                      {m.name}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${leadColor[m.leadType] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {m.leadType}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Building2 size={10} />
                    {m.companyName}
                    <span className="text-gray-300 mx-1">·</span>
                    <TrendingUp size={10} />
                    {m.response}
                  </div>
                </div>
                {/* Date + Edit */}
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">
                    {format(new Date(m.createdAt), 'dd MMM')}
                  </div>
                  <button
                    onClick={() => onEdit(m)}
                    className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium mt-0.5 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {recent.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={24} className="text-indigo-300" />
          </div>
          <p className="text-gray-500 text-sm">No meetings logged yet.</p>
          <p className="text-gray-400 text-xs mt-1">Click "Start New Meeting" to log your first one.</p>
        </div>
      )}
    </div>
  );
}
