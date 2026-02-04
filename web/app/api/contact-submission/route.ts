import { checkBodySize, isValidString, isValidUrl } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { Resend } from "resend";

// Lazy-initialize Resend to avoid build-time errors
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

type SubmissionType = "event" | "organization";

interface EventSubmission {
  type: "event";
  eventName: string;
  date: string;
  venueLocation: string;
  description?: string;
  email: string;
  website?: string;
}

interface OrgSubmission {
  type: "organization";
  orgName: string;
  orgType?: string;
  description?: string;
  email: string;
  website?: string;
}

type SubmissionData = EventSubmission | OrgSubmission;

function validateEventSubmission(data: unknown): { valid: true; data: EventSubmission } | { valid: false; error: string } {
  const d = data as Record<string, unknown>;

  if (!isValidString(d.eventName, 1, 200)) {
    return { valid: false, error: "Event name is required (max 200 characters)" };
  }
  if (!isValidString(d.date, 1, 100)) {
    return { valid: false, error: "Date is required" };
  }
  if (!isValidString(d.venueLocation, 1, 300)) {
    return { valid: false, error: "Venue/Location is required (max 300 characters)" };
  }
  if (!isValidString(d.email, 3, 255) || !d.email.includes("@")) {
    return { valid: false, error: "Valid email is required" };
  }
  if (d.description && !isValidString(d.description, 0, 2000)) {
    return { valid: false, error: "Description too long (max 2000 characters)" };
  }
  if (d.website && typeof d.website === "string" && d.website.trim() && !isValidUrl(d.website)) {
    return { valid: false, error: "Invalid website URL" };
  }

  return {
    valid: true,
    data: {
      type: "event",
      eventName: d.eventName as string,
      date: d.date as string,
      venueLocation: d.venueLocation as string,
      description: d.description as string | undefined,
      email: (d.email as string).toLowerCase().trim(),
      website: d.website as string | undefined,
    },
  };
}

function validateOrgSubmission(data: unknown): { valid: true; data: OrgSubmission } | { valid: false; error: string } {
  const d = data as Record<string, unknown>;

  if (!isValidString(d.orgName, 1, 200)) {
    return { valid: false, error: "Organization name is required (max 200 characters)" };
  }
  if (!isValidString(d.email, 3, 255) || !d.email.includes("@")) {
    return { valid: false, error: "Valid email is required" };
  }
  if (d.orgType && !isValidString(d.orgType, 0, 100)) {
    return { valid: false, error: "Organization type too long (max 100 characters)" };
  }
  if (d.description && !isValidString(d.description, 0, 2000)) {
    return { valid: false, error: "Description too long (max 2000 characters)" };
  }
  if (d.website && typeof d.website === "string" && d.website.trim() && !isValidUrl(d.website)) {
    return { valid: false, error: "Invalid website URL" };
  }

  return {
    valid: true,
    data: {
      type: "organization",
      orgName: d.orgName as string,
      orgType: d.orgType as string | undefined,
      description: d.description as string | undefined,
      email: (d.email as string).toLowerCase().trim(),
      website: d.website as string | undefined,
    },
  };
}

function formatEventEmail(data: EventSubmission): { subject: string; text: string; html: string } {
  const subject = `[Lost City] Event Submission: ${data.eventName}`;

  const text = `
New Event Submission

Event Name: ${data.eventName}
Date: ${data.date}
Venue/Location: ${data.venueLocation}
${data.description ? `Description: ${data.description}` : ""}
${data.website ? `Website: ${data.website}` : ""}

Submitter Email: ${data.email}
`.trim();

  const html = `
<h2>New Event Submission</h2>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr><td style="padding: 8px; font-weight: bold;">Event Name:</td><td style="padding: 8px;">${escapeHtml(data.eventName)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${escapeHtml(data.date)}</td></tr>
  <tr><td style="padding: 8px; font-weight: bold;">Venue/Location:</td><td style="padding: 8px;">${escapeHtml(data.venueLocation)}</td></tr>
  ${data.description ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Description:</td><td style="padding: 8px;">${escapeHtml(data.description)}</td></tr>` : ""}
  ${data.website ? `<tr><td style="padding: 8px; font-weight: bold;">Website:</td><td style="padding: 8px;"><a href="${escapeHtml(data.website)}">${escapeHtml(data.website)}</a></td></tr>` : ""}
</table>
<p><strong>Submitter Email:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
<p style="color: #666; font-size: 12px; margin-top: 20px;">Reply directly to this email to contact the submitter.</p>
`.trim();

  return { subject, text, html };
}

function formatOrgEmail(data: OrgSubmission): { subject: string; text: string; html: string } {
  const subject = `[Lost City] Organization Submission: ${data.orgName}`;

  const text = `
New Organization Submission

Organization Name: ${data.orgName}
${data.orgType ? `Type: ${data.orgType}` : ""}
${data.description ? `Description: ${data.description}` : ""}
${data.website ? `Website: ${data.website}` : ""}

Submitter Email: ${data.email}
`.trim();

  const html = `
<h2>New Organization Submission</h2>
<table style="border-collapse: collapse; margin: 20px 0;">
  <tr><td style="padding: 8px; font-weight: bold;">Organization Name:</td><td style="padding: 8px;">${escapeHtml(data.orgName)}</td></tr>
  ${data.orgType ? `<tr><td style="padding: 8px; font-weight: bold;">Type:</td><td style="padding: 8px;">${escapeHtml(data.orgType)}</td></tr>` : ""}
  ${data.description ? `<tr><td style="padding: 8px; font-weight: bold; vertical-align: top;">Description:</td><td style="padding: 8px;">${escapeHtml(data.description)}</td></tr>` : ""}
  ${data.website ? `<tr><td style="padding: 8px; font-weight: bold;">Website:</td><td style="padding: 8px;"><a href="${escapeHtml(data.website)}">${escapeHtml(data.website)}</a></td></tr>` : ""}
</table>
<p><strong>Submitter Email:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
<p style="color: #666; font-size: 12px; margin-top: 20px;">Reply directly to this email to contact the submitter.</p>
`.trim();

  return { subject, text, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function POST(request: Request) {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Rate limit to prevent abuse (10/min, same as auth)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const submissionType = body.type as SubmissionType;

    if (submissionType !== "event" && submissionType !== "organization") {
      return NextResponse.json(
        { error: "Invalid submission type" },
        { status: 400 }
      );
    }

    let validatedData: SubmissionData;

    if (submissionType === "event") {
      const validation = validateEventSubmission(body);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      validatedData = validation.data;
    } else {
      const validation = validateOrgSubmission(body);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      validatedData = validation.data;
    }

    // Format email content
    const emailContent = validatedData.type === "event"
      ? formatEventEmail(validatedData)
      : formatOrgEmail(validatedData);

    // Send email via Resend
    const { error: emailError } = await getResend().emails.send({
      from: "Lost City <noreply@lostcity.ai>",
      to: "coach@lostcity.ai",
      replyTo: validatedData.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (emailError) {
      logger.error("Contact submission email error:", emailError);
      return NextResponse.json(
        { error: "Failed to send submission. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Contact submission error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
