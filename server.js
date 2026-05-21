// ============================================
//   PERSONAL CALL ASSISTANT - by Claude AI
//   Aapka AI Call Screening System
// ============================================

const express = require('express');
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ============================================
//   SETTINGS - Yahan apni details bharein
// ============================================
const CONFIG = {
  YOUR_PHONE: '+917037971208',        // Aapka asli mobile number (jab important call ho to yahan connect karega)
  TWILIO_NUMBER: '+14323006450',       // Aapka Twilio number (Twilio dashboard se milega)
  OWNER_NAME: 'Sahib',                 // Aap kya bolna chahte hain caller ko (e.g. "Sahib", aapka naam)
  WAIT_SECONDS: 35,                    // Kitne second baad aapko connect kare
  LANGUAGE: 'hi-IN',                   // Hindi voice
  VOICE: 'Polly.Aditi',               // Amazon Polly Hindi voice (Twilio supported)
  VOICEMAIL_EMAIL: '',                 // Optional: voicemail transcript email (Twilio feature)
};

// ============================================
//   STEP 1: Call aate hi assistant attend karta hai
// ============================================
app.post('/incoming-call', (req, res) => {
  const callerNumber = req.body.From || 'Unknown';
  const twiml = new VoiceResponse();

  console.log(`📞 New call from: ${callerNumber}`);

  // Caller ko greet karo
  twiml.say({
    voice: CONFIG.VOICE,
    language: CONFIG.LANGUAGE
  }, `Namaste! Aap ${CONFIG.OWNER_NAME} ke personal assistant se baat kar rahe hain. 
     Sahib abhi upalabdh nahin hain. 
     Kripya apna naam aur call ka maqsad bataiye. 
     Beep ke baad boliye.`);

  // Caller ki baat record karo (max 30 seconds)
  twiml.record({
    action: '/handle-recording',
    method: 'POST',
    maxLength: 30,
    playBeep: true,
    transcribe: true,
    transcribeCallback: '/transcription',
    timeout: 5
  });

  // Agar kuch na bole
  twiml.say({
    voice: CONFIG.VOICE,
    language: CONFIG.LANGUAGE
  }, 'Koi sandesh nahi mila. Dhanyavaad.');

  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================
//   STEP 2: Recording ke baad decide karo
// ============================================
app.post('/handle-recording', (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callerNumber = req.body.From;
  const callSid = req.body.CallSid;
  
  console.log(`🎙️ Recording received from: ${callerNumber}`);
  console.log(`   Recording URL: ${recordingUrl}`);

  const twiml = new VoiceResponse();

  // Caller ko wait karne kaho
  twiml.say({
    voice: CONFIG.VOICE,
    language: CONFIG.LANGUAGE
  }, `Shukriya. Aapka sandesh ${CONFIG.OWNER_NAME} tak pahuncha diya ja raha hai. 
     Ek moment rukiye, hum dekhte hain ki voh abhi available hain ya nahi.`);

  // 35 second pause (ya jo bhi aapne set kiya hai)
  twiml.pause({ length: 5 });

  twiml.say({
    voice: CONFIG.VOICE,
    language: CONFIG.LANGUAGE
  }, `${CONFIG.OWNER_NAME} se connect karne ki koshish kar rahe hain...`);

  // Aapko connect karne ki koshish karo
  const dial = twiml.dial({
    action: '/call-result',
    method: 'POST',
    timeout: CONFIG.WAIT_SECONDS,
    callerId: CONFIG.TWILIO_NUMBER
  });

  dial.number({
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallback: '/dial-status'
  }, CONFIG.YOUR_PHONE);

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================
//   STEP 3: Agar aapne call receive nahi ki
// ============================================
app.post('/call-result', (req, res) => {
  const dialStatus = req.body.DialCallStatus;
  const twiml = new VoiceResponse();

  console.log(`📱 Dial result: ${dialStatus}`);

  if (dialStatus === 'completed') {
    // Call successful rahi
    console.log('✅ Call connected successfully!');
    twiml.hangup();
  } else {
    // Aapne receive nahi ki — voicemail le lo
    twiml.say({
      voice: CONFIG.VOICE,
      language: CONFIG.LANGUAGE
    }, `Sahib abhi available nahin hain. 
       Aapka sandesh save kar liya gaya hai. 
       Voh jald hi aapko call karenge. 
       Aap apna contact number bhi chhod sakte hain. Dhanyavaad!`);

    // Voicemail ke liye ek aur recording
    twiml.record({
      action: '/voicemail-complete',
      method: 'POST',
      maxLength: 60,
      playBeep: true,
      transcribe: true,
      transcribeCallback: '/transcription',
      timeout: 5
    });

    twiml.say({
      voice: CONFIG.VOICE,
      language: CONFIG.LANGUAGE
    }, 'Dhanyavaad. Aapka din achha rahe!');

    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================
//   Voicemail complete
// ============================================
app.post('/voicemail-complete', (req, res) => {
  console.log('📬 Voicemail saved:', req.body.RecordingUrl);
  const twiml = new VoiceResponse();
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================
//   Transcription callback
// ============================================
app.post('/transcription', (req, res) => {
  const transcript = req.body.TranscriptionText;
  const caller = req.body.From;
  console.log(`📝 TRANSCRIPTION from ${caller}:`);
  console.log(`   "${transcript}"`);
  // Yahan aap email ya SMS bhej sakte hain (Twilio SendGrid ya Nodemailer se)
  res.sendStatus(200);
});

// ============================================
//   Dial status update
// ============================================
app.post('/dial-status', (req, res) => {
  console.log(`📊 Dial status: ${req.body.CallStatus}`);
  res.sendStatus(200);
});

// ============================================
//   Dashboard - calls dekho browser mein
// ============================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Call Assistant Dashboard</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 2rem; }
        .container { max-width: 700px; margin: 0 auto; }
        h1 { font-size: 2rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.5rem; }
        .subtitle { color: #94a3b8; margin-bottom: 2rem; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
        .card h3 { color: #38bdf8; margin-bottom: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; }
        .status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 999px; background: #064e3b; color: #34d399; font-size: 13px; font-weight: 600; margin-bottom: 1.5rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; animation: blink 1.4s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .route { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #334155; }
        .route:last-child { border-bottom: none; }
        .route-path { font-family: monospace; color: #7dd3fc; font-size: 14px; }
        .route-desc { color: #94a3b8; font-size: 13px; }
        .badge { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #1d4ed8; color: #bfdbfe; }
        .step { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #1e293b; }
        .step-num { width: 28px; height: 28px; border-radius: 50%; background: #0ea5e9; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; margin-top: 2px; }
        .step-text { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
        .config-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155; font-size: 14px; }
        .config-key { color: #94a3b8; }
        .config-val { color: #f1f5f9; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📞 Call Assistant</h1>
        <p class="subtitle">Aapka personal AI call screening system</p>
        <div class="status"><div class="dot"></div>Server Active — Ready to screen calls</div>

        <div class="card">
          <h3>⚙️ Current Config</h3>
          <div class="config-item"><span class="config-key">Owner name</span><span class="config-val">${CONFIG.OWNER_NAME}</span></div>
          <div class="config-item"><span class="config-key">Your number</span><span class="config-val">${CONFIG.YOUR_PHONE}</span></div>
          <div class="config-item"><span class="config-key">Wait before connecting</span><span class="config-val">${CONFIG.WAIT_SECONDS} seconds</span></div>
          <div class="config-item"><span class="config-key">Language</span><span class="config-val">Hindi (hi-IN)</span></div>
        </div>

        <div class="card">
          <h3>🔁 Call Flow</h3>
          <div class="step"><div class="step-num">1</div><div class="step-text">Call aati hai → Assistant greet karta hai Hinglish mein</div></div>
          <div class="step"><div class="step-num">2</div><div class="step-text">Caller apna naam aur maqsad bolta hai (30 sec recording)</div></div>
          <div class="step"><div class="step-num">3</div><div class="step-text">${CONFIG.WAIT_SECONDS} second wait → Aapka number dial hota hai</div></div>
          <div class="step"><div class="step-num">4</div><div class="step-text">Agar aapne attend kiya → Connected! Agar nahi → Voicemail record</div></div>
          <div class="step"><div class="step-num">5</div><div class="step-text">Transcript console mein print hoti hai (email bhi set kar sakte ho)</div></div>
        </div>

        <div class="card">
          <h3>🌐 Active Endpoints</h3>
          <div class="route"><span class="route-path">POST /incoming-call</span><span class="route-desc">Twilio webhook — call aane par</span><span class="badge">MAIN</span></div>
          <div class="route"><span class="route-path">POST /handle-recording</span><span class="route-desc">Recording ke baad logic</span></div>
          <div class="route"><span class="route-path">POST /call-result</span><span class="route-desc">Call connect hua ya nahi</span></div>
          <div class="route"><span class="route-path">POST /transcription</span><span class="route-desc">Speech to text transcript</span></div>
          <div class="route"><span class="route-path">GET /</span><span class="route-desc">Yeh dashboard</span></div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// ============================================
//   Server start karo
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   📞 CALL ASSISTANT SERVER READY     ║');
  console.log(`║   Port: ${PORT}                          ║`);
  console.log('║   Dashboard: http://localhost:3000   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('⚠️  CONFIG CHECK:');
  console.log(`   YOUR_PHONE:    ${CONFIG.YOUR_PHONE}`);
  console.log(`   TWILIO_NUMBER: ${CONFIG.TWILIO_NUMBER}`);
  console.log(`   WAIT_SECONDS:  ${CONFIG.WAIT_SECONDS}`);
  console.log('');
  if (CONFIG.YOUR_PHONE.includes('XXXX')) {
    console.log('⚠️  WARNING: server.js mein apna phone number set karo!');
  }
});
