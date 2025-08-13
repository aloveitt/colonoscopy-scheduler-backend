// server.js - Production Version
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI with your API key from environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here' // Will use environment variable in production
});

// CORS configuration for production
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-url.netlify.app'], // We'll update this later
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Colonoscopy Scheduler API is running!' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    console.log('Received message:', message);
    
    const systemPrompt = `You are a friendly, professional colonoscopy scheduling assistant for a hospital. 

SCHEDULING RULES:
- Appointments must be scheduled at least 3 days in advance
- Dr. LeMieur: Monday/Wednesday/Friday AM (7:30-12:00), 25 mins per procedure, max 6 per block
- Dr. Loveitt: Monday PM/Thursday AM/Friday AM (12:00-5:00 / 7:30-12:00 / 7:30-12:00), 20 mins per procedure, max 10 per block  
- Dr. Kelly: Tuesday PM/Wednesday PM/Friday PM (12:00-5:00), 20 mins per procedure, max 8 per block
- Dr. Roberts: Tuesday AM/Thursday PM/Friday PM (7:30-12:00 / 12:00-5:00 / 12:00-5:00), 15 mins per procedure, max 10 per block

CURRENT AVAILABLE APPOINTMENTS:
${JSON.stringify(context.availableDates, null, 2)}

BOOKING PROCESS:
1. Help them find appointments based on their preference (date, doctor, or next available)
2. Once they select an appointment, collect their full name, phone number, and email
3. Confirm all details before booking

CURRENT STATE:
- Booking step: ${context.currentStep}
- Patient info: ${JSON.stringify(context.patientInfo)}
- Selected appointment: ${JSON.stringify(context.selectedDate)}

Be conversational and helpful. When showing appointments, mention it's either AM (7:30-12:00) or PM (12:00-5:00) and that exact times are given the day before. If they select an appointment, guide them to collect their information.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the cheaper model for demo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    res.json({ 
      response: aiResponse,
      success: true
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Sorry, I had trouble processing that. Please try again.',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
