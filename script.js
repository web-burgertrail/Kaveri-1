/* =========================================================
   KAVERI CHILDREN'S HOSPITAL — script.js
   - DEMO_MODE flag for easy go-live
   - OPD 24/7, only token booking from 5 AM
   - 100 tokens/day, auto-reset midnight
   - Anti-ghost: OTP + ₹50 advance + duplicate phone block
   - No-show 30-min policy
   ========================================================= */

const CONFIG = {
  // ─────────────────────────────────────────────
  // DEMO_MODE = true  → Booking always open (testing)
  // DEMO_MODE = false → Booking only opens at 5 AM IST
  // ─────────────────────────────────────────────
  DEMO_MODE:         true,   // 👈 Change to false for production

  TOTAL_TOKENS:      100,
  NORMAL_TOKENS:     90,     // Tokens 1-90: normal slots
  OVERFLOW_START:    91,     // Tokens 91-100: overflow (6 PM+)
  TOKEN_OPEN_HOUR:   5,      // 5 AM IST
  TOKEN_OPEN_MIN:    0,
  OPD_START_HOUR:    9,      // Slots start 9 AM
  PER_HOUR:          10,     // 10 patients per slot hour
  ADVANCE:           50,     // ₹50 advance
};

const LS = {
  BOOKINGS:    'kch_bookings',
  PHONES:      'kch_phones',
  NEXT_TOKEN:  'kch_next_token',
  DATE:        'kch_date',
};

// State
let otp = null, otpVerified = false, payDone = false;
let slideIdx = 0, slideTotal = 4, slideTimer = null;
let selectedPay = 'upi';

// ─────────────────────────────────
// INIT
// ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkReset();
  initSlider();
  initNavbar();
  updateDisplay();
  checkBookingState();
  setInterval(updateDisplay, 30000);
  setInterval(checkBookingState, 60000);
});

// ─────────────────────────────────
// IST TIME HELPERS
// ─────────────────────────────────
function getIST() {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 5.5 * 3600000);
}
function todayIST() {
  const d = getIST();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n){ return String(n).padStart(2,'0') }
