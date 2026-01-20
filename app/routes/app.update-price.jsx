// app/routes/app.breakdown.jsx

import { useLoaderData, useFetcher, Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Modal,
  TextField,
  FormLayout,
  Toast,
  Frame,
  Grid,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  Icon,
} from "@shopify/polaris";
import {
  EditIcon,
  AlertCircleIcon,
  CheckIcon,
} from "@shopify/polaris-icons";
import shopify from "../shopify.server";
import {
  calculatePriceFromRate,
  summarizeSelectedCollections,
  parseWeightFromOptions,
} from "../utils/jewelry-pricing";

export const meta = () => [{ title: "Jewelry Price Manager" }];

/**
 * THEME HELPER
 */
function getThemeStyles(title) {
  const t = title.toLowerCase();

  const base = {
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    height: "100%",
    position: "relative"
  };

  if (t.includes("24k") || t.includes("gold")) {
    return { ...base, background: "#fef3c7", borderColor: "#fbbf24", color: "#451a03" };
  }
  if (t.includes("silver") || t.includes("925")) {
    return { ...base, background: "#f3f4f6", borderColor: "#d4d4d8", color: "#1f2937" };
  }
  if (t.includes("platinum") || t.includes("pt")) {
    return { ...base, background: "#e5e7eb", borderColor: "#cbd5f5", color: "#1e1b4b" };
  }
  if (t.includes("diamond")) {
    return { ...base, background: "#e0f2fe", borderColor: "#93c5fd", color: "#0c4a6e" };
  }

  // Neutral/Default
  return { ...base, background: "#fef9c3", borderColor: "#e5e7eb", color: "#111827" };
}

