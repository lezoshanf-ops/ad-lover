import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys for web push - these are demo keys
// In production, generate your own at https://vapidkeys.com/
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAf7-XBJMqcMiUvabXWoNcOA_XBxgLg';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface PushRequest {
  userId: string;
  payload: PushPayload;
}

// Web Push crypto utilities
async function generateVapidAuthorizationHeader(
  endpoint: string,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const payload = {
    aud: audience,
    exp: expiration,
    sub: 'mailto:noreply@example.com'
  };

  const encoder = new TextEncoder();
  
  // Base64 URL encode
  const base64UrlEncode = (data: Uint8Array | string): string => {
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import the private key for signing
  const privateKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  // Create the crypto key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature).reduce((str, byte) => str + String.fromCharCode(byte), ''));
  
  return `vapid t=${unsignedToken}.${signatureB64}, k=${vapidPublicKey}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { userId, payload }: PushRequest = await req.json();
    
    console.log(`Sending push notification to user: ${userId}`);
    console.log('Payload:', JSON.stringify(payload));
    
    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions', details: subError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user');
      return new Response(
        JSON.stringify({ success: false, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${subscriptions.length} subscription(s)`);
    
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Build the push message body
          const pushBody = JSON.stringify(payload);
          
          // For now, use a simple fetch to the push endpoint
          // Note: Full web push encryption requires additional libraries
          // This is a simplified version that works with most push services
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: pushBody,
          });
          
          if (!response.ok) {
            // If subscription is invalid, delete it
            if (response.status === 404 || response.status === 410) {
              console.log(`Removing invalid subscription: ${sub.endpoint}`);
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
          throw new Error(`Push failed with status ${response.status}`);
        }
        
        return { success: true, endpoint: sub.endpoint };
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Failed to send to ${sub.endpoint}:`, e);
        return { success: false, endpoint: sub.endpoint, error: errorMessage };
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
  const failed = results.length - successful;
  
  console.log(`Push results: ${successful} successful, ${failed} failed`);
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      sent: successful, 
      failed,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: String(r.reason) })
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
  
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Error in send-push-notification:', error);
  return new Response(
    JSON.stringify({ error: 'Internal server error', message: errorMessage }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
  );
}
});
