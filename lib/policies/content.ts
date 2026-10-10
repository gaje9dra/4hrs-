export type PolicySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type PolicyPageContent = {
  slug: string;
  title: string;
  description: string;
  updatedLabel: string;
  intro: string;
  sections: PolicySection[];
};

export const POLICY_PAGES: Record<string, PolicyPageContent> = {
  "refund-replacement": {
    slug: "refund-replacement",
    title: "Refund & Replacement Policy",
    description: "How 4HRS+ reviews suspected product defects and handles eligible refund, replacement, repair, and other remedies.",
    updatedLabel: "Policy information",
    intro: "Our standard voluntary refund and replacement policy is intended for qualifying product defects. Every report is reviewed on its facts and under applicable consumer-protection law. This page explains our normal reporting procedure; it does not remove any rights or remedies that the law gives you.",
    sections: [
      { heading: "What may qualify", paragraphs: ["A manufacturing defect or a material fault in the product may qualify for review. We assess reports individually and may ask for additional information to understand the issue. A claim is not automatically approved just because it is submitted, and it is not automatically rejected just because evidence is incomplete."] , bullets: ["A suspected manufacturing or material defect present when the product was received.", "A product materially different from the item ordered, where the facts and applicable law support a remedy."]},
      { heading: "What is not covered by the standard voluntary policy", paragraphs: ["Except where applicable law requires otherwise, our standard voluntary policy does not offer a refund or replacement for a change of mind, a preference change, an incorrect size selection, or fit/style dissatisfaction unrelated to a defect. Normal wear, accidental damage, misuse, unauthorized alteration, or damage occurring after delivery may not be a product defect. We review the available facts rather than treating any single description as conclusive."]},
      { heading: "Report within 24 hours", paragraphs: ["Please report a suspected defect within 24 hours of receiving the order. Where available, we use the delivery timestamp recorded for the order to understand when the reporting period began. This is our requested reporting procedure to help us investigate promptly; it does not override a right or remedy that applies under Indian law. If you discover a problem later, or cannot report within 24 hours, submit it for review and explain the circumstances. A late report is not automatically rejected where the law requires otherwise or where an exception is appropriate."]},
      { heading: "Evidence requested", paragraphs: ["To help us assess the report, please prepare the following evidence. An unboxing video is requested as useful evidence, but the absence of a video is not, by itself, a universal legal basis to deny a claim. We may assess other reliable evidence and the circumstances. Do not post order evidence publicly. The current support-case form does not provide a video or photo upload field, and no separate private evidence-submission channel is configured in the storefront. Open a support case with your written report and state what evidence you have; do not publish evidence or send it to an unverified address. A private submission method must be confirmed before video or photo files can be accepted. Do not send payment credentials or unrelated personal information."] , bullets: ["A continuous, unedited unboxing video, if available, beginning before opening the parcel and showing the parcel, opening process, and alleged defect where reasonably possible.", "Clear photographs of the alleged defect.", "Your order number.", "The affected product name and selected size.", "A short description of the issue and when you first noticed it.", "Photographs of the outer packaging or shipping label when relevant. Redact unnecessary personal information where practical."]},
      { heading: "Review and possible outcomes", paragraphs: ["After reviewing the order details and available evidence, we may ask follow-up questions or request additional information. Depending on the facts and applicable law, an approved claim may be resolved by a replacement, refund, repair, or another appropriate legally required remedy. No particular outcome is promised before review. Do not ship an item back unless support has confirmed the arrangement and instructions."]},
      { heading: "Shipping, packaging and refunds", paragraphs: ["Keep the product and its packaging until the claim is resolved, and retain any delivery materials that may help the assessment. For an approved claim, support will communicate whether a return is needed, how shipping is arranged, and the next steps. Refund method and processing time depend on the approved resolution and payment-provider/banking processes; we do not publish a fixed processing deadline because it cannot be verified here. Original packaging may help the assessment but is not stated as an absolute legal prerequisite."]},
      { heading: "How to submit a claim", bullets: ["Open a support case using your 4HRS+ account and include your order number, affected item/size, description, and the date you received the parcel.", "Prepare the evidence listed above. Ask support for a secure way to provide video or photographs because file uploads are not currently available in the support-case form.", "We review the request and may ask for more information.", "We communicate the decision, reasons or next steps, and any approved return or resolution arrangement.", "Any refund or replacement is handled through the appropriate existing order process; submitting a claim does not automatically issue a refund or create a replacement order."]},
      { heading: "Contact support", paragraphs: ["Use the support-case page for a defect report or to ask about an existing claim. The case form requires an account sign-in. No public support email, telephone number, or return address is currently configured in the storefront, so this policy does not invent one."]},
      { heading: "Your legal rights", paragraphs: ["Nothing in this policy excludes, limits, or waives a consumer right or remedy that cannot lawfully be excluded. Where a legal requirement conflicts with the standard voluntary procedure described here, the applicable law takes precedence. This policy should be reviewed by qualified Indian consumer-law counsel before publication."]}
    ]
  },
  "shipping": {
    slug: "shipping",
    title: "Shipping & Delivery Policy",
    description: "Information about order processing, delivery estimates, shipping charges, tracking, and delivery issues at 4HRS+.",
    updatedLabel: "Policy information",
    intro: "We aim to communicate shipping information clearly. Actual processing and delivery depend on the order, destination, fulfillment status, and available carrier information.",
    sections: [
      { heading: "Order processing and delivery estimates", paragraphs: ["We do not publish a universal dispatch or delivery deadline on this page because a verified, generally applicable estimate is not configured here. Review the estimate, if any, shown during checkout or in an order-specific message. An estimate is not a guaranteed delivery date unless expressly identified as such."]},
      { heading: "Shipping charges", paragraphs: ["Any shipping charge or other applicable charge supported by the checkout is shown during the order process before you confirm payment. Check the final order summary before placing an order. This policy does not promise free shipping or a fixed shipping rate."]},
      { heading: "Tracking and shipment updates", paragraphs: ["Shipment and tracking details are shown only when the order has corresponding information available in the system. Tracking availability and update frequency can vary. We do not promise live tracking or a particular carrier integration for every order. Check your account order details and any order-specific communications for current information."]},
      { heading: "Delays and delivery attempts", paragraphs: ["Delivery can be affected by carrier operations, weather, local restrictions, address accuracy, and other circumstances outside the storefront's direct control. If delivery is delayed, check the order details for available updates and open a support case with your order number if you need help."]},
      { heading: "Address accuracy and failed delivery", paragraphs: ["Provide a complete and accurate delivery address and contact details at checkout. If you notice an error, contact support promptly; a change may not be possible after fulfillment or dispatch begins. If a delivery attempt fails or an address is incomplete, the next step depends on the carrier and shipment status. We will not promise an address change or redelivery until it is confirmed."]},
      { heading: "Damaged packages, missing parcels or wrong items", paragraphs: ["If a parcel arrives visibly damaged, retain the packaging and take photographs where practical. Report a suspected product defect using the Refund & Replacement Policy procedure. For a missing, delayed, incorrect or delivery-status issue, open a support case and provide the order number and relevant details. Shipping delay alone is not the same as a product defect."]},
      { heading: "Contact support", paragraphs: ["Open a support case through your 4HRS+ account for order processing, tracking, address, failed-delivery, or damaged-package questions. The current storefront does not publish a verified public phone number or support email."]}
    ]
  },
  terms: {
    slug: "terms",
    title: "Terms & Conditions",
    description: "Terms governing use of the 4HRS+ website, product listings, orders, payments, promotions, and customer remedies.",
    updatedLabel: "Terms information",
    intro: "These terms describe the general conditions for using the 4HRS+ storefront. They must be read together with the policies linked on this website and any order-specific terms presented before purchase.",
    sections: [
      { heading: "Website use and eligibility", paragraphs: ["Use the website lawfully and provide accurate information when placing an order or contacting support. Do not attempt to interfere with the website, bypass access controls, upload malicious content, misuse another person's account, or submit fraudulent requests. If you are not legally able to enter a binding transaction, use the service only with appropriate involvement of a parent or legal guardian where permitted."]},
      { heading: "Product descriptions, images and availability", paragraphs: ["We aim to describe products and show imagery accurately. Screens and lighting can affect how colours appear, and product details or availability may change. Product listings are not a guarantee that every item or size remains available at the moment an order is submitted. We may correct an obvious listing error and will handle affected orders in accordance with applicable law."]},
      { heading: "Prices, charges and promotions", paragraphs: ["The applicable price, discount, shipping charge and total are those shown in the final order summary before payment, subject to correction of an obvious error and applicable law. Coupon offers may have eligibility, minimum spend, maximum discount, usage limits, expiry, or other terms displayed with the offer. A coupon is not valid beyond its configured terms and cannot be used to bypass checkout controls."]},
      { heading: "Orders and acceptance", paragraphs: ["Submitting an order request does not require us to accept an invalid, fraudulent, unavailable or incorrectly priced order. Order status and payment status are governed by the actual order records and payment verification. We do not treat a browser redirect or a customer-supplied payment screenshot alone as proof of successful payment. If an order cannot be fulfilled, support will communicate the available next steps consistent with applicable law."]},
      { heading: "Payments, cancellations and delivery", paragraphs: ["Payments are processed through the payment options presented during checkout. Payment-provider terms may also apply. Cancellation requests are subject to the order's actual processing, fulfillment and shipment status; submitting a request does not guarantee cancellation. Shipping, tracking, delay and delivery issues are governed by the Shipping & Delivery Policy and the information available for the particular order."]},
      { heading: "Defects and consumer remedies", paragraphs: ["The Refund & Replacement Policy describes the brand's standard voluntary process for suspected product defects. It does not remove mandatory consumer rights or remedies under applicable law. A claim is reviewed individually and does not automatically trigger a refund or replacement."]},
      { heading: "Intellectual property and prohibited conduct", paragraphs: ["The website's brand assets, design, text, product imagery and other content are owned by or used with permission by their respective rights holders. Do not copy, exploit, impersonate, scrape in a disruptive manner, or use content in violation of law or third-party rights."]},
      { heading: "Availability and liability", paragraphs: ["We work to keep the website available and secure, but do not guarantee uninterrupted or error-free operation. To the extent permitted by applicable law, liability is limited only as lawfully allowed. Nothing in these terms excludes liability or a consumer remedy that cannot legally be excluded or limited."]},
      { heading: "Governing law, changes and contact", paragraphs: ["These terms are intended for an Indian e-commerce context and are subject to applicable Indian law. No exclusive court or city is specified here because a verified business jurisdiction has not been configured; mandatory jurisdiction rules continue to apply. We may update these terms by publishing a revised version with an updated date. For questions, use the support-case route on the website. These terms require review by qualified Indian legal counsel before publication."]}
    ]
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How 4HRS+ uses customer, order, payment, support, security and website information.",
    updatedLabel: "Privacy information",
    intro: "This policy describes categories of information the 4HRS+ application may process to operate the storefront, fulfil orders, protect accounts, and respond to customers. Exact processing depends on the features you use and the providers involved.",
    sections: [
      { heading: "Information we process", bullets: ["Account and contact details, such as name, email address, phone number, and account/session information.", "Delivery and billing details, including address information provided for an order.", "Order items, selected sizes/variants, totals, coupon use, order status, payment references, refunds, fulfilment and shipment records.", "Messages and information submitted in support cases, return or cancellation requests, and customer communications.", "Defect evidence such as photographs or unboxing videos if a secure submission method is later made available and you provide it.", "Technical and security information such as request metadata, access/security logs, and reliability telemetry.", "Analytics or experimentation information where those features are enabled and applicable consent/preferences permit it."]},
      { heading: "How information is used", paragraphs: ["Information is used to create and manage accounts and orders, take and verify payments, fulfil and deliver purchases, provide support, investigate suspected defects, handle cancellations/returns/refunds, prevent fraud and abuse, secure the website, maintain records, meet legal obligations, and improve reliability. We do not claim to collect only the information listed here; processing can depend on a feature and its configuration."]},
      { heading: "Service providers and sharing", paragraphs: ["Information may be shared with service providers where needed to operate the service. This can include the payment provider shown at checkout (PayU where configured), fulfilment providers used for an order (including Qikink where applicable), delivery or tracking providers where involved, hosting/infrastructure providers, and operational notification services if enabled. These providers receive information necessary for their role and may process it under their own terms and legal obligations. We do not sell customer personal data to advertisers as a business practice described by this policy."]},
      { heading: "Payments", paragraphs: ["Payment details are handled through the payment flow and provider used for the transaction. The storefront records transaction references and payment status needed to verify and manage orders. Do not send card numbers, passwords, one-time passwords, or payment credentials in a support case."]},
      { heading: "Cookies, sessions and analytics", paragraphs: ["The website uses necessary session or security mechanisms to authenticate customers and protect requests. Cart, locale, or preference behavior may also rely on browser-side or server-side state. Analytics and experimentation capabilities exist in the application, but their use depends on deployment configuration and applicable consent settings. Browser controls can limit some cookies, although doing so may affect site functionality."]},
      { heading: "Retention and security", paragraphs: ["Information is retained for as long as needed for the relevant order, account, support, security, operational, and legal purposes. The application provides customer data export and account deletion/anonymization controls; some historical order, payment, audit, or legally required records may need to be retained or anonymized rather than erased. We use technical and organizational safeguards, but no system can promise absolute security."]},
      { heading: "Your choices and requests", paragraphs: ["Where available, signed-in customers can request an export of account data or request account deletion from account privacy controls. You may also open a support case for a privacy question or request. We may need to verify your identity and clarify a request before acting. Any rights and response obligations available under applicable law remain unaffected."]},
      { heading: "Children, updates and contact", paragraphs: ["The storefront is not designed to solicit children's personal information independently of an appropriate legal basis and adult involvement where required. We do not knowingly ask children to submit unnecessary sensitive information. We may update this policy as features or legal requirements change. For a privacy request, use the account privacy controls or support-case page. A dedicated public privacy email is not currently configured."]}
    ]
  },
  cancellation: {
    slug: "cancellation",
    title: "Cancellation Policy",
    description: "How to request an order cancellation and how fulfillment status affects review.",
    updatedLabel: "Policy information",
    intro: "You can request cancellation through the supported order flow. Whether a request can be completed depends on the order's current state and applicable law.",
    sections: [
      { heading: "How to request cancellation", paragraphs: ["Sign in to your account, open the relevant order, and use the cancellation action if it is available. If you cannot access that action, open a support case with your order number and request a cancellation review. Do not share passwords or payment credentials in a case."]},
      { heading: "Before fulfillment or dispatch", paragraphs: ["An order that has not entered fulfillment or shipment may be easier to cancel, but the request still needs to be processed through the order system. Submitting a cancellation request is not confirmation that the order has been cancelled. Check the resulting order or cancellation status."]},
      { heading: "After fulfillment or dispatch", paragraphs: ["Once fulfillment has started or a shipment exists, cancellation may require review or may no longer be operationally possible through the same process. Contact support promptly. Do not assume a parcel can be intercepted or returned to sender until that arrangement is confirmed. Mandatory rights under applicable law remain unaffected."]},
      { heading: "Payments and refunds", paragraphs: ["If cancellation is approved and a payment refund is due, it is handled through the existing authorized payment/refund workflow and applicable payment-provider processes. We do not promise a fixed refund timeline here because a verified universal timeframe is not available. A cancellation request does not itself issue a refund."]},
      { heading: "Contact support", paragraphs: ["Use your account's order details or support-case page for a cancellation question. Include the order number and explain why you are requesting cancellation."]}
    ]
  },
  contact: {
    slug: "contact",
    title: "Contact Us",
    description: "Contact 4HRS+ customer support for orders, payments, shipping, defect claims, and privacy requests.",
    updatedLabel: "Customer support",
    intro: "The supported contact route currently available on the storefront is the customer support case system. We do not publish an unverified email address, phone number, office address, or return address.",
    sections: [
      { heading: "Open a support case", paragraphs: ["Sign in to your 4HRS+ account and open a support case. Choose the closest category and include the order number when your question relates to a purchase. If you cannot sign in, use the login page to recover access before submitting an authenticated case."]},
      { heading: "What support can help with", bullets: ["Order status and order-detail questions.", "Payment or checkout issues. Do not include card numbers, passwords, or one-time passwords.", "Shipping, delivery, tracking, and address issues.", "Cancellation, return, refund, and suspected product-defect reports.", "Account privacy, data export, and deletion questions."]},
      { heading: "Suspected product defect", paragraphs: ["Please report a suspected defect within 24 hours of delivery where possible, as described in our Refund & Replacement Policy. Include your order number, affected product and size, a description, and when you received the parcel. The current case form does not accept video or photo attachments, and a separate private evidence-submission channel is not configured in the storefront. Open the case with a written description and do not post private evidence publicly or send it to an unverified address."]},
      { heading: "Privacy and contact details", paragraphs: ["Use account privacy controls for a data export or account deletion request where available. No dedicated public support or privacy email and no verified business postal address are configured in the current storefront. These details must be supplied through verified business configuration before they can be published."]}
    ]
  },
  faq: {
    slug: "faq",
    title: "Frequently Asked Questions",
    description: "Answers about 4HRS+ orders, defects, returns, shipping, coupons, refunds, and privacy.",
    updatedLabel: "Help and support",
    intro: "Quick answers to common questions. For a decision about a particular order, use your account order details or open a support case.",
    sections: [
      { heading: "How do I report a defective product?", paragraphs: ["Open a support case with your order number, the affected product and size, a short description, and the date you received the parcel. Please report within 24 hours where possible. See the Refund & Replacement Policy for the full procedure."]},
      { heading: "Why is an unboxing video requested?", paragraphs: ["A continuous video beginning before the package is opened can help show the parcel condition, opening process, and when the alleged defect was first visible. It is requested as useful evidence, not stated as an absolute legal prerequisite in every circumstance. Clear photographs and other information may also help."]},
      { heading: "What if my video is incomplete or I have no video?", paragraphs: ["Submit the report and explain what evidence you have. The claim is reviewed on its facts and under applicable law; absence of a video alone does not automatically decide every claim. The support form currently has no file-upload field and no separate private evidence-submission channel is configured, so do not publish or send evidence to an unverified address."]},
      { heading: "What if I notice the defect after 24 hours?", paragraphs: ["Submit the issue for review and explain when you noticed it and why it was reported later. The 24-hour period is the requested standard reporting procedure, not an automatic waiver of rights that apply under law."]},
      { heading: "Can I get a refund for a wrong size or change of mind?", paragraphs: ["Under the standard voluntary policy, change of mind, incorrect size selection, and fit or preference dissatisfaction unrelated to a defect are not eligible, except where applicable law requires a remedy. Review the Refund & Replacement Policy for details."]},
      { heading: "How are replacement decisions made?", paragraphs: ["Claims are reviewed individually. We may ask for more information. Depending on the facts and applicable law, an approved claim may receive a replacement, refund, repair, or another required remedy. Submission does not automatically approve a claim or create a replacement order."]},
      { heading: "How long do refunds take?", paragraphs: ["Refund timing depends on the approved resolution and payment-provider or banking processes. We do not state a universal fixed processing deadline here. Support will communicate the applicable next steps after review."]},
      { heading: "How do shipping and tracking work?", paragraphs: ["Shipping charges and any estimate are shown during checkout when available. Tracking is displayed only when shipment information exists in the system. Delivery estimates are not guaranteed unless expressly identified as such. Open a support case for a delay or tracking issue."]},
      { heading: "How do coupon discounts affect my order?", paragraphs: ["Coupon eligibility, percentage, minimum spend, maximum discount, usage limit, and expiry depend on the terms shown for that coupon. The final payable total shown in the order summary is the relevant checkout amount, subject to applicable law and correction of obvious errors."]},
      { heading: "How is my customer information handled?", paragraphs: ["Information is used to operate accounts, orders, payments, delivery, support, security, and related services. See the Privacy Policy for categories of information, provider sharing, retention, and account privacy controls."]},
      { heading: "How do I contact support?", paragraphs: ["Sign in and use the support-case page. No public support email or telephone number is currently configured in the storefront."]}
    ]
  }
};

export const POLICY_SLUGS = Object.keys(POLICY_PAGES);

export function getPolicyPage(slug: string): PolicyPageContent | null {
  return POLICY_PAGES[slug] ?? null;
}