// Loader
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query CollectionsWithProducts {
        collections(first: 50) {
          edges {
            node {
              id
              title
              handle
              products(first: 50) {
                edges {
                  node {
                    id
                    title
                    handle
                    status
                    variants(first: 50) {
                      edges {
                        node {
                          id
                          title
                          price
                          selectedOptions { name value }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
  );
  const body = await response.json();
  const collections = body.data?.collections?.edges?.map(({ node }) => {
    const products = node.products?.edges?.flatMap(({ node: p }) => {
      const variants = p.variants?.edges ?? [];
      if (variants.length === 0) return [];
      return variants.map(({ node: v }) => {
        const basePrice = Number(v?.price ?? 0);
        const weightGrams = parseWeightFromOptions(v?.selectedOptions ?? []);
        return {
          id: `${p.id}::${v.id}`,
          productId: p.id,
          variantId: v.id,
          title: p.title,
          variantTitle: v.title,
          basePrice,
          weightGrams,
        };
      });
    }) ?? [];
    return { id: node.id, title: node.title, products };
  }) ?? [];
  return { collections };
}

export default function UpdatePrice() {
  const { collections } = useLoaderData();
  const fetcher = useFetcher();
  const isUpdating = fetcher.state !== "idle";

  // State
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionDone, setSelectionDone] = useState(false);
  const [pricing, setPricing] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("jpm_pricing");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [modalCollectionId, setModalCollectionId] = useState(null);
  const [modalRate, setModalRate] = useState("0");
  const [modalPercent, setModalPercent] = useState("0");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [toast, setToast] = useState(null);

  // Computed
  const selectedCollections = useMemo(
    () => collections.filter((c) => selectedIds.includes(c.id)),
    [collections, selectedIds]
  );
  const stats = useMemo(() => summarizeSelectedCollections(selectedCollections), [selectedCollections]);
  const invalidCollections = useMemo(() => selectedCollections.filter(c => {
    const conf = pricing[c.id];
    return !conf || !(conf.ratePerGram > 0);
  }), [selectedCollections, pricing]);
  const hasInvalidPricing = invalidCollections.length > 0;

  // Helper: Check if all collections are selected
  const allSelected = collections.length > 0 && selectedIds.length === collections.length;

  // Effects
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("jpm_pricing", JSON.stringify(pricing));
    }
  }, [pricing]);

  useEffect(() => {
    setPricing((prev) => {
      const next = { ...prev };
      collections.forEach((c) => {
        if (!next[c.id]) next[c.id] = { ratePerGram: 0, percent: 0 };
      });
      return next;
    });
  }, [collections]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        setToast({ error: false, message: `Successfully updated ${fetcher.data.updated} variants.` });
      } else {
        setToast({ error: true, message: "Failed to update some prices." });
      }
      setLastUpdated(new Date());
    }
  }, [fetcher.state, fetcher.data]);

  // Actions
  const toggleCollection = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
    // Note: We don't auto-reset selectionDone here anymore to allow "Re-select" mode to feel deliberate
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(collections.map(c => c.id));
    }
  };

  const handleSelectionDone = () => {
    if (selectedIds.length === 0) setToast({ error: true, message: "Select a collection first." });
    else setSelectionDone(true);
  };

  const handleReselect = () => {
    setSelectionDone(false);
  };

  const openModal = (id) => {
    setModalCollectionId(id);
    const curr = pricing[id] ?? { ratePerGram: 0, percent: 0 };
    setModalRate(String(curr.ratePerGram));
    setModalPercent(String(curr.percent));
  };

  const handleSavePricing = () => {
    const rate = Number(modalRate);
    if (!rate || rate <= 0) {
      setToast({ error: true, message: "Enter a valid positive rate." });
      return;
    }
    setPricing(prev => ({ ...prev, [modalCollectionId]: { ratePerGram: rate, percent: Number(modalPercent) } }));
    setModalCollectionId(null);
  };

  const handleApplyPrices = () => {
    const changes = [];
    selectedCollections.forEach(col => {
      const { ratePerGram, percent } = pricing[col.id];
      col.products.forEach(prod => {
        if (!prod.weightGrams) return;
        const newPrice = calculatePriceFromRate(prod.weightGrams, ratePerGram, percent);
        if (Math.abs(newPrice - prod.basePrice) > 0.01) {
          changes.push({ productId: prod.productId, variantId: prod.variantId, newPrice });
        }
      });
    });

    if (changes.length === 0) return setToast({ error: false, message: "No price changes detected." });
    fetcher.submit({ changes: JSON.stringify(changes) }, { method: "post", action: "/app/update-prices" });
  };

  // Prepare table rows
  const tableRows = selectedCollections.flatMap(col => {
    const { ratePerGram, percent } = pricing[col.id];
    const groups = {};
    col.products.forEach(p => {
      const key = `${p.productId}-${p.weightGrams}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    return Object.values(groups).flatMap((groupVariants, groupIdx) => {
      const first = groupVariants[0];
      const newPrice = first.weightGrams
        ? calculatePriceFromRate(first.weightGrams, ratePerGram, percent)
        : first.basePrice;

      return groupVariants.map((v, idx) => (
        <IndexTable.Row key={`${col.id}-${v.variantId}`} id={v.variantId} position={idx}>
          <IndexTable.Cell>
            {idx === 0 ? (
              <Text fontWeight="bold" as="span">
                {v.title} {v.weightGrams ? `(${v.weightGrams}g)` : ''}
              </Text>
            ) : null}
            <div style={{ paddingLeft: idx === 0 ? 0 : '16px', color: '#6b7280', fontSize: '13px' }}>
              {idx > 0 && "↳ "}{v.variantTitle === 'Default Title' ? 'Standard' : v.variantTitle}
            </div>
          </IndexTable.Cell>
          <IndexTable.Cell>{col.title}</IndexTable.Cell>
          <IndexTable.Cell>{v.weightGrams ? `${v.weightGrams}g` : '—'}</IndexTable.Cell>
          <IndexTable.Cell>₹{ratePerGram}/g</IndexTable.Cell>
          <IndexTable.Cell>{percent > 0 ? `+${percent}%` : `${percent}%`}</IndexTable.Cell>
          <IndexTable.Cell>₹{v.basePrice.toLocaleString()}</IndexTable.Cell>
          <IndexTable.Cell>
            <Text fontWeight="bold" tone="success">₹{newPrice.toLocaleString()}</Text>
          </IndexTable.Cell>
        </IndexTable.Row>
      ));
    });
  });

  return (
    <Frame>
      <Page fullWidth>

        <Layout>
          {/* 1. CUSTOM HEADER: Gradient Background */}
          <Layout.Section>
            <div
              style={{
                border: "1px solid #000000",
                background: "#ffffff",
                borderRadius: "12px",
                padding: "40px 20px",
                textAlign: "center",
                marginBottom: "20px",
                boxShadow: "0px 4px 6px rgba(0,0,0,0.1)",
              }}
            >
              <BlockStack gap="200">
                <Text as="h1" variant="heading2xl">
                  Jewellery Price Manager
                </Text>
                <Text as="p" variant="bodyLg">
                  The command center for automating your daily gold and silver pricing updates.
                </Text>
              </BlockStack>
            </div>
          </Layout.Section>

          {/* 2. Collection Selector */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="headingMd" as="h2">Select Collections</Text>
                    <Text variant="bodySm" tone="subdued">Choose collections to manage rates</Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    {/* 
                           BUTTON LOGIC:
                           1. Select All is disabled when Done is true.
                           2. Done button toggles between "Done" (Primary) and "Re-select" (Secondary/Normal)
                        */}
                    <Button variant="plain" onClick={toggleSelectAll} disabled={selectionDone}>
                      {allSelected ? "Deselect All" : "Select All"}
                    </Button>
                    <Button
                      variant={selectionDone ? "secondary" : "primary"}
                      onClick={selectionDone ? handleReselect : handleSelectionDone}
                      disabled={selectedIds.length === 0}
                    >
                      {selectionDone ? "Re-select" : "Done"}
                    </Button>
                  </InlineStack>
                </InlineStack>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {collections.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <div key={c.id} style={{ opacity: selectionDone && !isSelected ? 0.5 : 1 }}>
                        <Button
                          size="slim"
                          variant={isSelected ? "primary" : "secondary"}
                          onClick={() => !selectionDone && toggleCollection(c.id)}
                          disabled={selectionDone}
                          icon={isSelected ? CheckIcon : undefined}
                        >
                          {c.title}
                        </Button>
                      </div>
                    )
                  })}
                </div>

                {/* 
                   ANIMATED BOTTOM TEXT
                */}
                <div className={`fade-message ${selectedIds.length > 0 ? "hidden" : ""}`}>
                  <Text tone="subdued" alignment="center">Please select at least one collection to begin.</Text>
                </div>

              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 3. Rate Cards Section */}
          {selectionDone && selectedIds.length > 0 && (
            <Layout.Section>
              <div style={{ marginBottom: '20px' }}>
                <Text variant="headingMd" as="h2">Set Metal Rates</Text>
                <Text tone="subdued">Click a card to update rate & markup</Text>
              </div>

              <Grid>
                {selectedCollections.map((c) => {
                  const style = getThemeStyles(c.title);
                  const conf = pricing[c.id];
                  const isInvalid = !conf || conf.ratePerGram <= 0;

                  const finalStyle = isInvalid
                    ? { ...style, background: '#fee2e2', borderColor: '#ef4444', color: '#b91c1c' }
                    : style;

                  return (
                    <Grid.Cell key={c.id} columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openModal(c.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openModal(c.id)}
                        style={finalStyle}
                        className="hover-scale"
                      >
                        <BlockStack gap="200">
                          <InlineStack align="space-between">
                            <Text variant="headingSm" as="h3">{c.title}</Text>
                            <div style={{
                              background: 'rgba(255,255,255,0.5)',
                              borderRadius: '50%',
                              padding: '4px'
                            }}>
                              <Icon source={EditIcon} tone="base" />
                            </div>
                          </InlineStack>

                          <div>
                            <Text variant="headingXl" as="p">
                              ₹{conf?.ratePerGram || 0}
                              <span style={{ fontSize: '14px', fontWeight: 'normal', opacity: 0.7 }}>/g</span>
                            </Text>
                          </div>

                          <InlineStack align="space-between">
                            <Text variant="bodySm">Markup:</Text>
                            <Badge tone={isInvalid ? 'critical' : 'info'}>
                              {conf?.percent > 0 ? '+' : ''}{conf?.percent}%
                            </Badge>
                          </InlineStack>

                          {isInvalid && (
                            <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                              <InlineStack gap="100" align="start">
                                <Icon source={AlertCircleIcon} tone="critical" />
                                <Text variant="bodyxs" tone="critical">Set rate to enable updates</Text>
                              </InlineStack>
                            </div>
                          )}
                        </BlockStack>
                      </div>
                    </Grid.Cell>
                  );
                })}
              </Grid>
            </Layout.Section>
          )}

          {/* 4. Table Section */}
          {selectionDone && selectedIds.length > 0 && (
            <Layout.Section>
              <Card padding="0">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e1e3e5' }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text variant="headingMd">Price Preview</Text>
                      <Text tone="subdued" variant="bodySm">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                      </Text>
                    </BlockStack>
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleApplyPrices}
                      loading={isUpdating}
                      disabled={hasInvalidPricing || stats.totalProducts === 0}
                    >
                      Update Prices
                    </Button>
                  </InlineStack>
                </div>

                {stats.totalProducts > 0 ? (
                  <IndexTable
                    resourceName={{ singular: 'variant', plural: 'variants' }}
                    itemCount={tableRows.length}
                    headings={[
                      { title: 'Product' },
                      { title: 'Collection' },
                      { title: 'Weight' },
                      { title: 'Rate' },
                      { title: 'Markup' },
                      { title: 'Current' },
                      { title: 'New Price' },
                    ]}
                    selectable={false}
                  >
                    {tableRows}
                  </IndexTable>
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <Text tone="subdued">No variants found in selected collections.</Text>
                  </div>
                )}
              </Card>
              <div style={{ height: '50px' }}></div>
            </Layout.Section>
          )}
        </Layout>

        {/* Modal for Pricing */}
        <Modal
          open={!!modalCollectionId}
          onClose={() => setModalCollectionId(null)}
          title="Configure Pricing"
          primaryAction={{ content: 'Save', onAction: handleSavePricing }}
          secondaryAction={{ content: 'Cancel', onAction: () => setModalCollectionId(null) }}
        >
          <Modal.Section>
            <FormLayout>
              <Text>
                Setting rates for <strong>{collections.find(c => c.id === modalCollectionId)?.title}</strong>
              </Text>
              <FormLayout.Group>
                <TextField
                  label="Rate per gram (₹)"
                  type="number"
                  value={modalRate}
                  onChange={setModalRate}
                  autoComplete="off"
                  prefix="₹"
                />
                <TextField
                  label="Markup / Increment (%)"
                  type="number"
                  value={modalPercent}
                  onChange={setModalPercent}
                  autoComplete="off"
                  suffix="%"
                  helpText="Example: 10% adds 10% on top of calculated gold value."
                />
              </FormLayout.Group>
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Toast */}
        {toast && (
          <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />
        )}

        {/* CSS for Animations and Hover Effects */}
        <style>{`
            .hover-scale:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
            
            .fade-message {
               opacity: 1;
               max-height: 50px;
               transition: opacity 0.5s ease, max-height 0.5s ease;
               overflow: hidden;
               text-align: center;
               margin-top: 10px;
            }
            .fade-message.hidden {
               opacity: 0;
               max-height: 0;
               margin-top: 0;
            }
        `}</style>
      </Page>
    </Frame>
  );
}