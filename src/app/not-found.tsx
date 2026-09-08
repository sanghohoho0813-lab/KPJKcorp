import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-[0.8rem] font-bold tracking-widest text-ink-3">404</div>
      <h1 className="text-[1.5rem] font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-ink-2">주소가 잘못되었거나 아직 준비되지 않은 화면입니다.</p>
      <Link href="/" className="mt-3 rounded-[10px] bg-primary px-5 py-2.5 font-semibold text-white">홈으로</Link>
    </div>
  );
}
