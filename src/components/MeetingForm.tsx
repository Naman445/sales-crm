import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Mic, MicOff, Save, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, IndianRupee, ChevronRight,
  MapPin, Camera, User,
} from 'lucide-react';
import {
  Meeting, LeadType, ResponseType,
  RESPONSES_NEEDING_DATE, RESPONSES_NO_DATE,
  AppUser, MeetingProof, INDUSTRIES,
} from '../types';
import {
  saveMeeting, updateMeeting, getProducts,
} from '../utils/supabaseDb';
import { generateId } from '../utils/storage';
import { adjustForSunday, isSunday } from '../utils/dateLogic';
import { Product } from '../types';

interface Props {
  editMeeting?: Meeting | null;
  onSaved: () => void;
  user: AppUser;
  proof?: MeetingProof | null;
  onCancel?: () => void;
}

const emptyForm = {
  name: '',
  jobTitle: '',
  companyName: '',
  industry: '',
  phone: '',
  email: '',
  response: '' as ResponseType | '',
  leadType: '' as LeadType | '',
  city: '',
  address: '',
  meetingDuration: '',
  nextMeetingDate: '',
  dealQty: '',
  dealAmount: '',
  productSold: '',
};

const LEAD_TYPES: LeadType[] = ['Hot', 'Warm', 'Cold', 'Dead', 'Closed'];

