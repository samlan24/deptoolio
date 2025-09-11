import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read our privacy policy to understand how we handle your data.",
};


export default function PrivacyPage() {
  return (
    <div className="pt-20 max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Last Updated: 2025-09-11</p>

      <p className="mb-6">
        At <strong>Pacgie</strong>, we respect your privacy and are committed to
        protecting your personal data. This Privacy Policy explains how we
        collect, use, and safeguard information when you use our service.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>

          <strong>IP address</strong> to track usage and enforce upload limits.
        </li>
        <li>
          <strong>Registered/Paid Users:</strong>
          <ul className="list-disc ml-6 space-y-1">
            <li>
              <strong>Email Address:</strong> Collected when you create an
              account, used to track scans, manage credits, and send important
              account-related updates.
            </li>
            <li>
              <strong>Unique Token:</strong> Used to track your account usage
              and purchased credits.
            </li>
          </ul>
        </li>
        <li>
          <strong>Payment Information:</strong> Handled securely by{" "}
          <span className="font-medium">Lemon Squeezy</span>. We do not store
          card or billing details.
        </li>
        <li>
          <strong>General Usage Data:</strong> Basic analytics (e.g., page
          views, error logs) to improve the service.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>To enforce upload and credit limits.</li>
        <li>To manage your account and track total scans.</li>
        <li>To provide purchased credits and manage expirations.</li>
        <li>To send essential account-related notifications.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">3. Data Retention</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>Email and account data are retained as long as you maintain an account.</li>
        <li>IP-based tracking is temporary and only kept as long as needed.</li>
        <li>Payment records are retained as required by law.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Sharing</h2>
      <p className="mb-4">
        We do <strong>not sell or rent</strong> your data. Email and payment
        information may be shared with trusted third parties (e.g., Lemon
        Squeezy) strictly for payment processing and account management. We may
        disclose information if required by law or to protect our rights and
        users.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">5. Security</h2>
      <p className="mb-4">
        We use industry-standard measures to protect your data, but no method of
        transmission or storage is 100% secure.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">6. Your Rights</h2>
      <p>
        Depending on your location, you may request access, correction, or
        deletion of your data by contacting us at{" "}
        <span className="font-medium">hello@pacgie.com</span>.
      </p>
    </div>
  );
}
