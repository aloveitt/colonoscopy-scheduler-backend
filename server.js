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
  origin: [
    'http://localhost:3000', 
    'https://peaceful-khapse-24ced0.netlify.app',  // Your actual Netlify URL
    'https://*.netlify.app',
    'https://*.onrender.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

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
    
    const systemPrompt = `You are a friendly, professional colonoscopy scheduling assistant for a hospital. 

SCHEDULING RULES:
- Appointments must be scheduled at least 3 days in advance
- Dr. LeMieur: Monday/Wednesday/Friday AM (7:30-12:00), 25 mins per procedure, max 6 per block
- Dr. Loveitt: Monday PM/Thursday AM/Friday AM, 20 mins per procedure, max 10 per block  
- Dr. Kelly: Tuesday PM/Wednesday PM/Friday PM (12:00-5:00), 20 mins per procedure, max 8 per block
- Dr. Roberts: Tuesday AM/Thursday PM/Friday PM, 15 mins per procedure, max 10 per block

FILTERED AVAILABLE APPOINTMENTS BASED ON USER REQUEST:
${JSON.stringify(filteredDates, null, 2)}

CURRENT CONVERSATION STATE:
- Booking step: ${context.currentStep}
- Patient info collected: ${JSON.stringify(context.patientInfo)}
- Selected appointment: ${JSON.stringify(context.selectedDate)}

IMPORTANT INSTRUCTIONS:
1. If the user asks for a specific doctor, month, or time preference, ONLY show appointments that match their request
2. If user asks for September and there are September appointments in the filtered list, show them
3. If the user has already provided their name, phone, and email, do NOT ask for this information again
4. If they have selected an appointment and provided all info, offer to confirm the booking
5. Be direct and helpful - don't repeat questions unnecessarily

CONVERSATION FLOW:
1. User asks for appointments → Show appropriate filtered appointments
2. User selects appointment → Collect missing info (name, phone, email) 
3. All info collected → Offer confirmation
4. User confirms → Appointment is booked

Be conversational but efficient. If the user has given you what you need, move to the next step.`;

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
