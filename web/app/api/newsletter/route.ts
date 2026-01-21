import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // TODO: Implement actual newsletter subscription
    // This could integrate with:
    // - A newsletter_subscribers table in Supabase
    // - An email service like Mailchimp, ConvertKit, etc.
    // - A simple email collection system

    // For now, log the subscription attempt and return success
    console.log(`Newsletter subscription: ${email.toLowerCase().trim()}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
