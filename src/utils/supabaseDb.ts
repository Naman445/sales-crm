import { supabase } from './supabase';
import { Meeting, Product, AppUser } from '../types';

// ─── SESSION ──────────────────────────────────────────────────────────────────
const SESSION_KEY = 'salescrm_session';

export function getSession(): AppUser | null {
  try {
    const d = localStorage.getItem(SESSION_KEY);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}
export function setSession(user: AppUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── DB HEALTH CHECK ─────────────────────────────────────────────────────────
// Returns null if OK, or an error message if tables are missing
export async function checkDbSetup(): Promise<string | null> {
  const { error } = await supabase.from('profiles').select('id').limit(1);
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache')) {
      return 'TABLES_MISSING';
    }
    // Permission error means table exists but RLS is blocking — that's fine
    if (error.code === '42501' || error.message.includes('permission')) return null;
  }
  return null;
}

// ─── AUTH — Sign Up ───────────────────────────────────────────────────────────
export async function signUp(
  name: string,
  email: string,
  password: string,
  role: string
): Promise<{ user: AppUser | null; error: string | null }> {

  // Step 1 — create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('rate limit') || error.message.includes('after'))
      return { user: null, error: 'RATE_LIMIT' };
    if (error.message.includes('already registered') || error.message.includes('already been registered'))
      return { user: null, error: 'This email is already registered. Please sign in instead.' };
    if (error.message.includes('Password should be'))
      return { user: null, error: 'Password must be at least 6 characters.' };
    return { user: null, error: error.message };
  }

  if (!data.user) return { user: null, error: 'Signup failed. Please try again.' };

  // Step 2 — insert into profiles table
  const { error: profErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    name,
    role,
  });

  if (profErr) {
    // If duplicate key — user already has a profile, continue
    if (profErr.message.includes('duplicate') || profErr.message.includes('unique') || profErr.code === '23505') {
      // fine — continue
    } else if (profErr.message.includes('relation') || profErr.message.includes('does not exist') || profErr.message.includes('schema cache')) {
      // Tables not created yet
      return { user: null, error: 'DB_NOT_SETUP' };
    } else {
      return { user: null, error: profErr.message };
    }
  }

  const appUser: AppUser = {
    id: data.user.id,
    name,
    email,
    password: '',
    role: role as AppUser['role'],
    createdAt: new Date().toISOString(),
  };
  return { user: appUser, error: null };
}

// ─── AUTH — Sign In ───────────────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<{ user: AppUser | null; error: string | null }> {

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Email not confirmed'))
      return { user: null, error: 'EMAIL_NOT_CONFIRMED' };
    if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials'))
      return { user: null, error: 'WRONG_CREDENTIALS' };
    if (error.message.toLowerCase().includes('rate limit'))
      return { user: null, error: 'RATE_LIMIT' };
    return { user: null, error: error.message };
  }

  if (!data.user) return { user: null, error: 'Login failed. Please try again.' };

  // Fetch profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profErr) {
    if (profErr.message.includes('relation') || profErr.message.includes('does not exist') || profErr.message.includes('schema cache')) {
      return { user: null, error: 'DB_NOT_SETUP' };
    }
    // Profile missing — try to build from auth metadata
    const meta = data.user.user_metadata;
    if (meta?.name) {
      // Re-insert profile from metadata
      await supabase.from('profiles').insert({
        id: data.user.id,
        name: meta.name,
        role: meta.role ?? 'Sales',
      });
      const appUser: AppUser = {
        id: data.user.id,
        name: meta.name,
        email: data.user.email ?? email,
        password: '',
        role: (meta.role ?? 'Sales') as AppUser['role'],
        createdAt: new Date().toISOString(),
      };
      return { user: appUser, error: null };
    }
    return { user: null, error: 'Profile not found. Please create a new account.' };
  }

  const appUser: AppUser = {
    id: data.user.id,
    name: profile.name,
    email: data.user.email ?? email,
    password: '',
    role: profile.role as AppUser['role'],
    createdAt: profile.created_at,
  };
  return { user: appUser, error: null };
}

// ─── AUTH — Sign Out ──────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  clearSession();
}

// ─── PHOTO UPLOAD ─────────────────────────────────────────────────────────────
export async function uploadPhoto(
  base64: string,
  userId: string,
  meetingId: string
): Promise<string | null> {
  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const byteChars = atob(base64Data);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArr], { type: 'image/jpeg' });
    const filePath = `${userId}/${meetingId}.jpg`;

    const { error } = await supabase.storage
      .from('visit-photos')
      .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });

    if (error) { console.error('Photo upload error:', error.message); return null; }

    // Signed URL valid for 2 hours only — expires automatically
    const { data: signedData } = await supabase.storage
      .from('visit-photos')
      .createSignedUrl(filePath, 60 * 60 * 2);

    return signedData?.signedUrl ?? null;
  } catch (e) {
    console.error('Photo upload exception:', e);
    return null;
  }
}

