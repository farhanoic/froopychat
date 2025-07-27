// supabase/functions/bot-match/index.ts - Bot Matching Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Bot profile generation functions
const generateBotProfile = () => {
  const indianFemaleNames = [
    'Priya', 'Neha', 'Kavya', 'Ananya', 'Shreya', 'Pooja', 'Divya', 'Riya', 
    'Meera', 'Sneha', 'Aditi', 'Nisha', 'Swati', 'Ritika', 'Sakshi'
  ];
  
  const cities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 
    'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Surat'
  ];
  
  const interests = [
    'movies', 'music', 'books', 'travel', 'cooking', 'dancing', 'photography', 
    'art', 'yoga', 'fitness', 'technology', 'fashion', 'cricket', 'bollywood'
  ];
  
  const name = indianFemaleNames[Math.floor(Math.random() * indianFemaleNames.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const userInterests = interests
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.floor(Math.random() * 3) + 2)
    .join(', ');
  
  return {
    username: `${name.toLowerCase()}${Math.floor(Math.random() * 999) + 100}`,
    displayName: name,
    city: city,
    interests: userInterests,
    personality: 'friendly',
    responseStyle: 'casual',
    language: 'hinglish' // Hindi + English mix
  };
};

// Generate natural conversation starters
const generateConversationStarter = (userProfile: any, botProfile: any) => {
  const starters = [
    `Hi! I'm ${botProfile.displayName} from ${botProfile.city} 👋`,
    `Hey there! Nice to meet you! I'm ${botProfile.displayName} 😊`,
    `Hello! I'm ${botProfile.displayName}. How's your day going? ✨`,
    `Hi! ${botProfile.displayName} here from ${botProfile.city}. What brings you to chat today? 💬`,
    `Hey! I'm ${botProfile.displayName}. Love chatting with new people! 🌟`
  ];
  
  return starters[Math.floor(Math.random() * starters.length)];
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🤖 Bot matching function triggered');

    // Check for users waiting longer than 60 seconds (1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    console.log('⏰ Checking for users waiting since:', oneMinuteAgo);
    
    const { data: waitingUsers, error: waitingError } = await supabase
      .from('waiting_pool')
      .select('*')
      .lt('created_at', oneMinuteAgo)
      .limit(5); // Process up to 5 users at once

    if (waitingError) {
      console.error('Error fetching waiting users:', waitingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch waiting users' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`👥 Found ${waitingUsers?.length || 0} users waiting for >60 seconds`);

    if (!waitingUsers || waitingUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users waiting for bot match', processed: 0 }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let processedCount = 0;

    // Process each waiting user
    for (const user of waitingUsers) {
      try {
        console.log(`🎯 Processing bot match for user: ${user.user_id}`);
        
        // Generate bot profile
        const botProfile = generateBotProfile();
        console.log('🤖 Generated bot profile:', botProfile);
        
        // Remove user from waiting pool first
        const { error: removeError } = await supabase
          .from('waiting_pool')
          .delete()
          .eq('user_id', user.user_id);

        if (removeError) {
          console.error('Error removing user from waiting pool:', removeError);
          continue;
        }

        // Create special bot match
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert({
            user1_id: user.user_id,
            user2_id: botId, // Special bot ID
            is_bot: true,
            bot_profile: botProfile,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (matchError) {
          console.error('Error creating bot match:', matchError);
          continue;
        }

        console.log('✅ Bot match created:', matchData);

        // Generate and send initial bot message
        const conversationStarter = generateConversationStarter(user.preferences, botProfile);
        
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            match_id: matchData.id,
            sender_id: botId,
            content: conversationStarter,
            is_bot: true,
            created_at: new Date().toISOString()
          });

        if (messageError) {
          console.error('Error sending bot welcome message:', messageError);
        } else {
          console.log('💬 Bot welcome message sent');
        }

        processedCount++;
        
        // Add small delay between processing users to avoid overwhelming the system
        if (waitingUsers.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        continue;
      }
    }

    console.log(`🎉 Bot matching complete. Processed: ${processedCount} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bot matching complete`, 
        processed: processedCount,
        timestamp: new Date().toISOString()
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Bot matching function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})

/* 
Usage Notes:
- This Edge Function should be called periodically (every 30-60 seconds) via a cron job or scheduled task
- It checks for users waiting >60 seconds and creates bot matches
- Bots have Indian female personas with realistic profiles
- Initial conversation starters are generated automatically
- Bot matches are marked with is_bot: true for easy identification
- The function processes up to 5 users at once to avoid performance issues

Deployment:
supabase functions deploy bot-match

Testing:
curl -X POST https://your-project.supabase.co/functions/v1/bot-match \
  -H "Authorization: Bearer YOUR_ANON_KEY"
*/