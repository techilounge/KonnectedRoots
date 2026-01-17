import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function TermsOfServicePage() {
    const lastUpdated = 'January 16, 2026';

    return (
        <div className="min-h-screen bg-background">
            {/* Hero */}
            <section className="py-12 md:py-16 bg-gradient-to-b from-secondary/50 to-background">
                <div className="container mx-auto px-4 text-center">
                    <Badge variant="outline" className="mb-4">Legal</Badge>
                    <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
                    <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
                </div>
            </section>

            {/* Content */}
            <section className="py-12">
                <div className="container mx-auto px-4 max-w-4xl prose prose-zinc dark:prose-invert">

                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using KonnectedRoots (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the Service.
                    </p>
                    <p>
                        These Terms apply to all users, including visitors, registered users, and paying subscribers.
                    </p>

                    <h2>2. Description of Service</h2>
                    <p>
                        KonnectedRoots is a web-based family tree building and genealogy platform that allows users to:
                    </p>
                    <ul>
                        <li>Create and manage family trees</li>
                        <li>Add family members with profiles, photos, and documents</li>
                        <li>Collaborate with family members on shared trees</li>
                        <li>Export trees in various formats (PDF, images, GEDCOM)</li>
                        <li>Access AI-powered features for genealogy research</li>
                    </ul>

                    <h2>3. Account Registration</h2>

                    <h3>3.1 Eligibility</h3>
                    <p>
                        You must be at least 13 years old to create an account. If you are under 18, you must have parental or guardian consent.
                    </p>

                    <h3>3.2 Account Security</h3>
                    <p>
                        You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss arising from unauthorized access to your account.
                    </p>

                    <h3>3.3 Accurate Information</h3>
                    <p>
                        You agree to provide accurate, current, and complete information during registration and to keep your account information updated.
                    </p>

                    <h2>4. User Content</h2>

                    <h3>4.1 Your Content</h3>
                    <p>
                        You retain ownership of all content you create, upload, or submit to KonnectedRoots (&quot;User Content&quot;), including family tree data, photos, documents, and stories.
                    </p>

                    <h3>4.2 License to Us</h3>
                    <p>
                        By uploading content, you grant us a limited, non-exclusive license to store, display, and process your content solely for the purpose of providing the Service. We will not use your content for any other purpose without your consent.
                    </p>

                    <h3>4.3 Content Guidelines</h3>
                    <p>You agree not to upload content that:</p>
                    <ul>
                        <li>Violates any law or regulation</li>
                        <li>Infringes on intellectual property rights of others</li>
                        <li>Contains malware, viruses, or harmful code</li>
                        <li>Is defamatory, harassing, or threatening</li>
                        <li>Contains personally identifiable information of others without their consent</li>
                    </ul>

                    <h3>4.4 Family Data Responsibility</h3>
                    <p>
                        When adding information about family members, you are responsible for ensuring you have the right to share that information. Consider the privacy of living relatives before adding their personal details.
                    </p>

                    <h2>5. Subscription and Billing</h2>

                    <h3>5.1 Free and Paid Plans</h3>
                    <p>
                        KonnectedRoots offers a free tier with limited features and paid subscription plans (Pro, Family) with additional features. Current pricing and features are available on our <Link href="/pricing">Pricing page</Link>.
                    </p>

                    <h3>5.2 Billing</h3>
                    <p>
                        Paid subscriptions are billed in advance on a monthly or yearly basis. You authorize us to charge your payment method for the subscription fees.
                    </p>

                    <h3>5.3 Automatic Renewal</h3>
                    <p>
                        Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date. You can cancel anytime from your account settings.
                    </p>

                    <h3>5.4 Refunds</h3>
                    <p>
                        We offer a 7-day money-back guarantee for new subscriptions. Contact us within 7 days of your first payment for a full refund. After this period, refunds are at our discretion.
                    </p>

                    <h3>5.5 Price Changes</h3>
                    <p>
                        We may change subscription prices with 30 days&apos; notice. Price changes will take effect at your next renewal period.
                    </p>

                    <h2>6. Collaboration and Sharing</h2>

                    <h3>6.1 Inviting Collaborators</h3>
                    <p>
                        You may invite others to view or edit your family trees. You are responsible for managing access and understand that collaborators may view or modify shared content based on their assigned role.
                    </p>

                    <h3>6.2 Collaborator Conduct</h3>
                    <p>
                        You are responsible for the conduct of users you invite. If a collaborator violates these Terms, we may take action against both the collaborator and the tree owner.
                    </p>

                    <h2>7. Intellectual Property</h2>

                    <h3>7.1 Our Property</h3>
                    <p>
                        The KonnectedRoots name, logo, website design, and all software are our intellectual property or licensed to us. You may not copy, modify, or distribute any part of our Service without permission.
                    </p>

                    <h3>7.2 Feedback</h3>
                    <p>
                        If you provide suggestions, feedback, or ideas about the Service, you grant us the right to use them without obligation to you.
                    </p>

                    <h2>8. Prohibited Uses</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the Service for any illegal purpose</li>
                        <li>Attempt to gain unauthorized access to our systems</li>
                        <li>Interfere with or disrupt the Service</li>
                        <li>Scrape, crawl, or use automated tools to access the Service</li>
                        <li>Impersonate others or misrepresent your identity</li>
                        <li>Use the Service to send spam or unsolicited messages</li>
                        <li>Violate the rights of other users</li>
                    </ul>

                    <h2>9. Termination</h2>

                    <h3>9.1 By You</h3>
                    <p>
                        You may delete your account at any time from your account settings. Upon deletion, your data will be removed according to our <Link href="/privacy">Privacy Policy</Link>.
                    </p>

                    <h3>9.2 By Us</h3>
                    <p>
                        We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or for other reasons at our discretion. We will notify you unless prohibited by law.
                    </p>

                    <h2>10. Disclaimers</h2>
                    <p>
                        <strong>THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND.</strong> We do not guarantee that the Service will be uninterrupted, error-free, or secure. We are not responsible for the accuracy of genealogical information you or others enter.
                    </p>

                    <h2>11. Limitation of Liability</h2>
                    <p>
                        TO THE MAXIMUM EXTENT PERMITTED BY LAW, KONNECTEDROOTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, OR GOODWILL.
                    </p>
                    <p>
                        Our total liability for any claim arising from the Service shall not exceed the amount you paid us in the 12 months before the claim.
                    </p>

                    <h2>12. Indemnification</h2>
                    <p>
                        You agree to indemnify and hold harmless KonnectedRoots from any claims, damages, or expenses arising from your use of the Service, your content, or your violation of these Terms.
                    </p>

                    <h2>13. Dispute Resolution</h2>
                    <p>
                        Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. You waive your right to participate in class action lawsuits.
                    </p>

                    <h2>14. Changes to Terms</h2>
                    <p>
                        We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice on our website. Your continued use of the Service after changes constitutes acceptance of the updated Terms.
                    </p>

                    <h2>15. General Provisions</h2>
                    <ul>
                        <li><strong>Entire Agreement</strong>: These Terms constitute the entire agreement between you and KonnectedRoots.</li>
                        <li><strong>Severability</strong>: If any provision is found unenforceable, the remaining provisions remain in effect.</li>
                        <li><strong>Waiver</strong>: Our failure to enforce any right does not waive that right.</li>
                        <li><strong>Assignment</strong>: You may not assign these Terms. We may assign them to a successor.</li>
                        <li><strong>Governing Law</strong>: These Terms are governed by the laws of the State of Delaware, USA.</li>
                    </ul>

                    <h2>16. Contact Us</h2>
                    <p>
                        If you have questions about these Terms, please contact us:
                    </p>
                    <ul>
                        <li>Email: <a href="mailto:legal@konnectedroots.com">legal@konnectedroots.com</a></li>
                        <li>Contact Form: <Link href="/contact">konnectedroots.com/contact</Link></li>
                    </ul>

                    <div className="mt-12 p-6 bg-secondary rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">
                            Related Documents:
                        </p>
                        <div className="flex gap-4">
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
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