function timeStr() {
  return getIST().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
}
function dateDisplayStr() {
  return getIST().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
function isTokenBookingOpen() {
  if (CONFIG.DEMO_MODE) return true;
  const ist = getIST(), total = ist.getHours()*60+ist.getMinutes();
  return total >= CONFIG.TOKEN_OPEN_HOUR*60+CONFIG.TOKEN_OPEN_MIN;
}

// ─────────────────────────────────
// DAILY RESET
// ─────────────────────────────────
function checkReset() {
  const today = todayIST(), saved = localStorage.getItem(LS.DATE);
  if (saved !== today) {
    localStorage.setItem(LS.BOOKINGS, '[]');
    localStorage.setItem(LS.PHONES,   '[]');
    localStorage.setItem(LS.NEXT_TOKEN,'1');
    localStorage.setItem(LS.DATE,      today);
  }
  // FUTURE: Firebase → sync reset from server date
}

// ─────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────
function nextToken()      { return parseInt(localStorage.getItem(LS.NEXT_TOKEN)||'1') }
function tokensLeft()     { return Math.max(0, CONFIG.TOTAL_TOKENS - nextToken() + 1) }
function hasTokens()      { return nextToken() <= CONFIG.TOTAL_TOKENS }
function issueToken()     {
  const t = nextToken();
  localStorage.setItem(LS.NEXT_TOKEN, String(t+1));
  return t;
}
function slotFor(n) {
  if (n >= CONFIG.OVERFLOW_START)
    return { text: '6:00 PM onwards (Waiting Slot)', overflow: true };
  const hr = CONFIG.OPD_START_HOUR + Math.floor((n-1)/CONFIG.PER_HOUR);
  const fmt = h => { const s=h>=12?'PM':'AM', h12=h>12?h-12:h; return `${h12}:00 ${s}`; };
  return { text: `${fmt(hr)} – ${fmt(hr+1)}`, overflow: false };
}

// ─────────────────────────────────
// TOKEN FILL BAR
// ─────────────────────────────────
function updateTokenBar() {
  const bar = document.getElementById('tokenBar');
  if (!bar) return;
  const pct = hasTokens() ? Math.round((tokensLeft()/CONFIG.TOTAL_TOKENS)*100) : 0;
  bar.style.width = pct + '%';
  bar.style.background = pct > 30 ? 'linear-gradient(90deg,#4DD0E1,#00BCD4)'
                        : pct > 10 ? 'linear-gradient(90deg,#FFB74D,#FF8F00)'
                        : 'linear-gradient(90deg,#EF9A9A,#E53935)';
}

// ─────────────────────────────────
// UPDATE ALL DISPLAYS
// ─────────────────────────────────
function updateDisplay() {
  const left  = hasTokens() ? tokensLeft() : 0;
  const nxt   = nextToken();
  const open  = isTokenBookingOpen();
  const slot  = hasTokens() ? slotFor(nxt) : null;

  // Hero strip
  set('heroLeft',   hasTokens() ? left : '0');
  set('heroNext',   hasTokens() ? `#${nxt}` : 'Full');
  set('heroStatus', !hasTokens() ? '🔴 Fully Booked'
                  : !open        ? '🟡 Opens 5 AM'
                  :                '🟢 Open Now');

  // Booking info panel
  set('tokensLeftDisplay', hasTokens() ? left : '0');
  set('nextTokenDisplay',  hasTokens() ? `#${nxt}` : 'N/A');
  set('estimatedSlotDisplay', slot ? slot.text : 'N/A');

  const ow = document.getElementById('overflowWarning');
  if (ow) ow.style.display = (hasTokens() && nxt > CONFIG.NORMAL_TOKENS) ? 'block' : 'none';

  updateTokenBar();
}
function set(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

// ─────────────────────────────────
// BOOKING STATE
// ─────────────────────────────────
function checkBookingState() {
  const wrapper  = document.getElementById('bookingWrapper');
  const closed   = document.getElementById('bookingClosedCard');
  const full     = document.getElementById('bookingFullCard');
  const closedTm = document.getElementById('closedTimeDisplay');
  if (!wrapper) return;
  if (closedTm) closedTm.textContent = timeStr();

  if (!isTokenBookingOpen()) {
    show(closed); hide(full); hide(wrapper); return;
  }
  if (!hasTokens()) {
    hide(closed); show(full); hide(wrapper); return;
  }
  hide(closed); hide(full); show(wrapper, 'grid');
}
function show(el, display='block') { if(el) el.style.display=display; }
function hide(el) { if(el) el.style.display='none'; }

// ─────────────────────────────────
// PHONE / DUPLICATE
// ─────────────────────────────────
function isPhoneUsed(ph) {
  return JSON.parse(localStorage.getItem(LS.PHONES)||'[]').includes(ph);
}
function registerPhone(ph) {
  const a = JSON.parse(localStorage.getItem(LS.PHONES)||'[]');
  a.push(ph); localStorage.setItem(LS.PHONES, JSON.stringify(a));
}

// ─────────────────────────────────
// OTP
// ─────────────────────────────────
function genOTP() { return String(Math.floor(1000+Math.random()*9000)); }

function sendOTP() {
  const ph = val('phoneNumber'), btn = document.getElementById('sendOtpBtn');
  clearErr('phoneErr');
  if (!/^\d{10}$/.test(ph)) { err('phoneErr','Enter a valid 10-digit phone number.'); return; }
  if (isPhoneUsed(ph)) { err('phoneErr','⚠️ This number already has a booking today.'); return; }

  otp = genOTP();
  console.log(`[Kaveri Demo] OTP for ${ph}: ${otp}`);

  const box = document.getElementById('demoOtpBox');
  const disp = document.getElementById('demoOtpDisplay');
  if (box) box.style.display = 'flex';
  if (disp) disp.textContent = otp;

  btn.disabled = true; btn.textContent = 'Sent ✓';
  setTimeout(()=>{ btn.disabled=false; btn.textContent='Resend'; }, 30000);
  toast(`OTP sent to ${ph} (Demo: see on screen)`, 'info');

  // FUTURE: MSG91 SMS
  // fetch('https://api.msg91.com/api/v5/otp', {
  //   method:'POST',
  //   headers:{'Content-Type':'application/json','authkey':'YOUR_KEY'},
  //   body: JSON.stringify({ mobile:'91'+ph, otp, template_id:'YOUR_TPL' })
  // });
}

function resendOTP() { sendOTP(); }

function otpInput(el, prevId, nextId) {
  el.value = el.value.replace(/\D/g,'');
  if (el.value && nextId) document.getElementById(nextId)?.focus();
  if (!el.value && prevId) document.getElementById(prevId)?.focus();
}
function getEnteredOTP() {
  return ['otp1','otp2','otp3','otp4'].map(id=>document.getElementById(id)?.value||'').join('');
}

function verifyOTP() {
  clearErr('otpErr');
  const entered = getEnteredOTP();
  if (entered.length < 4) { err('otpErr','Enter all 4 digits of the OTP.'); return; }
  if (entered !== otp) {
    err('otpErr','❌ Incorrect OTP. Try again.');
    toast('Incorrect OTP','err');
    ['otp1','otp2','otp3','otp4'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('otp1')?.focus();
    return;
  }
  otpVerified = true;
  toast('OTP Verified ✓','ok');
  goToStep(3);
}

// ─────────────────────────────────
// PAYMENT SIMULATION
// ─────────────────────────────────
function selectPayMode(el, mode) {
  selectedPay = mode;
  document.querySelectorAll('.pay-opt').forEach(o=>o.classList.remove('active'));
  el.classList.add('active');
}

function simulatePayment() {
  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  document.getElementById('payBtnTxt').textContent = '⏳ Processing...';
  showLoader('Processing payment...');
  setTimeout(()=>{ hideLoader(); payDone=true; finalizeBooking(); }, 2000);

  // FUTURE: Razorpay
  // const rzp = new Razorpay({
  //   key: 'rzp_live_XXXXXXXX',
  //   amount: CONFIG.ADVANCE * 100,
  //   currency: 'INR',
  //   name: "Kaveri Children's Hospital",
  //   description: 'Appointment Token Advance',
  //   handler: (resp) => { finalizeBooking(resp.razorpay_payment_id); },
  //   prefill: { contact: val('phoneNumber') },
  //   theme: { color: '#00BCD4' }
  // });
  // rzp.open();
}

// ─────────────────────────────────
// FINALIZE BOOKING
// ─────────────────────────────────
function finalizeBooking() {
  if (!hasTokens()) { toast('All tokens are booked. Try tomorrow.','err'); checkBookingState(); return; }

  const name  = val('patientName');
  const phone = val('phoneNumber');
  const age   = `${val('childAge')} ${document.getElementById('ageUnit')?.value||'Years'}`;
  const reason= val('visitReason') || 'General Consultation';
  const tkNum = issueToken();
  const slot  = slotFor(tkNum);
  const today = dateDisplayStr();

  const booking = { id:Date.now(), tkNum, name, phone, age, reason,
    slot:slot.text, overflow:slot.overflow, pay:selectedPay,
    date:todayIST(), at:new Date().toISOString() };

  const all = JSON.parse(localStorage.getItem(LS.BOOKINGS)||'[]');
  all.push(booking);
  localStorage.setItem(LS.BOOKINGS, JSON.stringify(all));
  registerPhone(phone);

  // FUTURE: Firebase → db.collection('bookings').add(booking)
  // FUTURE: WhatsApp API → sendWhatsApp(phone, tkNum, slot.text)

  showConfirm(booking, today);
  updateDisplay(); checkBookingState();
  toast('Booking Confirmed! 🎉','ok');
}

// ─────────────────────────────────
// SHOW CONFIRMED TICKET
// ─────────────────────────────────
function showConfirm(b, dateStr) {
  set('res-token', `#${b.tkNum}`);
  set('res-name',   b.name);
  set('res-slot',   b.slot);
  set('res-phone',  b.phone);
  set('res-date',   dateStr);

  const ow = document.getElementById('overflowResultWarning');
  if (ow) ow.style.display = b.overflow ? 'block' : 'none';

  const waBtn = document.getElementById('whatsappBtn');
  if (waBtn) {
    const msg = encodeURIComponent(
      `✅ Kaveri Children's Hospital\nBooking Confirmed!\n\n`+
      `👤 Patient: ${b.name}\n🎟️ Token: #${b.tkNum}\n⏰ Slot: ${b.slot}\n📅 Date: ${b.date}\n\n`+
      `📍 Near Tirumala Theatre, Doctor's Lane, Nirmal\n📞 9989979988`
    );
    waBtn.href = `https://wa.me/919989979988?text=${msg}`;
    waBtn.target = '_blank';
  }
  goToStep(4);
}

// ─────────────────────────────────
// STEP NAVIGATION
// ─────────────────────────────────
function proceedToOTP() {
  clearErr('nameErr'); clearErr('phoneErr'); clearErr('ageErr');
  const name  = val('patientName');
  const phone = val('phoneNumber');
  const age   = val('childAge');
  let ok = true;

  if (!name.trim()) { err('nameErr','Patient name is required.'); ok=false; }
  if (!/^\d{10}$/.test(phone)) { err('phoneErr','Enter a valid 10-digit phone number.'); ok=false; }
  else if (isPhoneUsed(phone)) { err('phoneErr','⚠️ This number already has a booking today.'); ok=false; }
  if (!age || isNaN(age) || Number(age)<0 || Number(age)>18) { err('ageErr','Enter valid age (0–18).'); ok=false; }
  if (!ok) return;

  set('otpPhoneDisplay', `+91 ${phone}`);
  if (!otp) sendOTP();
  goToStep(2);
}

function goToStep(n) {
  document.querySelectorAll('.fstep').forEach(el=>el.classList.add('hidden'));
  document.getElementById(`step${n}`)?.classList.remove('hidden');

  for (let i=1; i<=4; i++) {
    const sb = document.getElementById(`sb${i}`);
    if (!sb) continue;
    sb.classList.remove('active','done');
    if (i<n) { sb.classList.add('done'); sb.querySelector('.step-dot').textContent='✓'; }
    else if (i===n) { sb.classList.add('active'); sb.querySelector('.step-dot').textContent=i; }
    else { sb.querySelector('.step-dot').textContent=i; }
    if (i<4) {
      const sl = document.getElementById(`sl${i}`);
      if (sl) sl.classList.toggle('done', i<n);
    }
  }
  if (window.innerWidth<768) document.getElementById('book')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ─────────────────────────────────
// RESET
// ─────────────────────────────────
function resetBooking() {
  otp=null; otpVerified=false; payDone=false; selectedPay='upi';
  ['patientName','phoneNumber','childAge','visitReason'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  ['otp1','otp2','otp3','otp4'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  const dd = document.getElementById('demoOtpDisplay'); if(dd) dd.textContent='–';
  const db = document.getElementById('demoOtpBox'); if(db) db.style.display='none';
  const pb = document.getElementById('payBtn'); if(pb) pb.disabled=false;
  const pt = document.getElementById('payBtnTxt'); if(pt) pt.textContent=`💳 Pay ₹${CONFIG.ADVANCE} & Confirm Booking`;
  const sb = document.getElementById('sendOtpBtn'); if(sb){ sb.disabled=false; sb.textContent='Send OTP'; }
  document.querySelectorAll('.pay-opt').forEach((o,i)=>{ o.classList.toggle('active',i===0); });
  goToStep(1);
  updateDisplay(); checkBookingState();
}

// ─────────────────────────────────
// LOADER & TOAST
// ─────────────────────────────────
function showLoader(txt='Processing...') {
  const l=document.getElementById('gLoader');
  document.getElementById('gLoaderTxt').textContent=txt;
  if(l) l.style.display='flex';
}
function hideLoader() { const l=document.getElementById('gLoader'); if(l) l.style.display='none'; }

function toast(msg, type='info', dur=3200) {
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=msg;
  t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'), dur);
}

// ─────────────────────────────────
// HELPERS
// ─────────────────────────────────
function val(id) { return document.getElementById(id)?.value.trim()||''; }
function err(id, msg) { const e=document.getElementById(id); if(e) e.textContent=msg; }
function clearErr(id) { const e=document.getElementById(id); if(e) e.textContent=''; }

// ─────────────────────────────────
// SLIDER
// ─────────────────────────────────
function initSlider() {
  const dotsEl = document.getElementById('hdots');
  if (!dotsEl) return;
  for (let i=0; i<slideTotal; i++) {
    const d = document.createElement('div');
    d.className = `hdot${i===0?' active':''}`;
    d.addEventListener('click', ()=>goSlide(i));
    dotsEl.appendChild(d);
  }
  document.getElementById('hprev')?.addEventListener('click', ()=>goSlide((slideIdx-1+slideTotal)%slideTotal));
  document.getElementById('hnext')?.addEventListener('click', ()=>goSlide((slideIdx+1)%slideTotal));
  startSlider();

  // Touch swipe
  const track = document.getElementById('heroTrack');
  let tx=0;
  track?.addEventListener('touchstart', e=>{ tx=e.touches[0].clientX; }, {passive:true});
  track?.addEventListener('touchend', e=>{
    const diff = tx - e.changedTouches[0].clientX;
    if (Math.abs(diff)>45) goSlide(diff>0 ? (slideIdx+1)%slideTotal : (slideIdx-1+slideTotal)%slideTotal);
  });
}

function goSlide(n) {
  document.querySelectorAll('.hslide')[slideIdx]?.classList.remove('active');
  slideIdx = n;
  document.querySelectorAll('.hslide')[slideIdx]?.classList.add('active');
  document.querySelectorAll('.hdot').forEach((d,i)=>d.classList.toggle('active',i===n));
  clearInterval(slideTimer); startSlider();
}
function startSlider() { slideTimer = setInterval(()=>goSlide((slideIdx+1)%slideTotal), 4800); }

// ─────────────────────────────────
// NAVBAR
// ─────────────────────────────────
function initNavbar() {
  window.addEventListener('scroll', ()=>{
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY>50);
  });
  document.getElementById('burger')?.addEventListener('click', ()=>{
    document.getElementById('mobMenu')?.classList.toggle('open');
  });
}
function closeMob() { document.getElementById('mobMenu')?.classList.remove('open'); }

// Smooth scroll
document.addEventListener('click', e=>{
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - 76;
  window.scrollTo({top, behavior:'smooth'});
  closeMob();
});

// ─────────────────────────────────
// CONSOLE TOOLS (for you only)
// ─────────────────────────────────
window.kchAdmin = ()=>{
  const b=JSON.parse(localStorage.getItem(LS.BOOKINGS)||'[]');
  console.table(b);
  console.log('Next token:', nextToken(), '| Left:', tokensLeft());
  return b;
};
window.kchReset = ()=>{
  Object.values(LS).forEach(k=>localStorage.removeItem(k));
  checkReset(); updateDisplay(); checkBookingState(); resetBooking();
  toast('Reset done!','info');
};
