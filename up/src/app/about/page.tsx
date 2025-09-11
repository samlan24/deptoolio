import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Pacgie",
  description: "Learn more about Pacgie, our mission, and how we help developers manage dependencies.",
};

export default function AboutPage() {
  return (
    <div className="pt-20 max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">About Pacgie</h1>

      <p className="mb-6">
        Welcome to <strong>Pacgie</strong> — a simple and reliable tool designed
        to help developers, security researchers, and businesses analyze and
        manage their projects more efficiently.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Our Mission</h2>
      <p className="mb-6">
        At Pacgie, our mission is to make secure project scanning and dependency
        tracking accessible to everyone. Whether you’re an indie developer
        checking your code, or a small team managing multiple projects, Pacgie
        makes it easy to keep your software clean, safe, and up to date.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">How It Works</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">

        <li>
          <strong>Registered Users:</strong> Create an account with your email
          to track your scans and progress over time.
        </li>
        <li>
          <strong>Paid Users:</strong> Purchase credits through Lemon Squeezy,
          tracked by your account token. Credits are valid for one month and can
          be repurchased anytime.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Why Choose Pacgie?</h2>
      <ul className="list-disc ml-6 mb-6 space-y-2">
        <li>Lightweight and easy to use — no complex setup required.</li>
        <li>Transparent pricing with one-time, non-recurring credits.</li>
        <li>
          Focused on privacy: we only collect what’s necessary (email, and
          tokens) to provide the service.
        </li>
        <li>Powered by modern infrastructure to ensure fast and reliable scans.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Our Values</h2>
      <p className="mb-6">
        We believe in simplicity, privacy, and transparency. Pacgie is built for
        people who want results without unnecessary friction — just upload, scan,
        and move forward with confidence.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Get in Touch</h2>
      <p>
        Have questions or feedback? We’d love to hear from you. Reach out at{" "}
        <span className="font-medium">hello@pacgie.com</span>.
      </p>
    </div>
  );
}
