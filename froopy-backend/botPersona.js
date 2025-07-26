// botPersona.js - Indian female persona generator

const indianFemaleNames = [
  'Priya', 'Neha', 'Shreya', 'Ananya', 'Divya', 
  'Pooja', 'Sakshi', 'Nidhi', 'Kavya', 'Riya',
  'Aditi', 'Isha', 'Tanvi', 'Meera', 'Simran',
  'Anjali', 'Deepika', 'Kritika', 'Pallavi', 'Swati'
];

const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai',
  'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'
];

const personalityTraits = [
  'slightly reserved but friendly',
  'casual and laid-back',
  'witty with dry humor',
  'friendly but takes time to open up',
  'straightforward and practical'
];

function generateBotPersona() {
  const name = indianFemaleNames[Math.floor(Math.random() * indianFemaleNames.length)];
  const age = 19 + Math.floor(Math.random() * 8); // 19-26 years
  const city = indianCities[Math.floor(Math.random() * indianCities.length)];
  const personality = personalityTraits[Math.floor(Math.random() * personalityTraits.length)];
  
  // Generate consistent username in coolpanda123 format
  const adjectives = ['cool', 'happy', 'sunny', 'crazy', 'sweet', 'wild', 'lazy', 'sleepy'];
  const nouns = ['panda', 'kitten', 'bunny', 'butterfly', 'unicorn', 'star', 'moon', 'cloud'];
  const username = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                  nouns[Math.floor(Math.random() * nouns.length)] + 
                  Math.floor(Math.random() * 1000);
  
  const persona = {
    id: 'bot_' + Date.now(), // Unique bot ID
    name: name,
    age: age,
    city: city,
    personality: personality,
    username: username,
    email: `${username}@froopy.bot`, // Fake email for consistency
    gender: 'female',
    isBot: true, // Internal flag, not shown to users
    avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=2563EB&shapeColor=2563EB`,
    createdAt: new Date().toISOString()
  };
  
  console.log('Generated bot persona:', persona);
  return persona;
}

module.exports = {
  generateBotPersona
};