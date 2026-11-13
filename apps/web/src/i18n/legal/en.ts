import type { LegalDocuments } from "./types";

export const en: LegalDocuments = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        title: "1. Introduction",
        blocks: [
          {
            type: "p",
            text: 'Welcome to Creator Hub ("we," "our," "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform and use our services.',
          },
        ],
      },
      {
        title: "2. Information We Collect",
        blocks: [
          { type: "h4", text: "Personal Information Provided by You" },
          {
            type: "ul",
            items: [
              "<b>Account Data:</b> Name, email address, and hashed credentials provided during registration.",
              "<b>Creator Style & RAG Context:</b> User-submitted brand guidelines, preferences, past scripts, or style context uploaded to personalize AI outputs.",
              "<b>User Content:</b> Prompts, scripts, images, thumbnails, and other content created or uploaded within the platform.",
              "<b>Payment & Transaction Data:</b> Subscription plans, credit purchase history, and credit balance. Payment processing is handled directly by third-party processors (e.g., Stripe, Mercado Pago); we do not store full payment card details.",
            ],
          },
          { type: "h4", text: "Automatically Collected Information" },
          {
            type: "ul",
            items: [
              "IP address, browser type, device details, and operating system.",
              "Usage analytics, feature engagement, pages visited, and referral sources.",
            ],
          },
        ],
      },
      {
        title: "3. How We Use Your Information",
        blocks: [
          {
            type: "ul",
            items: [
              "Provide, maintain, and personalize our AI-powered creator tools and services.",
              "Process transactions, manage credit balances, and send billing receipts.",
              "Manage community bot integrations and user workflow automation.",
              "Improve platform functionality, security, and performance through analytics.",
              "Send administrative updates, security alerts, and customer support responses.",
              "Comply with legal and regulatory obligations.",
            ],
          },
        ],
      },
      {
        title: "4. Sharing Your Information & Third-Party Vendors",
        blocks: [
          {
            type: "p",
            text: "We do not sell your personal data. We share necessary data only with trusted service providers:",
          },
          {
            type: "ul",
            items: [
              "<b>AI Model Providers:</b> Prompts and input assets are processed via secure API endpoints (e.g., OpenAI, Google Gemini, and image synthesis services). Data processed via these API services is not used to train third-party foundation models.",
              "<b>Payment Processors:</b> Stripe and Mercado Pago for secure transaction handling.",
              "<b>Hosting & Infrastructure:</b> Cloud hosting (e.g., Vercel) and database providers.",
              "<b>Legal Authorities:</b> When required by applicable law or enforceable governmental request.",
            ],
          },
        ],
      },
      {
        title: "5. Data Retention & Account Deletion",
        blocks: [
          {
            type: "p",
            text: "We retain your personal information, credit usage history, and AI outputs as long as your account remains active. You may request full account and data deletion at any time by contacting support. Upon account termination, personal data and associated style context will be permanently erased or anonymized, subject to retention required by tax or accounting laws.",
          },
        ],
      },
      {
        title: "6. Your Rights (GDPR / CCPA)",
        blocks: [
          {
            type: "p",
            text: "Depending on your location, you have the right to:",
          },
          {
            type: "ul",
            items: [
              "Access, download, or transfer your personal data and generated content.",
              "Rectify inaccurate personal information.",
              'Request erasure of your account and creator context ("Right to be forgotten").',
              "Restrict or object to certain data processing activities.",
              "Withdraw consent at any time.",
            ],
          },
          {
            type: "p",
            text: "To exercise any of these rights, contact us at <email>privacy@creatorhubplatform.com</email>.",
          },
        ],
      },
      {
        title: "7. Cookies and Tracking",
        blocks: [
          {
            type: "p",
            text: "We use cookies and local storage to maintain user sessions, remember preferences, and analyze traffic. For detailed information, please review our Cookie Policy.",
          },
        ],
      },
      {
        title: "8. Security",
        blocks: [
          {
            type: "p",
            text: "We implement industry-standard technical and organizational security measures, including encryption at rest and in transit, to protect your personal data and generated content.",
          },
        ],
      },
      {
        title: "9. International Data Transfers",
        blocks: [
          {
            type: "p",
            text: "Your data may be transferred to and processed in servers outside your country of residence. We ensure all cross-border data transfers comply with applicable privacy regulations through standard contractual clauses.",
          },
        ],
      },
      {
        title: "10. Children's Privacy",
        blocks: [
          {
            type: "p",
            text: "Creator Hub is not intended for use by individuals under the age of 13 (or 16 in the EU). We do not knowingly collect personal data from children.",
          },
        ],
      },
      {
        title: "11. Changes to This Policy",
        blocks: [
          {
            type: "p",
            text: "We may update this Privacy Policy periodically. Material changes will be communicated via platform notifications or email prior to taking effect.",
          },
        ],
      },
      {
        title: "12. Contact Us",
        blocks: [
          {
            type: "p",
            text: "If you have any questions or requests regarding this Privacy Policy, please contact us at:",
          },
          {
            type: "contact",
            team: "Creator Hub Legal Team",
            emailLabel: "Email:",
          },
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        title: "1. Agreement to Terms",
        blocks: [
          {
            type: "p",
            text: 'By accessing or using Creator Hub ("the Service," "we," "our," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.',
          },
        ],
      },
      {
        title: "2. Description of Service",
        blocks: [
          {
            type: "p",
            text: 'Creator Hub provides AI-powered software, workflows, and tools for content creators, including but not limited to script generation, thumbnail design, image synthesis, user style/RAG context management, credit billing systems, and community bot integrations ("Tools").',
          },
        ],
      },
      {
        title: "3. Accounts & Registration",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Eligibility:</b> You must be at least 13 years old (or 16 in the European Union) to create an account.",
              "<b>Accuracy:</b> You agree to provide accurate and complete registration information.",
              "<b>Security:</b> You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your account.",
              "<b>Unauthorized Use:</b> You must notify us immediately at <email>privacy@creatorhubplatform.com</email> if you suspect unauthorized access to your account.",
            ],
          },
        ],
      },
      {
        title: "4. Subscriptions, Payments & Refunds",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Billing:</b> Access to certain features and credit allocations requires a paid subscription or pay-as-you-go purchase.",
              "<b>Payment Processors:</b> Payments are securely handled through third-party payment gateways (e.g., Stripe, Mercado Pago). We do not store or process complete credit card details.",
              "<b>Auto-Renewal:</b> Subscription plans automatically renew at the end of each billing cycle unless cancelled prior to the renewal date.",
              "<b>Refund Policy:</b> Purchases and credit top-ups are non-refundable once credits have been partially or fully consumed, except where required by applicable law.",
            ],
          },
        ],
      },
      {
        title: "5. Credit System & Fair Usage",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Credit Consumption:</b> Platform tools consume credits based on compute complexity (e.g., text generation vs. image rendering). Credit costs per action are displayed within the platform and may be adjusted with prior notice.",
              "<b>Expiration & Exclusions:</b> Unless explicitly stated in your subscription plan, monthly credits do not roll over to subsequent billing periods and expire at the end of each cycle.",
              "<b>Adjustments:</b> Creator Hub reserves the right to adjust credit pricing or allocations to account for underlying API operational costs.",
            ],
          },
        ],
      },
      {
        title: "6. User Content & Intellectual Property",
        blocks: [
          { type: "h4", text: "Your Ownership & License Grant" },
          {
            type: "ul",
            items: [
              '<b>User Inputs:</b> You retain all ownership rights over the text, style guides, brand assets, and prompts you upload to the Service ("User Content").',
              "<b>License to Creator Hub:</b> You grant Creator Hub a non-exclusive, worldwide, royalty-free license to host, store, run, and display your User Content <b>solely</b> for the purpose of operating, rendering, and providing the Service to you. We do not sell your content or use your private inputs to train public third-party AI models.",
            ],
          },
          { type: "h4", text: "AI-Generated Outputs" },
          {
            type: "ul",
            items: [
              '<b>Ownership of Generated Content:</b> Subject to compliance with these Terms and applicable copyright laws, Creator Hub assigns to you all its rights, title, and interest in the outputs generated for you by the Tools ("Generated Content").',
              "<b>Third-Party AI Constraints:</b> Generated Content is subject to the terms of underlying AI infrastructure providers. You acknowledge that AI-generated outputs may not be unique across different users and that copyright protection for AI output varies by jurisdiction.",
            ],
          },
        ],
      },
      {
        title: "7. Acceptable Use Policy",
        blocks: [
          { type: "p", text: "You agree not to use the Service to:" },
          {
            type: "ul",
            items: [
              "Violate any local, national, or international law.",
              "Generate, upload, or distribute content that is defamatory, hateful, abusive, illegal, or infringes on third-party intellectual property or privacy rights.",
              "Reverse engineer, decompile, or attempt to extract source code from Creator Hub.",
              "Scrap, harvest, or utilize unauthorized automated bots to bypass API limits or credit systems (excluding official community bots provided by Creator Hub).",
              "Abuse, overload, or disrupt the integrity or performance of the platform or its infrastructure.",
            ],
          },
        ],
      },
      {
        title: "8. Third-Party Services & Integrations",
        blocks: [
          {
            type: "p",
            text: "The Service integrates with third-party tools, APIs, and community platforms (e.g., external LLM providers, social channels, webhooks). Creator Hub is not responsible for the availability, uptime, or privacy practices of these third-party services.",
          },
        ],
      },
      {
        title: "9. Disclaimer of Warranties",
        blocks: [
          {
            type: "p",
            text: 'THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. CREATOR HUB DISCLAIMS ALL WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE THAT AI GENERATED CONTENT WILL BE ACCURATE, UNINTERRUPTED, OR ERROR-FREE.',
          },
        ],
      },
      {
        title: "10. Limitation of Liability",
        blocks: [
          {
            type: "p",
            text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CREATOR HUB AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.",
          },
        ],
      },
      {
        title: "11. Indemnification",
        blocks: [
          {
            type: "p",
            text: "You agree to indemnify and hold harmless Creator Hub, its team, and affiliates against any claims, liabilities, damages, or legal expenses arising from your User Content, your misuse of Generated Content, or your violation of these Terms.",
          },
        ],
      },
      {
        title: "12. Account Suspension & Termination",
        blocks: [
          {
            type: "p",
            text: "We reserve the right to suspend or terminate your access to the Service immediately, without prior notice, if you breach these Terms or engage in fraudulent, abusive, or unauthorized credit activity. Upon termination, unused credits are forfeited.",
          },
        ],
      },
      {
        title: "13. Governing Law",
        blocks: [
          {
            type: "p",
            text: "These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any legal suit or proceeding shall be instituted in the competent courts of your operational jurisdiction.",
          },
        ],
      },
      {
        title: "14. Changes to Terms",
        blocks: [
          {
            type: "p",
            text: "We may revise these Terms from time to time. Material modifications will be notified via in-app banners or email at least 30 days prior to enforcement. Your continued use of Creator Hub constitutes acceptance of the updated Terms.",
          },
        ],
      },
      {
        title: "15. Contact Information",
        blocks: [
          {
            type: "p",
            text: "For questions or legal inquiries regarding these Terms, please contact us at:",
          },
          {
            type: "contact",
            team: "Creator Hub Legal Team",
            emailLabel: "Email:",
          },
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      {
        title: "1. What Are Cookies and Local Storage?",
        blocks: [
          {
            type: "p",
            text: 'Cookies are small text files placed on your device (computer, tablet, or mobile) when you visit websites. In addition to cookies, Creator Hub ("we," "our," or "us") utilizes standard browser storage technologies, such as <b>Local Storage</b> and <b>Session Storage</b> (collectively, "Storage Technologies"), to ensure seamless service functionality, authentication, and user preferences.',
          },
        ],
      },
      {
        title: "2. How We Use Storage Technologies",
        blocks: [
          {
            type: "p",
            text: "We use cookies and browser storage for the following purposes:",
          },
          {
            type: "ul",
            items: [
              "<b>Essential & Security:</b> Required for core service operations, user authentication, session persistence, and Cross-Site Request Forgery (CSRF) protection.",
              "<b>Preferences & State:</b> Remember your UI settings, interface language, theme (light/dark mode), credit balance display preferences, and temporary script/editor drafts.",
              "<b>Analytics & Performance:</b> Help us understand user traffic, application latency, and platform performance to improve features (e.g., Vercel Analytics, Google Analytics).",
              "<b>Payment & Fraud Prevention:</b> Placed by payment processors during checkout to ensure secure transaction processing and prevent fraudulent chargebacks.",
            ],
          },
        ],
      },
      {
        title: "3. Storage Technologies Used by Creator Hub",
        blocks: [
          {
            type: "table",
            headers: [
              "Category",
              "Storage Method / Name",
              "Purpose",
              "Duration",
            ],
            rows: [
              [
                "<b>Authentication</b>",
                "Session / Auth Token",
                "Keeps you securely logged in and manages active API requests",
                "Session / 30 Days",
              ],
              [
                "<b>Security</b>",
                "CSRF Token",
                "Protects against unauthorized cross-site request forgery",
                "Session",
              ],
              [
                "<b>Preferences</b>",
                "<code>theme</code>, <code>creator_settings</code>",
                "Remembers your UI preferences and workspace layout",
                "1 Year (Local Storage)",
              ],
              [
                "<b>Preferences</b>",
                "<code>ch_locale</code>",
                "Remembers your interface language",
                "1 Year",
              ],
              [
                "<b>Analytics</b>",
                "Vercel Analytics",
                "Measures page responsiveness, bundle performance, and error logs",
                "1 Year",
              ],
              [
                "<b>Analytics</b>",
                "Google Analytics (<code>_ga</code>, <code>_gid</code>)",
                "Tracks usage metrics, page views, and feature adoption",
                "Up to 2 Years",
              ],
              [
                "<b>Payments</b>",
                "Stripe / Payment Gateway Cookies",
                "Facilitates secure credit purchases and fraud detection",
                "Session / 1 Year",
              ],
            ],
          },
        ],
      },
      {
        title: "4. Third-Party Services",
        blocks: [
          {
            type: "p",
            text: "We rely on trusted third-party service providers that may place cookies or access browser storage when you interact with Creator Hub:",
          },
          {
            type: "ul",
            items: [
              "<b>Vercel Analytics:</b> Performance and reliability monitoring.",
              "<b>Google Analytics:</b> Traffic analysis and aggregated user flow insights.",
              "<b>Payment Gateways (Stripe / Mercado Pago):</b> Fraud prevention and secure checkout processing.",
            ],
          },
        ],
      },
      {
        title: "5. Your Cookie Choices & Controls",
        blocks: [
          {
            type: "ul",
            href: "https://tools.google.com/dlpage/gaoptout",
            items: [
              "<b>Browser Settings:</b> Most web browsers allow you to manage, block, or delete cookies and cleared Local Storage via your browser preferences/settings.",
              "<b>Essential Storage:</b> Please note that disabling essential cookies or local storage may prevent you from logging in or using Creator Hub features.",
              "<b>Analytics Opt-Out:</b> You can opt out of Google Analytics tracking across all websites by visiting <link>Google Analytics Opt-out Browser Add-on</link>.",
            ],
          },
        ],
      },
      {
        title: "6. Cookie Consent & Banner",
        blocks: [
          {
            type: "p",
            text: "When you first access Creator Hub, a cookie banner will notify you about our use of Storage Technologies. Essential cookies are loaded automatically to enable core platform operation. By continuing to use our platform or accepting non-essential cookies through the banner, you consent to our use of these technologies as outlined in this policy.",
          },
        ],
      },
      {
        title: "7. Do Not Track (DNT) Signals",
        blocks: [
          {
            type: "p",
            text: 'Some browsers include a "Do Not Track" setting. Because uniform standards for DNT compliance have not been broadly established across the industry, Creator Hub does not currently respond to DNT signals.',
          },
        ],
      },
      {
        title: "8. Changes to This Cookie Policy",
        blocks: [
          {
            type: "p",
            text: 'We may update this Cookie Policy to reflect technical, operational, or legal changes. We will notify users of any material updates by posting the revised version with an updated "Last updated" date.',
          },
        ],
      },
      {
        title: "9. Contact Us",
        blocks: [
          {
            type: "p",
            text: "If you have any questions or concerns regarding our use of cookies and local storage, please contact us at:",
          },
          {
            type: "contact",
            team: "Creator Hub Legal & Privacy Team",
            emailLabel: "Email:",
          },
        ],
      },
    ],
  },
};
