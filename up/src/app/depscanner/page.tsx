import DepScanner from "./DepScanner";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export default async function DepScannerPage() {
    const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen pt-20 pb-6 max-w-5xl mx-auto px-6">
      <h1 className="text-3xl font-bold mb-4 text-center text-white">
        Unused & Missing Dependency Scanner
      </h1>
      <p className="text-center text-gray-400 mb-8">
        Connect a <strong className="text-white">Public</strong> GitHub repository and scan it for unused and missing dependencies.
      </p>
      <p className="text-sm text-center text-gray-400 ">supports <strong className="text-white">JavaScript</strong> and <strong className="text-white">TypeScript</strong> projects.</p>
      <DepScanner />
    </main>
  );
}