// ─── REFRESH SIGNED PHOTO URL ─────────────────────────────────────────────────
// Regenerates a fresh 2-hour signed URL for a stored photo
export async function refreshPhotoUrl(
  userId: string,
  meetingId: string
): Promise<string | null> {
  try {
    const filePath = `${userId}/${meetingId}.jpg`;
    const { data, error } = await supabase.storage
      .from('visit-photos')
      .createSignedUrl(filePath, 60 * 60 * 2); // 2 hours
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch { return null; }
}

// ─── MEETINGS ─────────────────────────────────────────────────────────────────
export async function getMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }

  // Refresh signed URLs for all meetings that have photos
  const meetings = await Promise.all(
    (data ?? []).map(async (r) => {
      const meeting = dbToMeeting(r);
      // If this meeting has a stored photo, regenerate a fresh signed URL
      if (r.photo_url && meeting.salesPersonId && meeting.id) {
        const freshUrl = await refreshPhotoUrl(meeting.salesPersonId, meeting.id);
        if (freshUrl && meeting.proof) {
          meeting.proof.photoUrl = freshUrl;
        }
      }
      return meeting;
    })
  );
  return meetings;
}

export async function saveMeeting(
  meeting: Meeting,
  photoBase64?: string
): Promise<{ error: string | null }> {
  let photoUrl: string | null = null;
  if (photoBase64 && meeting.proof) {
    photoUrl = await uploadPhoto(photoBase64, meeting.salesPersonId, meeting.id);
  }
  const row = meetingToDb(meeting, photoUrl);
  const { error } = await supabase.from('meetings').insert(row);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateMeeting(
  meeting: Meeting,
  photoBase64?: string
): Promise<{ error: string | null }> {
  let photoUrl: string | undefined = undefined;
  if (photoBase64 && meeting.proof) {
    const uploaded = await uploadPhoto(photoBase64, meeting.salesPersonId, meeting.id);
    if (uploaded) photoUrl = uploaded;
  }
  const row = meetingToDb(meeting, photoUrl ?? null);
  const { error } = await supabase.from('meetings').update(row).eq('id', meeting.id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteMeeting(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return []; }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    category: r.category,
  }));
}

export async function saveProduct(product: Product): Promise<{ error: string | null }> {
  const { error } = await supabase.from('inventory').insert({
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateProduct(product: Product): Promise<{ error: string | null }> {
  const { error } = await supabase.from('inventory').update({
    name: product.name,
    price: product.price,
    category: product.category,
  }).eq('id', product.id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dbToMeeting(r: Record<string, unknown>): Meeting {
  return {
    id: r.id as string,
    salesPersonId: (r.sales_person_id as string) ?? '',
    salesPersonName: (r.sales_person_name as string) ?? '',
    salesPersonRole: (r.sales_person_role as Meeting['salesPersonRole']),
    name: (r.client_name as string) ?? '',
    jobTitle: (r.job_title as string) ?? '',
    companyName: (r.company_name as string) ?? '',
    industry: (r.industry as string) ?? '',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    response: (r.response as Meeting['response']),
    leadType: (r.lead_type as Meeting['leadType']),
    city: (r.city as string) ?? '',
    address: (r.address as string) ?? '',
    meetingDuration: (r.meeting_duration as string) ?? '',
    nextMeetingDate: (r.next_meeting_date as string) ?? '',
    dealAmount: r.deal_amount ? Number(r.deal_amount) : undefined,
    dealQty: r.deal_qty ? Number(r.deal_qty) : undefined,
    productSold: (r.product_sold as string) ?? undefined,
    revenueDate: (r.revenue_date as string) ?? undefined,
    proof: r.photo_url
      ? {
          photoBase64: '',
          photoUrl: r.photo_url as string,
          latitude: Number(r.latitude ?? 0),
          longitude: Number(r.longitude ?? 0),
          locationAddress: (r.location_address as string) ?? '',
          capturedAt: (r.visit_time as string) ?? '',
        }
      : r.latitude
      ? {
          photoBase64: '',
          photoUrl: undefined,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          locationAddress: (r.location_address as string) ?? '',
          capturedAt: (r.visit_time as string) ?? '',
        }
      : undefined,
    createdAt: (r.created_at as string) ?? '',
  };
}

function meetingToDb(m: Meeting, photoUrl: string | null): Record<string, unknown> {
  return {
    id: m.id,
    sales_person_id: m.salesPersonId,
    sales_person_name: m.salesPersonName,
    sales_person_role: m.salesPersonRole,
    client_name: m.name,
    job_title: m.jobTitle,
    company_name: m.companyName,
    industry: m.industry || null,
    phone: m.phone,
    email: m.email,
    response: m.response,
    lead_type: m.leadType,
    city: m.city,
    address: m.address,
    meeting_duration: m.meetingDuration,
    next_meeting_date: m.nextMeetingDate || null,
    deal_amount: m.dealAmount ?? null,
    deal_qty: m.dealQty ?? null,
    product_sold: m.productSold ?? null,
    photo_url: photoUrl,
    latitude: m.proof?.latitude ?? null,
    longitude: m.proof?.longitude ?? null,
    location_address: m.proof?.locationAddress ?? null,
    visit_time: m.proof?.capturedAt ?? null,
  };
}
