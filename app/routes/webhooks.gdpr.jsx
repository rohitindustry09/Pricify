import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
    // 1. Validate the webhook request.
    // This function AUTOMATICALLY checks the HMAC signature.
    // If the signature is wrong, it throws a 401 error, preventing the security risk.
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    // 2. Handle the mandatory GDPR topics
    switch (topic) {
        case "CUSTOMERS_DATA_REQUEST":
            console.log(`[GDPR] Customer Data Request for ${shop}`);
            // If you store customer data, you must email it to the merchant here.
            break;

        case "CUSTOMERS_REDACT":
            console.log(`[GDPR] Customer Redact Request for ${shop}`);
            // If you store customer data, delete it here.
            break;

        case "SHOP_REDACT":
            console.log(`[GDPR] Shop Redact Request for ${shop}`);
            // If you store shop data, delete it here (usually 48h after uninstall).
            break;

        default:
            // Handle other topics if you route them here
            break;
    }

    return json({ success: true }, { status: 200 });
};
