export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const message = params.message ?? "인증 중 오류가 발생했습니다.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">로그인 실패</h1>
        <p className="text-gray-500">{message}</p>
        <a href="/login" className="text-blue-600 underline">
          다시 시도
        </a>
      </div>
    </main>
  );
}
