// server.js - Secure Production Version
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI with environment variable (SECURE)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // This gets the key from Render's environment variables
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
    console.log('Available appointments count:', context.availableDates?.length || 0);
    
    const systemPrompt = `You are a friendly, professional colonoscopy scheduling assistant for a hospital. 

SCHEDULING RULES:
- Appointments must be scheduled at least 3 days in advance
- Dr. LeMieur: Monday/Wednesday/Friday AM (7:30-12:00), 25 mins per procedure, max 6 per block
- Dr. Loveitt: Monday PM/Thursday AM/Friday AM, 20 mins per procedure, max 10 per block  
- Dr. Kelly: Tuesday PM/Wednesday PM/Friday PM (12:00-5:00), 20 mins per procedure, max 8 per block
- Dr. Roberts: Tuesday AM/Thursday PM/Friday PM, 15 mins per procedure, max 10 per block

CURRENT AVAILABLE APPOINTMENTS:
${JSON.stringify(context.availableDates, null, 2)}

BOOKING PROCESS:
1. Help them find appointments based on their preference (date, doctor, or next available)
2. Once they select an appointment, collect their full name, phone number, and email
3. Confirm all details before booking

CURRENT CONVERSATION STATE:
- Booking step: ${context.currentStep}
- Patient info collected: ${JSON.stringify(context.patientInfo)}
- Selected appointment: ${JSON.stringify(context.selectedDate)}

RESPONSE GUIDELINES:
- Be conversational and helpful
- When showing appointments, mention it's either AM (7:30-12:00) or PM (12:00-5:00)
- Exact appointment times are given the day before the procedure
- If they ask for a specific date or doctor, check the available appointments list
- If they select an appointment, guide them to provide their information step by step
- Always mention the 3-day advance booking requirement if they ask for something too soon
- Keep responses concise but friendly

If the user is asking to book a specific appointment or wants to see appointments, make sure to reference the available appointments list provided above.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the more cost-effective model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    
    console.log('AI Response length:', aiResponse.length);
    
    res.json({ 
      response: aiResponse,
      success: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // More detailed error handling
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
