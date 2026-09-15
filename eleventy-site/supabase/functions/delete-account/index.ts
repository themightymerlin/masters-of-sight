// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://mastersofsight.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return Response.json(
      { error: "Missing Authorization header" },
      { status: 401, headers: corsHeaders },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401, headers: corsHeaders },
    );
  }

  const userId = userData.user.id;

  const { error: deleteSavedError } = await supabase
    .from("saved_masters")
    .delete()
    .eq("user_id", userId);

  if (deleteSavedError) {
    return Response.json(
      { error: `Failed to delete saved masters: ${deleteSavedError.message}` },
      { status: 500, headers: corsHeaders },
    );
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return Response.json(
      { error: `Failed to delete user account: ${deleteUserError.message}` },
      { status: 500, headers: corsHeaders },
    );
  }

  return Response.json(
    { message: "Account deleted successfully" },
    { status: 200, headers: corsHeaders },
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/delete-account' \
    --header 'Authorization: Bearer <user-jwt>' \
    --header 'Content-Type: application/json'

*/
