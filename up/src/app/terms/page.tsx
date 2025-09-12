import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions - Pacgie",
  description: "Read our terms & conditions",
};

export default function TermsPage() {
  return (
    <div className="pt-20 max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms & Conditions</h1>
      <p className="mb-4">Last Updated: 2025-09-11</p>

      <p className="mb-6">
        These Terms govern your use of <strong>Pacgie</strong>. By using the
        service, you agree to these Terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">1. Service Overview</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>
          Pacgie provides scanning and upload tools with both free and paid
          options.
        </li>

        <li>
          <strong>Paid/Registered Users:</strong> Purchase credits tracked via
          token and linked to your account email.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">2. Payments & Credits</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>Payments are processed through Lemon Squeezy.</li>
        <li>All purchases are one-time and non-refundable.</li>
        <li>Credits expire 6 months after purchase if unused.</li>
        <li>
          Once credits are depleted or expired, you must repurchase to continue.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Refund & Cancellation Policy</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>Pacgie does not offer refunds for purchased credits or subscription payments. All sales are final.</li>
        <li>You may cancel your subscription or auto-renewal at any time. If you cancel, you will retain access to your purchased credits or subscription features until the end of your current billing period, and you will not be charged for the next billing cycle.</li>
        <li>If you have any questions or concerns, please contact us at <span className="font-medium">hello@pacgie.com</span>.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">
        3. User Responsibilities
      </h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>Provide accurate account details (including email).</li>
        <li>Do not use Pacgie for illegal, abusive, or malicious purposes.</li>
        <li>
          Do not attempt to bypass limits, reverse engineer, or disrupt the
          service.
        </li>
        <li>
          You are responsible for maintaining the security of your
          account/token.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">
        4. Limitation of Liability
      </h2>
      <p className="mb-4">
        Pacgie is provided “as is” without warranties. We are not liable for
        damages, loss of data, or service interruptions. Upload limits and
        availability may change at our discretion.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">5. Termination</h2>
      <p className="mb-4">
        We reserve the right to suspend or terminate accounts that violate these
        Terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">6. Changes</h2>
      <p>
        We may update these Terms and Privacy Policy from time to time.
        Continued use of the service after changes means you accept the new
        terms.
      </p>
    </div>
  );
}
