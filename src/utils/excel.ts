import * as XLSX from 'xlsx';
import { Meeting } from '../types';

export function exportToExcel(meetings: Meeting[]): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: All Meetings ──────────────────────────────────────────────────
  const rows = meetings.map((m) => ({
    'Sales Person':      m.salesPersonName || '—',
    'Role':              m.salesPersonRole || '—',
    'Photo Taken':       m.proof?.photoBase64 ? '✅ YES' : '❌ NO',
    'Visit Time':        m.proof ? new Date(m.proof.capturedAt).toLocaleString('en-IN') : '—',
    'Latitude':          m.proof ? +m.proof.latitude.toFixed(6)  : '—',
    'Longitude':         m.proof ? +m.proof.longitude.toFixed(6) : '—',
    'Location Address':  m.proof ? m.proof.locationAddress : '—',
    'Client Name':       m.name,
    'Job Title':         m.jobTitle,
    'Company':           m.companyName,
    'Industry':          m.industry || '—',
    'Phone':             m.phone,
    'Email':             m.email,
    'Response':          m.response,
    'Lead Type':         m.leadType,
    'City':              m.city,
    'Address':           m.address,
    'Meeting Duration':  m.meetingDuration,
    'Next Meeting Date': m.nextMeetingDate || '—',
    'Deal Closed':       m.response === 'Deal Closed' ? 'Yes' : 'No',
    'Product Sold':      m.productSold || '—',
    'Qty Purchased':     m.dealQty ?? '',
    'Deal Amount (₹)':  m.dealAmount ?? '',
    'Created At':        new Date(m.createdAt).toLocaleString('en-IN'),
  }));

  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'All Meetings');

  // ── Sheet 2: Closed Deals ──────────────────────────────────────────────────
  const deals = meetings.filter((m) => m.response === 'Deal Closed' && m.dealAmount);
  if (deals.length > 0) {
    const dealRows = deals.map((m) => ({
      'Sales Person':    m.salesPersonName || '—',
      'Client':          m.name,
      'Company':         m.companyName,
      'Industry':        m.industry || '—',
      'City':            m.city,
      'Product Sold':    m.productSold || '—',
      'Qty Purchased':   m.dealQty ?? '',
      'Unit Price (₹)':  m.dealQty && m.dealAmount ? Math.round(m.dealAmount / m.dealQty) : '',
      'Deal Amount (₹)': m.dealAmount ?? 0,
      'Visit Verified':  m.proof ? `✅ ${m.proof.latitude.toFixed(4)}, ${m.proof.longitude.toFixed(4)}` : '❌ Not Verified',
      'Date':            new Date(m.createdAt).toLocaleDateString('en-IN'),
    }));

    const total = deals.reduce((s, m) => s + (m.dealAmount || 0), 0);
    dealRows.push({
      'Sales Person':    'TOTAL',
      'Client':          '',
      'Company':         '',
      'Industry':        '',
      'City':            '',
      'Product Sold':    `${deals.length} deal(s)`,
      'Qty Purchased':   '',
      'Unit Price (₹)':  '',
      'Deal Amount (₹)': total,
      'Visit Verified':  '',
      'Date':            '',
    });

    const ws2 = XLSX.utils.json_to_sheet(dealRows);
    ws2['!cols'] = Object.keys(dealRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Closed Deals');
  }

  // ── Sheet 3: Visit Proof Log ───────────────────────────────────────────────
  const proofRows = meetings
    .filter((m) => m.proof)
    .map((m, idx) => ({
      'Sr':              idx + 1,
      'Sales Person':    m.salesPersonName || '—',
      'Role':            m.salesPersonRole || '—',
      'Client':          m.name,
      'Company':         m.companyName,
      'Industry':        m.industry || '—',
      'City':            m.city,
      'Response':        m.response,
      'Latitude':        m.proof!.latitude.toFixed(6),
      'Longitude':       m.proof!.longitude.toFixed(6),
      'Location':        m.proof!.locationAddress,
      'Photo Captured':  new Date(m.proof!.capturedAt).toLocaleString('en-IN'),
      'Meeting Date':    new Date(m.createdAt).toLocaleDateString('en-IN'),
      'Photo in HTML Report': '✅ See Photo Report file',
    }));

  if (proofRows.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(proofRows);
    ws3['!cols'] = Object.keys(proofRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 18) }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Visit Proof Log');
  }

  // ── Sheet 4: Industry Analytics ──────────────────────────────────────────────
  const industryMap: Record<string, { meetings: number; totalDuration: number; deals: number; revenue: number }> = {};
  const durationToMinutes = (d: string): number => {
    if (d.includes('2+')) return 150;
    if (d.includes('2 hour')) return 120;
    if (d.includes('1.5')) return 90;
    if (d.includes('1 hour')) return 60;
    if (d.includes('45')) return 45;
    if (d.includes('30')) return 30;
    if (d.includes('15')) return 15;
    return 30;
  };
  meetings.forEach((m) => {
    const ind = m.industry || 'Not Specified';
    if (!industryMap[ind]) industryMap[ind] = { meetings: 0, totalDuration: 0, deals: 0, revenue: 0 };
    industryMap[ind].meetings++;
    industryMap[ind].totalDuration += durationToMinutes(m.meetingDuration);
    if (m.response === 'Deal Closed') {
      industryMap[ind].deals++;
      industryMap[ind].revenue += m.dealAmount || 0;
    }
  });
  const industryRows = Object.entries(industryMap)
    .sort((a, b) => b[1].revenue - a[1].revenue || b[1].deals - a[1].deals)
    .map(([ind, data]) => ({
      'Industry': ind,
      'Total Meetings': data.meetings,
      'Total Time (mins)': data.totalDuration,
      'Avg Duration (mins)': Math.round(data.totalDuration / data.meetings),
      'Deals Closed': data.deals,
      'Conversion Rate': data.deals > 0 ? `${Math.round((data.deals / data.meetings) * 100)}%` : '0%',
      'Revenue (₹)': data.revenue,
      'Revenue Per Meeting (₹)': data.meetings > 0 ? Math.round(data.revenue / data.meetings) : 0,
      'Suggestion': data.deals / data.meetings >= 0.3
        ? '🟢 HIGH PRIORITY — Great conversion, increase visits'
        : data.deals / data.meetings >= 0.15
        ? '🟡 MEDIUM — Decent potential, maintain visits'
        : data.meetings >= 3 && data.deals === 0
        ? '🔴 LOW — Many meetings, no conversion. Review approach'
        : '⚪ INSUFFICIENT DATA — Need more meetings',
    }));

  if (industryRows.length > 0) {
    const ws4 = XLSX.utils.json_to_sheet(industryRows);
    ws4['!cols'] = Object.keys(industryRows[0]).map((k) => ({ wch: Math.max(k.length + 2, 20) }));
    XLSX.utils.book_append_sheet(wb, ws4, 'Industry Analytics');
  }

  // Write the XLSX file
  XLSX.writeFile(wb, `SalesCRM_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);

  // ── Also generate an HTML Photo Report ────────────────────────────────────
  // This contains the actual embedded photos since XLSX free tier can't embed images
  const meetingsWithPhoto = meetings.filter((m) => m.proof?.photoBase64);
  if (meetingsWithPhoto.length > 0) {
    generatePhotoReport(meetingsWithPhoto);
  }
}

// ── HTML Photo Report (with embedded images) ──────────────────────────────
function generatePhotoReport(meetings: Meeting[]): void {
  const cards = meetings.map((m) => {
    const proof = m.proof!;
    const mapsUrl = `https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`;
    return `
    <div style="
      background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.10);
      margin-bottom:32px; overflow:hidden; page-break-inside:avoid;
      border:1px solid #e5e7eb;
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e293b,#3730a3); padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="color:#fff; font-size:18px; font-weight:700;">${m.name}</div>
          <div style="color:#a5b4fc; font-size:13px;">${m.jobTitle} · ${m.companyName}</div>
        </div>
        <div style="text-align:right;">
          <span style="background:${
            m.response === 'Deal Closed' ? '#059669' :
            m.response === 'Interested' ? '#2563eb' :
            m.response === 'Dead Lead'  ? '#6b7280' : '#d97706'
          }; color:#fff; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:600;">
            ${m.response}
          </span>
          <div style="color:#94a3b8; font-size:11px; margin-top:4px;">
            ${new Date(m.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
          </div>
        </div>
      </div>

      <div style="display:flex; flex-wrap:wrap;">
        <!-- Photo -->
        <div style="flex:0 0 320px; max-width:320px; padding:16px;">
          <img src="${proof.photoBase64}" alt="Visit proof"
            style="width:100%; border-radius:10px; border:2px solid #e5e7eb; display:block;"
          />
          <div style="text-align:center; font-size:11px; color:#6b7280; margin-top:6px;">
            📷 ${new Date(proof.capturedAt).toLocaleString('en-IN')}
          </div>
        </div>

        <!-- Details -->
        <div style="flex:1; min-width:240px; padding:16px;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <tr>
              <td style="padding:6px 0; color:#6b7280; width:40%;">Sales Person</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.salesPersonName || '—'} <span style="color:#6b7280; font-weight:400;">(${m.salesPersonRole || '—'})</span></td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Phone</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.phone}</td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Email</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.email}</td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Lead Type</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.leadType}</td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Duration</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.meetingDuration}</td>
            </tr>
            ${m.response === 'Deal Closed' && m.dealAmount ? `
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Deal Amount</td>
              <td style="padding:6px 0; font-weight:700; color:#059669;">₹${m.dealAmount.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280;">Product</td>
              <td style="padding:6px 0; font-weight:600; color:#1e293b;">${m.productSold || '—'} × ${m.dealQty ?? 1}</td>
            </tr>
            ` : ''}
            <tr style="border-top:1px solid #f1f5f9;">
              <td style="padding:6px 0; color:#6b7280; vertical-align:top;">Location</td>
              <td style="padding:6px 0; color:#1e293b;">
                <div style="font-size:11px; color:#4b5563; line-clamp:2;">${proof.locationAddress}</div>
                <a href="${mapsUrl}" target="_blank"
                  style="display:inline-block; margin-top:4px; font-size:11px; color:#2563eb; font-weight:600; text-decoration:none;">
                  📍 ${proof.latitude.toFixed(5)}, ${proof.longitude.toFixed(5)} → Open in Maps
                </a>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SalesCRM — Visit Photo Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; padding: 32px 16px; color: #1e293b; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #1e293b; }
    .header p  { color: #64748b; margin-top: 6px; font-size: 14px; }
    .badge { display: inline-block; background: #3730a3; color: #fff; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 10px; }
    .container { max-width: 900px; margin: 0 auto; }
    @media print {
      body { background: #fff; padding: 0; }
      .container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📸 SalesCRM — Visit Photo Report</h1>
      <p>Generated on ${new Date().toLocaleString('en-IN')} · ${meetings.length} visit(s) with photo proof</p>
      <span class="badge">🔒 Confidential — Internal Use Only</span>
    </div>
    ${cards}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `SalesCRM_PhotoReport_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
