import { createClient } from 'npm:@supabase/supabase-js@2';

type CreateCareCircleRequest = {
  patientDisplayName?: string;
  relationshipToPatient?: string;
  preferredLanguageCode?: string;
  patientTimezone?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentication is required.' }), { status: 401, headers: jsonHeaders });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Service configuration is unavailable.' }), { status: 500, headers: jsonHeaders });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Authentication is required.' }), { status: 401, headers: jsonHeaders });
  }

  const body = (await request.json()) as CreateCareCircleRequest;
  const patientDisplayName = body.patientDisplayName?.trim() ?? '';
  const relationshipToPatient = body.relationshipToPatient?.trim() ?? '';
  if (!patientDisplayName || !relationshipToPatient) {
    return new Response(JSON.stringify({ error: 'Patient name and relationship are required.' }), { status: 400, headers: jsonHeaders });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey);
  const { data: existingLinks, error: existingLinksError } = await adminClient
    .from('patient_guardians')
    .select('patient_id')
    .eq('guardian_id', userData.user.id)
    .eq('status', 'active')
    .limit(1);
  if (existingLinksError) {
    return new Response(JSON.stringify({ error: 'Could not verify the care circle.' }), { status: 500, headers: jsonHeaders });
  }
  if (existingLinks.length) {
    return new Response(JSON.stringify({ patientId: existingLinks[0].patient_id, existing: true }), { headers: jsonHeaders });
  }

  const { data: patientId, error: createError } = await adminClient.rpc('server_create_patient_care_circle', {
    guardian_user_id: userData.user.id,
    patient_display_name: patientDisplayName,
    relationship_to_patient: relationshipToPatient,
    preferred_language_code: body.preferredLanguageCode?.trim() || 'en',
    patient_timezone: body.patientTimezone?.trim() || 'Asia/Kolkata',
  });
  if (createError) {
    return new Response(JSON.stringify({ error: 'Could not create the care circle.' }), { status: 500, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ patientId, existing: false }), { status: 201, headers: jsonHeaders });
});
