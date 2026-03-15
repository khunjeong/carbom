import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">차봄</h1>
        <p className="text-gray-500">AI가 중고차 매물을 한 번에 비교해드립니다</p>
        <p className="text-sm text-gray-400">{user.email} 으로 로그인됨</p>
        <form action={logout}>
          <button
            type="submit"
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
