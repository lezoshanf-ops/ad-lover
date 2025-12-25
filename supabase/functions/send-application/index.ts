import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApplicationRequest {
  name: string;
  email: string;
  phone?: string;
  startDate: string;
  salaryExpectation?: string;
  experience?: string;
  message: string;
  jobTitle: string;
  resumeBase64?: string;
  resumeFileName?: string;
  resumeContentType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ApplicationRequest = await req.json();
    console.log("Received application:", { name: data.name, email: data.email, jobTitle: data.jobTitle });

    const { 
      name, 
      email, 
      phone, 
      startDate, 
      salaryExpectation, 
      experience, 
      message, 
      jobTitle,
      resumeBase64,
      resumeFileName,
      resumeContentType
    } = data;

    // Build HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Neue Bewerbung: ${jobTitle}</h1>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold; width: 180px;">Name:</td>
            <td style="padding: 12px;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">E-Mail:</td>
            <td style="padding: 12px;"><a href="mailto:${email}">${email}</a></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold;">Telefon:</td>
            <td style="padding: 12px;">${phone || 'Nicht angegeben'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">Gewünschter Starttermin:</td>
            <td style="padding: 12px;">${startDate}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 12px; font-weight: bold;">Gehaltsvorstellung:</td>
            <td style="padding: 12px;">${salaryExpectation || 'Keine Angabe'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold;">Vorerfahrungen:</td>
            <td style="padding: 12px;">${experience || 'Keine Angabe'}</td>
          </tr>
        </table>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Bewerbungsnachricht:</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>
        
        ${resumeFileName ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 8px;">
          <p style="margin: 0;"><strong>📎 Lebenslauf:</strong> ${resumeFileName}</p>
        </div>
        ` : ''}
        
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Diese Bewerbung wurde über die Fritze IT Solutions Karriereseite gesendet.
        </p>
      </div>
    `;

    // Build attachments array for Resend API
    const attachments: Array<{ filename: string; content: string }> = [];
    if (resumeBase64 && resumeFileName) {
      attachments.push({
        filename: resumeFileName,
        content: resumeBase64
      });
    }

    // Send email to company using Resend API directly
    const emailPayload: Record<string, unknown> = {
      from: "Fritze IT Karriere <bewerbung@fritze-it.solutions>",
      to: ["bewerbung@fritze-it.solutions"],
      reply_to: email,
      subject: `Neue Bewerbung: ${jobTitle} - ${name}`,
      html: htmlContent,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent to company:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send email");
    }

    // Send confirmation email to applicant
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #007bff;">Vielen Dank für Ihre Bewerbung!</h1>
        
        <p>Hallo ${name},</p>
        
        <p>wir haben Ihre Bewerbung für die Stelle <strong>"${jobTitle}"</strong> erhalten und werden diese sorgfältig prüfen.</p>
        
        <p>Wir melden uns in Kürze bei Ihnen, um einen Termin für ein Bewerbungsgespräch zu vereinbaren.</p>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Ihre Bewerbungsdaten:</h3>
          <ul style="line-height: 1.8;">
            <li><strong>Position:</strong> ${jobTitle}</li>
            <li><strong>Gewünschter Starttermin:</strong> ${startDate}</li>
            ${resumeFileName ? `<li><strong>Lebenslauf:</strong> ${resumeFileName}</li>` : ''}
          </ul>
        </div>
        
        <p style="margin-top: 30px;">Mit freundlichen Grüßen,<br>Ihr Fritze IT Solutions Team</p>
        
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Fritze IT Solutions GmbH | bewerbung@fritze-it.solutions
        </p>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Fritze IT Karriere <bewerbung@fritze-it.solutions>",
        to: [email],
        subject: `Bewerbung erhalten: ${jobTitle}`,
        html: confirmationHtml,
      }),
    });

    console.log("Confirmation email sent to applicant");

    return new Response(
      JSON.stringify({ success: true, message: "Bewerbung erfolgreich gesendet" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-application function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);