================================================
KAVERI CHILDREN'S HOSPITAL — APPOINTMENT SYSTEM
================================================
Version: 1.0 (Demo / Production-Ready Structure)
Built by: iDesign4U (www.idesign4u.in)

HOW TO RUN LOCALLY:
-------------------
Just open index.html in any modern browser.
No server required — works fully in browser.

DEMO TOOLS (Browser Console):
------------------------------
  kaveriAdmin()  → View today's bookings
  kaveriReset()  → Reset all tokens/bookings

BOOKING SYSTEM LOGIC:
---------------------
  - Opens at 5:00 AM IST daily
  - Max 100 tokens per day
  - Tokens 1-90: Normal slots (9AM-6PM)
  - Tokens 91-100: Overflow (6PM+)
  - 10 patients per hour slot
  - OTP verification (demo shows OTP on screen)
  - ₹50 advance payment (simulated)
  - One phone number = one booking per day

FUTURE INTEGRATIONS (comments in code):
-----------------------------------------
  1. Firebase → Replace localStorage (script.js)
  2. Razorpay → Replace simulatePayment() (script.js)
  3. WhatsApp API → sendWhatsAppConfirmation() (script.js)

FILES:
------
  index.html  → Full website structure
  style.css   → All styles (mobile-first)
  script.js   → Booking logic + system
  *.jpg/*.png → Hospital images

Contact: www.idesign4u.in
