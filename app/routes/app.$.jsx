import { Page, EmptyState, Layout } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export default function NotFound() {
    return (
        <Page>
            <Layout>
                <Layout.Section>
                    <EmptyState
                        heading="Page not found"
                        action={{ content: 'Return to Home', url: '/app' }}
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                        <p>The page you are looking for does not exist.</p>
                    </EmptyState>
                </Layout.Section>
            </Layout>
        </Page>
    );
}