const RESPONSE_OPTIONS: { value: ResponseType; label: string; icon: string; color: string }[] = [
  { value: 'Interested',     label: 'Interested',     icon: '🔥', color: 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100' },
  { value: 'Follow Up',      label: 'Follow Up',      icon: '🔄', color: 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100' },
  { value: 'Callback',       label: 'Callback',       icon: '📞', color: 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' },
  { value: 'No Response',    label: 'No Response',    icon: '😶', color: 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100' },
  { value: 'Not Interested', label: 'Not Interested', icon: '❌', color: 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100' },
  { value: 'Dead Lead',      label: 'Dead Lead',      icon: '💀', color: 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100' },
  { value: 'Deal Closed',    label: 'Deal Closed',    icon: '🏆', color: 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100' },
];

const DURATION_OPTIONS = [
  '15 min', '30 min', '45 min', '1 hour', '1.5 hours', '2 hours', '2+ hours',
];

export default function MeetingForm({ editMeeting, onSaved, user, proof }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof emptyForm, string>>>({});
  const [isListening, setIsListening] = useState(false);
  const [sundayWarning, setSundayWarning] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const recognitionRef = useRef<any>(null);

  const isDealClosed = form.response === 'Deal Closed';
  const dateRequired =
    form.response !== '' &&
    RESPONSES_NEEDING_DATE.includes(form.response as ResponseType);
  const dateDisabled =
    form.response !== '' &&
    RESPONSES_NO_DATE.includes(form.response as ResponseType);
  const responseSelected = form.response !== '';

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  useEffect(() => {
    if (editMeeting) {
      setForm({
        name: editMeeting.name,
        jobTitle: editMeeting.jobTitle,
        companyName: editMeeting.companyName,
        industry: editMeeting.industry || '',
        phone: editMeeting.phone,
        email: editMeeting.email,
        response: editMeeting.response,
        leadType: editMeeting.leadType,
        city: editMeeting.city,
        address: editMeeting.address,
        meetingDuration: editMeeting.meetingDuration,
        nextMeetingDate: editMeeting.nextMeetingDate,
        dealQty: editMeeting.dealQty != null ? String(editMeeting.dealQty) : '',
        dealAmount: editMeeting.dealAmount != null ? String(editMeeting.dealAmount) : '',
        productSold: editMeeting.productSold || '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setErrors({});
    setSundayWarning(false);
  }, [editMeeting]);

  useEffect(() => {
    if (dateDisabled) {
      setForm((prev) => ({ ...prev, nextMeetingDate: '' }));
      setSundayWarning(false);
    }
  }, [dateDisabled]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    if (name === 'nextMeetingDate') setSundayWarning(isSunday(value));
  };

  const handleResponseSelect = (value: ResponseType) => {
    setErrors((prev) => ({ ...prev, response: '' }));
    let leadType: LeadType | '' = form.leadType;
    if (value === 'Deal Closed')                                  leadType = 'Closed';
    else if (value === 'Not Interested' || value === 'Dead Lead') leadType = 'Dead';
    else if (value === 'Interested')                              leadType = 'Hot';
    else if (value === 'Follow Up' || value === 'Callback')       leadType = 'Warm';
    else if (value === 'No Response')                             leadType = 'Cold';
    setForm((prev) => ({
      ...prev,
      response: value,
      leadType,
      dealQty:      value !== 'Deal Closed' ? '' : prev.dealQty,
      dealAmount:   value !== 'Deal Closed' ? '' : prev.dealAmount,
      productSold:  value !== 'Deal Closed' ? '' : prev.productSold,
    }));
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productName = e.target.value;
    const found = products.find((p) => p.name === productName);
    setForm((prev) => {
      const qty = Number(prev.dealQty) || 0;
      const autoAmount = found && qty > 0 ? String(found.price * qty) : '';
      return { ...prev, productSold: productName, dealAmount: autoAmount };
    });
    setErrors((prev) => ({ ...prev, productSold: '', dealAmount: '' }));
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = e.target.value;
    setForm((prev) => {
      const found = products.find((p) => p.name === prev.productSold);
      const autoAmount =
        found && Number(qty) > 0 ? String(found.price * Number(qty)) : '';
      return { ...prev, dealQty: qty, dealAmount: autoAmount };
    });
    setErrors((prev) => ({ ...prev, dealQty: '', dealAmount: '' }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof typeof emptyForm, string>> = {};
    if (!form.response) newErrors.response = 'Please select how the meeting went';
    const always: (keyof typeof emptyForm)[] = [
      'name', 'jobTitle', 'companyName', 'industry', 'phone', 'email',
      'leadType', 'city', 'address', 'meetingDuration',
    ];
    always.forEach((f) => {
      if (!form[f]) newErrors[f] = 'This field is required';
    });
    if (dateRequired && !form.nextMeetingDate)
      newErrors.nextMeetingDate = 'Next meeting date is required for this response';
    if (isDealClosed) {
      if (!form.productSold)
        newErrors.productSold = 'Select the product that was sold';
      if (!form.dealQty || isNaN(Number(form.dealQty)) || Number(form.dealQty) <= 0)
        newErrors.dealQty = 'Enter the quantity purchased (must be ≥ 1)';
      if (!form.dealAmount || Number(form.dealAmount) <= 0)
        newErrors.dealAmount = 'Deal amount must be greater than 0';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Invalid email address';
    if (form.phone && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone))
      newErrors.phone = 'Invalid phone number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fill all required fields correctly.');
      return;
    }
    let finalDate = form.nextMeetingDate;
    let wasAdjusted = false;
    if (finalDate) {
      const adjusted = adjustForSunday(finalDate);
      wasAdjusted = adjusted !== finalDate;
      finalDate = adjusted;
    }

    const meeting: Meeting = {
      id: editMeeting ? editMeeting.id : generateId(),
      salesPersonId:   user.id,
      salesPersonName: user.name,
      salesPersonRole: user.role,
      name:            form.name,
      jobTitle:        form.jobTitle,
      companyName:     form.companyName,
      industry:        form.industry,
      phone:           form.phone,
      email:           form.email,
      response:        form.response as ResponseType,
      leadType:        form.leadType as LeadType,
      city:            form.city,
      address:         form.address,
      meetingDuration: form.meetingDuration,
      nextMeetingDate: finalDate,
      proof: editMeeting ? editMeeting.proof : (proof ?? undefined),
      dealQty:      isDealClosed && form.dealQty    ? Number(form.dealQty)    : undefined,
      dealAmount:   isDealClosed && form.dealAmount  ? Number(form.dealAmount)  : undefined,
      productSold:  isDealClosed && form.productSold ? form.productSold        : undefined,
      revenueDate:  isDealClosed ? new Date().toISOString() : undefined,
      createdAt:    editMeeting ? editMeeting.createdAt : new Date().toISOString(),
    };

    // Photo base64 to upload (only for new meetings with proof)
    const photoBase64 = !editMeeting && proof?.photoBase64 ? proof.photoBase64 : undefined;

    if (editMeeting) {
      const { error } = await updateMeeting(meeting);
      if (error) { toast.error(`Update failed: ${error}`); return; }
      toast.success('Meeting updated successfully!');
    } else {
      const savingToast = toast.loading('Saving meeting…');
      const { error } = await saveMeeting(meeting, photoBase64);
      toast.dismiss(savingToast);
      if (error) { toast.error(`Save failed: ${error}`); return; }
      if (wasAdjusted) {
        toast('Sunday detected! Meeting moved to Monday 📅', { icon: '⚠️' });
      } else if (isDealClosed) {
        toast.success(
          `🎉 Deal closed! ₹${Number(form.dealAmount).toLocaleString('en-IN')} recorded.`,
          { duration: 4000 }
        );
      } else {
        toast.success('Meeting saved successfully!');
      }
    }
    setForm({ ...emptyForm });
    setSundayWarning(false);
    onSaved();
  };

  const handleReset = () => {
    setForm({ ...emptyForm });
    setErrors({});
    setSundayWarning(false);
  };

  // ── Voice Input ──────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input not supported in this browser.'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    recognitionRef.current = r;
    r.lang = 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onstart = () => setIsListening(true);
    r.onend   = () => setIsListening(false);
    r.onerror = () => { setIsListening(false); toast.error('Voice error. Try again.'); };
    r.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      toast(`Heard: "${transcript}"`, { icon: '🎤', duration: 3000 });
      parseVoice(transcript);
    };
    r.start();
  };

  const parseVoice = (text: string) => {
    const lower = text.toLowerCase();
    const updates: Partial<typeof emptyForm> = {};
    const metMatch = text.match(/(?:met|meeting with|spoke to|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (metMatch) updates.name = metMatch[1];
    const fromMatch = text.match(/from\s+([A-Z][A-Za-z\s]+?)(?:\s+today|\s+yesterday|$|\.)/);
    if (fromMatch) updates.companyName = fromMatch[1].trim();
    const cityMatch = text.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s/);
    if (cityMatch) updates.city = cityMatch[1];
    if (lower.includes('deal closed') || lower.includes('closed deal')) {
      updates.leadType = 'Closed'; updates.response = 'Deal Closed';
    } else if (lower.includes('not interested') || lower.includes('rejected')) {
      updates.leadType = 'Dead'; updates.response = 'Not Interested';
    } else if (lower.includes('dead lead') || lower.includes('dead')) {
      updates.leadType = 'Dead'; updates.response = 'Dead Lead';
    } else if (lower.includes('follow up') || lower.includes('followup')) {
      updates.leadType = 'Warm'; updates.response = 'Follow Up';
    } else if (lower.includes('interested') || lower.includes('positive')) {
      updates.leadType = 'Hot'; updates.response = 'Interested';
    } else if (lower.includes('callback') || lower.includes('call back')) {
      updates.response = 'Callback'; updates.leadType = 'Warm';
    }
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
      toast.success(`Auto-filled ${Object.keys(updates).length} field(s) from voice!`);
    } else {
      toast('Could not auto-fill. Try: "I met Rahul from CEAT Tyres today."', { icon: 'ℹ️', duration: 4000 });
    }
  };

  // ── Style helpers ────────────────────────────────────────────────────────────
  const inputClass = (field: keyof typeof emptyForm, disabled = false) =>
    `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
      disabled
        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
        : errors[field]
        ? 'border-red-400 bg-red-50'
        : 'border-gray-300 bg-white hover:border-indigo-300'
    }`;

  const Err = ({ field }: { field: keyof typeof emptyForm }) =>
    errors[field] ? (
      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
        <AlertCircle size={12} /> {errors[field]}
      </p>
    ) : null;

  const selectedProduct = products.find((p) => p.name === form.productSold);
  const unitPrice   = selectedProduct ? selectedProduct.price : 0;
  const dealQtyNum  = Number(form.dealQty) || 0;
  const dealTotal   = unitPrice * dealQtyNum;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-bold">
              {editMeeting ? '✏️ Edit Meeting' : '📋 New Meeting Entry'}
            </h2>
            <p className="text-indigo-200 text-sm mt-0.5">
              Logged by <span className="font-semibold text-yellow-300">{user.name}</span>
              <span className="ml-2 text-indigo-300 text-xs">({user.role})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            {isListening ? 'Stop Listening' : 'Voice Input'}
          </button>
        </div>

        {/* ── Proof of Visit Banner ── */}
        {proof && !editMeeting && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3">
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              <img
                src={proof.photoBase64}
                alt="Visit proof"
                className="w-16 h-12 object-cover rounded-lg border border-emerald-300 shadow-sm shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Camera size={14} className="text-emerald-600" />
                  <span className="text-emerald-800 font-semibold text-sm">Visit Verified</span>
                  <span className="text-emerald-600 text-xs">
                    · {new Date(proof.capturedAt).toLocaleTimeString('en-IN')}
                  </span>
                </div>
                <div className="flex items-start gap-1">
                  <MapPin size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-emerald-700 text-xs truncate">{proof.locationAddress}</p>
                </div>
                <p className="text-emerald-500 text-xs font-mono mt-0.5">
                  {proof.latitude.toFixed(6)}, {proof.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Listening Banner ── */}
        {isListening && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3 flex items-center gap-2 text-indigo-700 text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping mr-1" />
            Listening… Try: <em className="ml-1">"I met Rahul Agarwal from CEAT Tyres today."</em>
          </div>
        )}

        {/* ── Deal Closed Banner ── */}
        {isDealClosed && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-emerald-800 font-semibold text-sm">🎉 Deal Closed Successfully!</p>
              <p className="text-emerald-600 text-xs mt-0.5">
                Fill in the Deal Details section below — select the product and quantity purchased.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ══ STEP 1 — RESPONSE (mandatory first) ══ */}
          <div
            className={`rounded-xl border-2 p-5 transition-all duration-200 ${
              errors.response
                ? 'border-red-400 bg-red-50'
                : form.response
                ? 'border-indigo-300 bg-indigo-50/30'
                : 'border-dashed border-indigo-300 bg-indigo-50/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                1
              </span>
              <label className="text-sm font-bold text-gray-800">
                How did the meeting go? — Response <span className="text-red-500">*</span>
              </label>
              {form.response && (
                <span className="ml-auto text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {RESPONSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleResponseSelect(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${
                    form.response === opt.value
                      ? opt.value === 'Deal Closed'
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-105'
                        : 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
                      : `${opt.color} border`
                  }`}
                >
                  <span className="text-base leading-none">{opt.icon}</span>
                  <span className="leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {errors.response && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.response}
              </p>
            )}
          </div>

          {/* ══ STEP 2 — CLIENT DETAILS ══ */}
          <div
            className={`space-y-4 transition-all duration-300 ${
              !responseSelected ? 'opacity-40 pointer-events-none select-none' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                2
              </span>
              <h3 className="text-sm font-bold text-gray-700">Client Details</h3>
              {!responseSelected && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ChevronRight size={12} /> Select response first
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Agarwal"
                  className={inputClass('name')}
                />
                <Err field="name" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Job Title *</label>
                <input
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Purchase Manager"
                  className={inputClass('jobTitle')}
                />
                <Err field="jobTitle" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company Name *</label>
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="e.g. CEAT Tyres"
                  className={inputClass('companyName')}
                />
                <Err field="companyName" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Industry *</label>
                <select
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className={inputClass('industry')}
                >
                  <option value="">— Select Industry —</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                <Err field="industry" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  className={inputClass('phone')}
                />
                <Err field="phone" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="e.g. rahul@ceat.com"
                  className={inputClass('email')}
                />
                <Err field="email" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">City *</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Mumbai"
                  className={inputClass('city')}
                />
                <Err field="city" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lead Type *</label>
                <select
                  name="leadType"
                  value={form.leadType}
                  onChange={handleChange}
                  className={inputClass('leadType')}
                >
                  <option value="">— Select Lead Type —</option>
                  {LEAD_TYPES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <Err field="leadType" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address *</label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange as any}
                  placeholder="Full office address..."
                  rows={2}
                  className={`${inputClass('address')} resize-none`}
                />
                <Err field="address" />
              </div>
            </div>
          </div>

          {/* ══ STEP 3 — MEETING DETAILS ══ */}
          <div
            className={`space-y-4 transition-all duration-300 ${
              !responseSelected ? 'opacity-40 pointer-events-none select-none' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                3
              </span>
              <h3 className="text-sm font-bold text-gray-700">Meeting Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Meeting Duration *</label>
                <select
                  name="meetingDuration"
                  value={form.meetingDuration}
                  onChange={handleChange}
                  className={inputClass('meetingDuration')}
                >
                  <option value="">— Select Duration —</option>
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <Err field="meetingDuration" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  Next Meeting Date
                  {dateRequired && <span className="text-indigo-600 font-bold">*</span>}
                  {dateDisabled && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-normal ml-1">
                      <XCircle size={12} /> Not applicable
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  name="nextMeetingDate"
                  value={form.nextMeetingDate}
                  onChange={handleChange}
                  disabled={dateDisabled}
                  min={new Date().toISOString().split('T')[0]}
                  className={inputClass('nextMeetingDate', dateDisabled)}
                />
                {sundayWarning && !dateDisabled && (
                  <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                    ⚠️ Sunday selected — will auto-shift to Monday on save
                  </p>
                )}
                {dateDisabled && (
                  <p className="text-gray-400 text-xs mt-1">
                    No follow-up needed for "{form.response}"
                  </p>
                )}
                <Err field="nextMeetingDate" />
              </div>
            </div>
          </div>

          {/* ══ STEP 4 — DEAL DETAILS (only when Deal Closed) ══ */}
          {isDealClosed && (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                  4
                </span>
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  <IndianRupee size={14} /> Deal Details
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Sold */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Product Sold <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="productSold"
                    value={form.productSold}
                    onChange={handleProductChange}
                    className={inputClass('productSold')}
                  >
                    <option value="">— Select Product from Inventory —</option>
                    {products.length === 0 ? (
                      <option disabled>No products yet — add from Inventory page first</option>
                    ) : (
                      products.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} — ₹{p.price.toLocaleString('en-IN')} / unit
                        </option>
                      ))
                    )}
                  </select>
                  {products.length === 0 && (
                    <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> Go to the Inventory page to add your products first.
                    </p>
                  )}
                  {selectedProduct && (
                    <p className="text-indigo-600 text-xs mt-1 font-medium">
                      Unit Price: ₹{unitPrice.toLocaleString('en-IN')} per unit
                    </p>
                  )}
                  <Err field="productSold" />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Quantity (Units Purchased) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.dealQty}
                    onChange={handleQtyChange}
                    placeholder="e.g. 2"
                    className={inputClass('dealQty')}
                  />
                  {dealQtyNum > 0 && selectedProduct && (
                    <p className="text-gray-500 text-xs mt-1">
                      {dealQtyNum} unit{dealQtyNum !== 1 ? 's' : ''} ×{' '}
                      ₹{unitPrice.toLocaleString('en-IN')} per unit
                    </p>
                  )}
                  <Err field="dealQty" />
                </div>

                {/* Total Deal Amount — read-only */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Total Deal Amount (₹) — Auto Calculated
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm font-bold">
                      ₹
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={dealTotal > 0 ? dealTotal.toLocaleString('en-IN') : ''}
                      placeholder="Auto-fills from product × qty"
                      className="w-full pl-7 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-sm cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  {dealTotal > 0 && (
                    <p className="text-emerald-700 text-xs mt-1 font-semibold">
                      ✅ ₹{unitPrice.toLocaleString('en-IN')} × {dealQtyNum} unit{dealQtyNum !== 1 ? 's' : ''} = ₹{dealTotal.toLocaleString('en-IN')}
                    </p>
                  )}
                  <Err field="dealAmount" />
                </div>
              </div>

              {/* Summary Pill */}
              {dealTotal > 0 && (
                <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div className="text-sm text-emerald-800">
                    <span className="font-semibold">{form.productSold}</span>
                    <span className="text-emerald-600 mx-2">×</span>
                    <span className="font-semibold">{dealQtyNum}</span>
                    <span className="text-emerald-600 mx-1">units</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-700">
                    = ₹{dealTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Salesperson Badge ── */}
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            <User size={14} className="text-indigo-500" />
            <span className="text-indigo-700 text-xs">
              This meeting will be recorded under{' '}
              <span className="font-bold">{user.name}</span>{' '}
              <span className="text-indigo-500">({user.role})</span>
            </span>
          </div>

          {/* ══ ACTION BUTTONS ══ */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow transition-all duration-200"
            >
              <Save size={16} />
              {editMeeting ? 'Update Meeting' : 'Save Meeting'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
            >
              <RefreshCw size={16} /> Reset
            </button>
            {editMeeting && (
              <button
                type="button"
                onClick={onSaved}
                className="ml-auto text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
