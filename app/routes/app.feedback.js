import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import nodemailer from "nodemailer";

export const action = async ({ request }) => {
  // 1. Authenticate Admin
  await authenticate.admin(request);

  // Define your App Name here for the subject line
  const APP_NAME = "Jewelry Price Manager"; 

  try {
    const formData = await request.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const mobile = formData.get("mobile");
    const shop = formData.get("shop");
    const query = formData.get("query");

    // 2. Server-side validation
    if (!name || !email || !query || !shop) {
      return json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Configure Transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SUPPORT_EMAIL,
        pass: process.env.SUPPORT_EMAIL_PASSWORD, // Use App Password if 2FA is on
      },
    });

    // 4. Construct Polaris-styled HTML Email
    const polarisHtml = `
      <div style="background-color: #f1f2f3; font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 0 rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e1e3e5;">
          
          <!-- Header -->
          <div style="padding: 20px; border-bottom: 1px solid #e1e3e5; background-color: #f7f8f9;">
            <h2 style="margin: 0; font-size: 18px; color: #202223; font-weight: 600;">
              Feedback / Query
            </h2>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6d7175;">
              Received via ${APP_NAME} in-app form
            </p>
          </div>

          <!-- Content Body -->
          <div style="padding: 20px;">
            
            <!-- Store Section -->
            <div style="margin-bottom: 20px;">
              <p style="font-size: 12px; font-weight: 600; color: #6d7175; text-transform: uppercase; margin-bottom: 5px;">Store</p>
              <div style="font-size: 15px; color: #202223;">${shop}</div>
            </div>

            <!-- User Details Grid -->
            <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; vertical-align: top; padding-bottom: 15px;">
                  <p style="font-size: 12px; font-weight: 600; color: #6d7175; text-transform: uppercase; margin-bottom: 5px;">Contact Name</p>
                  <div style="font-size: 15px; color: #202223;">${name}</div>
                </td>
                <td style="width: 50%; vertical-align: top; padding-bottom: 15px;">
                  <p style="font-size: 12px; font-weight: 600; color: #6d7175; text-transform: uppercase; margin-bottom: 5px;">Reply To</p>
                  <a href="mailto:${email}" style="font-size: 15px; color: #008060; text-decoration: none;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; vertical-align: top;">
                  <p style="font-size: 12px; font-weight: 600; color: #6d7175; text-transform: uppercase; margin-bottom: 5px;">Mobile</p>
                  <div style="font-size: 15px; color: #202223;">${mobile || '<span style="color:#8c9196">Not provided</span>'}</div>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <div style="border-top: 1px solid #e1e3e5; margin: 10px 0 20px 0;"></div>

            <!-- Message Section -->
            <div>
              <p style="font-size: 12px; font-weight: 600; color: #6d7175; text-transform: uppercase; margin-bottom: 10px;">Message</p>
              <div style="background-color: #fafbfb; border: 1px solid #e1e3e5; border-radius: 4px; padding: 15px; font-size: 14px; line-height: 1.6; color: #202223;">
                ${query.replace(/\n/g, "<br/>")}
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color: #fafbfb; padding: 15px 20px; border-top: 1px solid #e1e3e5; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #8c9196;">
              Sent from the ${APP_NAME} dashboard.
            </p>
          </div>
        </div>
      </div>
    `;

    // 5. Send Email
    await transporter.sendMail({
      from: `"${APP_NAME} Support" <${process.env.SUPPORT_EMAIL}>`,
      to: process.env.SUPPORT_EMAIL, 
      replyTo: email,
      subject: `New Feedback Received from ${APP_NAME} [${shop}]`, // Dynamic Subject
      html: polarisHtml,
    });

    return json({ success: true });

  } catch (error) {
    console.error("Feedback email error:", error);
    return json(
      { success: false, message: "Failed to send feedback email" },
      { status: 500 }
    );
  }
};