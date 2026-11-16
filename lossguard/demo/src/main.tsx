import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import "./app.css";
import { MemoryRepo, type Repo } from "../../app/store";
import { openIdb } from "./idb";
import { AppProvider, useApp } from "./state";
import { Toasts, UserBox } from "./ui/kit";
import { Home } from "./ui/Home";
import { SitePage } from "./ui/Site";
import { Rules } from "./ui/Rules";

function Shell() {
  const { route, go, persistent } = useApp();
  return (
    <div className="app">
      <header className="topbar no-print">
        <button className="brand" onClick={() => go({ page: "home" })} data-testid="nav-home">
          <span className="brand-mark">LG</span>
          <span><strong>LossGuard</strong><small>정산 자료 점검 · 시연판</small></span>
        </button>
        <span className="tag-synthetic" title="이 시연은 가상(합성) 공사자료로 만든 것입니다">가상 자료 시연</span>
        <span className="tag-local" title="올린 파일은 이 브라우저 안에서만 분석되고, 서버 · 외부 · AI 서비스로 보내지 않습니다">🔒 이 컴퓨터 안에서만 분석</span>
        <nav className="topnav">
          <button className={route.page === "home" ? "on" : ""} onClick={() => go({ page: "home" })}>현장</button>
          <button className={route.page === "rules" ? "on" : ""} onClick={() => go({ page: "rules" })} data-testid="nav-rules">회사 연결 규칙</button>
        </nav>
        <UserBox />
      </header>
      {!persistent && <div className="warn-strip no-print">이 브라우저는 저장소(IndexedDB)를 쓸 수 없어 새로고침하면 작업이 사라집니다.</div>}
      <main className="main">
        {route.page === "home" && <Home />}
        {route.page === "site" && <SitePage key={route.id} siteId={route.id} tab={route.tab} />}
        {route.page === "rules" && <Rules />}
      </main>
      <footer className="foot no-print">LossGuard 시연판 — 가상(합성) 공사자료로만 시험되었습니다. 결과는 확인할 곳을 보여 줄 뿐 손실을 확정하지 않습니다. 법률 · 세무 판단이 아닙니다.</footer>
      <Toasts />
    </div>
  );
}

function Boot() {
  const [repo, setRepo] = useState<{ repo: Repo; persistent: boolean }>();
  useEffect(() => {
    openIdb().then((r) => setRepo({ repo: r, persistent: true })).catch(() => setRepo({ repo: new MemoryRepo(), persistent: false }));
  }, []);
  if (!repo) return <p className="boot">불러오는 중…</p>;
  return <AppProvider repo={repo.repo} persistent={repo.persistent}><Shell /></AppProvider>;
}

createRoot(document.getElementById("root")!).render(<Boot />);
