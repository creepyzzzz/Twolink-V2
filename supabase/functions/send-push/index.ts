import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.id) {
      return new Response("Invalid payload", { status: 400 });
    }

    // Initialize Supabase Client to fetch tokens
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const chatId = record.chat_id;
    const senderId = record.sender_id;

    // 1. Get all members of the chat EXCEPT the sender
    const { data: members, error: membersError } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("chat_id", chatId)
      .neq("user_id", senderId);

    if (membersError || !members || members.length === 0) {
      return new Response("No recipients", { status: 200 });
    }

    const recipientIds = members.map((m) => m.user_id);

    // 2. Get push tokens for recipients
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", recipientIds);

    if (tokensError || !tokens || tokens.length === 0) {
      return new Response("No tokens found", { status: 200 });
    }

    // 3. Get sender info to format the message
    const { data: sender } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", senderId)
      .single();

    const senderName = sender?.display_name || "Someone";
    let bodyText = record.body;
    if (record.kind === "image") bodyText = "Sent a photo";
    if (record.kind === "document") bodyText = "Sent an attachment";
    if (record.kind === "video") bodyText = "Sent a video";

    // 4. Send to Expo Push API
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title: senderName,
      body: bodyText,
      data: { chatId, messageId: record.id },
    }));

    const expoRes = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoData = await expoRes.json();
    return new Response(JSON.stringify(expoData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
