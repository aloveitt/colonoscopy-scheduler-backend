// server.js - Improved AI Logic
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI with environment variable (SECURE)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://*.netlify.app', 'https://*.onrender.com'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Colonoscopy Scheduler API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    console.log('Received message:', message);
    console.log('Current step:', context.currentStep);
    console.log('Patient info:', context.patientInfo);
    
    // Filter appointments based on user request
    let filteredDates = context.availableDates || [];
    
    // Check if user is asking for specific doctor
    const doctorKeywords = {
      'kelly': 'Dr. Kelly',
      'loveitt': 'Dr. Loveitt', 
      'lemieur': 'Dr. LeMieur',
      'roberts': 'Dr. Roberts'
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [keyword, doctorName] of Object.entries(doctorKeywords)) {
      if (lowerMessage.includes(keyword)) {
        filteredDates = filteredDates.filter(d => d.doctor === doctorName);
        break;
      }
    }
    
    // Check if user is asking for specific month
    if (lowerMessage.includes('september') || lowerMessage.includes('sept')) {
      filteredDates = filteredDates.filter(d => {
        const date = new Date(d.date);
        return date.getMonth() === 8; // September is month 8 (0-indexed)
      });
    }
    
    if (lowerMessage.includes('october') || lowerMessage.includes('oct')) {
      filteredDates = filteredDates.filter(d => {
        const date = new Date(d.date);
        return date.getMonth() === 9; // October is month 9
      });
    }
    
    // Check for time preferences
    if (lowerMessage.includes('morning') || lowerMessage.includes('am')) {
      filteredDates = filteredDates.filter(d => d.period === 'AM');
    }
    
    if (lowerMessage.includes('afternoon') || lowerMessage.includes('evening') || lowerMessage.includes('pm')) {
      filteredDates = filteredDates.filter(d => d.period === 'PM');
    }
    
    const systemPrompt = `You are a friendly, professional colonoscopy scheduling assistant for Cuyuna Regional Medical Center (CRMC) in Crosby, Minnesota. 

ABOUT CRMC:
- Located in the beautiful Cuyuna Lakes area of Central Minnesota
- Serves over 60,000 people in the Brainerd Lakes Area
- 25 operating beds with $120 million in net patient revenues
- Accredited by The Joint Commission and Commission on Cancer
- One of America's 100 Best Hospitals for Patient Experience
- Recognized for bringing innovation to Central Minnesota with top healthcare talent and advanced specialty procedures

COLONOSCOPY PROGRAM AT CRMC:
- Our experienced team of board-certified physicians provides expert colonoscopy services
- CRMC is home to the Minnesota Institute for Minimally Invasive Surgery (MIMIS)
- We are a leader in minimally invasive surgery with advanced endoscopy capabilities
- CRMC participates in Colon Cancer Awareness initiatives including #BlueForCRC
- Screening colonoscopies can prevent cancer by removing pre-cancerous polyps
- The American Cancer Society recommends screening at age 45 for average risk adults
- All procedures use propofol sedation for patient comfort
- Our physicians are trained in the latest techniques and committed to excellent patient care

SCHEDULING RULES:
- Appointments must be scheduled at least 3 days in advance for proper preparation
- Dr. LeMieur: Monday/Wednesday/Friday AM (7:30-12:00), 25 mins per procedure, max 6 per block
- Dr. Loveitt: Monday PM/Thursday AM/Friday AM, 20 mins per procedure, max 10 per block  
- Dr. Kelly: Tuesday PM/Wednesday PM/Friday PM (12:00-5:00), 20 mins per procedure, max 8 per block
- Dr. Roberts: Tuesday AM/Thursday PM/Friday PM, 15 mins per procedure, max 10 per block

CONTACT INFORMATION:
- Main Hospital: 320 E Main St, Crosby, MN 56441
- Phone: (218) 546-7000
- Scheduling Department: (218) 546-7000
- Website: cuyunamed.org
- We also have clinics in Baxter, Breezy Point, and Longville

FILTERED AVAILABLE APPOINTMENTS BASED ON USER REQUEST:
${JSON.stringify(filteredDates, null, 2)}

CURRENT CONVERSATION STATE:
- Booking step: ${context.currentStep}
- Patient info collected: ${JSON.stringify(context.patientInfo)}
- Selected appointment: ${JSON.stringify(context.selectedDate)}

IMPORTANT INSTRUCTIONS:
1. Always mention you're with Cuyuna Regional Medical Center
2. If asked about the facility, highlight our beautiful lake country location and excellent patient experience ratings
3. If discussing colonoscopy benefits, mention our experienced team of physicians and our minimally invasive surgery program
4. Reference that we serve the greater Brainerd Lakes Area
5. If user asks for a specific doctor, month, or time preference, ONLY show appointments that match their request
6. If the user has already provided their name, phone, and email, do NOT ask for this information again
7. Be conversational but professional - we pride ourselves on patient-centered care

CONVERSATION FLOW:
1. User asks for appointments → Show appropriate filtered appointments
2. User selects appointment → Collect missing info (name, phone, email) 
3. All info collected → Offer confirmation
4. User confirms → Appointment is booked

Represent CRMC's commitment to exceptional care and our community-focused approach.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    // Determine if we should show appointments
    let showAppointments = false;
    
    if (filteredDates.length > 0 && (
      aiResponse.toLowerCase().includes('available') ||
      aiResponse.toLowerCase().includes('appointments') ||
      aiResponse.toLowerCase().includes('here are') ||
      aiResponse.toLowerCase().includes('options')
    )) {
      showAppointments = true;
    }
    
    res.json({ 
      response: aiResponse,
      success: true,
      timestamp: new Date().toISOString(),
      showAppointments: showAppointments,
      filteredDates: showAppointments ? filteredDates : []
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    let errorMessage = 'Sorry, I had trouble processing that. Please try again.';
    
    if (error.code === 'invalid_api_key') {
      errorMessage = 'API configuration error. Please contact support.';
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.code === 'insufficient_quota') {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    success: false 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    success: false 
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/`);
  console.log(`API endpoint: http://localhost:${port}/api/chat`);
});
