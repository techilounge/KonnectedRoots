import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function PrivacyPolicyPage() {
    const lastUpdated = 'January 16, 2026';

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <section className="py-12 md:py-16 bg-gradient-to-b from-secondary/50 to-background">
                <div className="container mx-auto px-4 text-center">
                    <Badge variant="outline" className="mb-4">Legal</Badge>
                    <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
                </div>
            </section>

            {/* Content */}
            <section className="py-12">
                <div className="container mx-auto px-4 max-w-4xl prose prose-zinc dark:prose-invert">

                    <h2>1. Introduction</h2>
                    <p>
                        Welcome to KonnectedRoots (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and the privacy of your family&apos;s information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our family tree building service.
                    </p>
                    <p>
                        By using KonnectedRoots, you agree to the collection and use of information in accordance with this policy.
                    </p>

                    <h2>2. Information We Collect</h2>

                    <h3>2.1 Account Information</h3>
                    <p>When you create an account, we collect:</p>
                    <ul>
                        <li>Email address</li>
                        <li>Name (optional)</li>
                        <li>Profile photo (optional)</li>
                        <li>Authentication credentials</li>
                    </ul>

                    <h3>2.2 Family Tree Data</h3>
                    <p>When you use our service, you may provide:</p>
                    <ul>
                        <li>Names and relationships of family members</li>
                        <li>Birth dates, death dates, and other life events</li>
                        <li>Photos and documents you upload</li>
                        <li>Notes and stories about family members</li>
                        <li>Location information (birthplaces, residences)</li>
                    </ul>

                    <h3>2.3 Usage Information</h3>
                    <p>We automatically collect:</p>
                    <ul>
                        <li>Device information (browser type, operating system)</li>
                        <li>IP address and approximate location</li>
                        <li>Usage patterns and feature interactions</li>
                        <li>Error logs and performance data</li>
                    </ul>

                    <h3>2.4 Payment Information</h3>
                    <p>
                        If you subscribe to a paid plan, payment processing is handled by Stripe. We do not store your full credit card number. We only receive limited billing information (last 4 digits, expiration date, billing address) for record-keeping.
                    </p>

                    <h2>3. How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul>
                        <li>Provide and maintain the KonnectedRoots service</li>
                        <li>Process your transactions and manage subscriptions</li>
                        <li>Enable collaboration features with family members you invite</li>
                        <li>Send service-related communications (account verification, security alerts)</li>
                        <li>Improve our service and develop new features</li>
                        <li>Respond to your requests and support inquiries</li>
                        <li>Prevent fraud and enforce our Terms of Service</li>
                    </ul>

                    <h3>3.1 Legal Basis for Processing (GDPR)</h3>
                    <p>If you are in the European Economic Area (EEA), we process your data based on:</p>
                    <ul>
                        <li><strong>Contract</strong>: To provide the KonnectedRoots service you signed up for</li>
                        <li><strong>Consent</strong>: For optional features like marketing emails and analytics cookies</li>
                        <li><strong>Legitimate Interest</strong>: To improve our service, prevent fraud, and ensure security</li>
                        <li><strong>Legal Obligation</strong>: To comply with applicable laws and regulations</li>
                    </ul>

                    <h2>4. Data Sharing and Disclosure</h2>

                    <h3>4.1 We Do NOT Sell Your Data</h3>
                    <p>
                        <strong>We will never sell, rent, or trade your personal or family data to third parties for marketing purposes.</strong>
                    </p>

                    <h3>4.2 Sharing with Your Consent</h3>
                    <p>
                        Your family tree data is only shared with people you explicitly invite as collaborators. You control who can view, edit, or manage your trees.
                    </p>

                    <h3>4.3 Service Providers</h3>
                    <p>We may share information with trusted third-party service providers who assist us in operating our service:</p>
                    <ul>
                        <li><strong>Firebase (Google Cloud)</strong>: Hosting, authentication, and database services</li>
                        <li><strong>Stripe</strong>: Payment processing</li>
                        <li><strong>Resend</strong>: Transactional email delivery</li>
                    </ul>
                    <p>These providers are contractually obligated to protect your data and use it only for the services they provide to us.</p>

                    <h3>4.4 Legal Requirements</h3>
                    <p>
                        We may disclose your information if required by law, court order, or government request, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
                    </p>

                    <h2>5. Data Security</h2>
                    <p>We implement industry-standard security measures to protect your data:</p>
                    <ul>
                        <li>Encryption in transit (TLS/SSL) and at rest</li>
                        <li>Secure authentication with optional two-factor authentication</li>
                        <li>Regular security audits and monitoring</li>
                        <li>Access controls limiting employee access to user data</li>
                        <li>Secure cloud infrastructure (Google Cloud/Firebase)</li>
                    </ul>
                    <p>
                        While we strive to protect your data, no method of transmission or storage is 100% secure. We cannot guarantee absolute security.
                    </p>

                    <h2>6. Your Rights and Choices</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li><strong>Access</strong>: Request a copy of your personal data</li>
                        <li><strong>Correction</strong>: Update or correct inaccurate information</li>
                        <li><strong>Deletion</strong>: Request deletion of your account and data</li>
                        <li><strong>Export</strong>: Download your family tree data (GEDCOM format for paid plans)</li>
                        <li><strong>Opt-out</strong>: Unsubscribe from marketing emails (service emails cannot be opted out)</li>
                    </ul>
                    <p>
                        To exercise these rights, visit your Account Settings or contact us at <a href="mailto:privacy@konnectedroots.com">privacy@konnectedroots.com</a>.
                    </p>

                    <h2>7. Data Retention</h2>
                    <p>
                        We retain your data for as long as your account is active. If you delete your account, we will delete your personal data and family tree information within 30 days, except where we are required to retain it for legal or legitimate business purposes.
                    </p>

                    <h2>8. AI and Machine Learning</h2>
                    <p>
                        <strong>Your family data is NOT used to train AI models.</strong> Our AI features (such as name suggestions) use general genealogical knowledge and public datasets — not your personal family information.
                    </p>

                    <h2>9. Children&apos;s Privacy</h2>
                    <p>
                        KonnectedRoots is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us.
                    </p>

                    <h2>10. International Data Transfers</h2>
                    <p>
                        Your information may be transferred to and processed in countries other than your own, including the United States. We ensure appropriate safeguards are in place for international transfers, including:
                    </p>
                    <ul>
                        <li><strong>Standard Contractual Clauses (SCCs)</strong> approved by the European Commission</li>
                        <li>Data processing agreements with all third-party providers</li>
                        <li>Technical and organizational security measures</li>
                    </ul>

                    <h2>11. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a notice on our website. Your continued use of KonnectedRoots after changes constitutes acceptance of the updated policy.
                    </p>

                    <h2>12. Contact Us</h2>
                    <p>
                        If you have questions about this Privacy Policy or our data practices, please contact us:
                    </p>
                    <ul>
                        <li>Email: <a href="mailto:privacy@konnectedroots.com">privacy@konnectedroots.com</a></li>
                        <li>Contact Form: <Link href="/contact">konnectedroots.com/contact</Link></li>
                    </ul>

                    <h2>13. Your Right to Lodge a Complaint</h2>
                    <p>
                        If you are in the EEA and believe we have not adequately addressed your data protection concerns, you have the right to lodge a complaint with your local Data Protection Authority (DPA). A list of DPAs can be found at:
                    </p>
                    <p>
                        <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            European Data Protection Board - Members
                        </a>
                    </p>

                    <h2>14. Data Protection Contact</h2>
                    <p>
                        For data protection inquiries specifically related to GDPR, please contact our designated data protection representative:
                    </p>
                    <ul>
                        <li>Email: <a href="mailto:dpo@konnectedroots.com">dpo@konnectedroots.com</a></li>
                    </ul>

                    <div className="mt-12 p-6 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">
                            Related Documents:
                        </p>
                        <div className="flex gap-4">
                            <Link href="/terms" className="text-primary hover:underline">
                                Terms of Service
                            </Link>
                            <Link href="/contact" className="text-primary hover:underline">
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
